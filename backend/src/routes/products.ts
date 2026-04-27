import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { buildProductCsvTemplate, runProductCsvImport } from '../services/productCsvImport.js'
import {
  CATALOG_TAG_HER,
  CATALOG_TAG_HIM,
  catalogTagMessage,
  dedupeGenderCatalogTags,
  hasCatalogTagConflict,
  hasGenderCatalogTag,
} from '../catalogTags.js'
import { getDb } from '../db/index.js'
import { buildCatalogBrochureImage } from '../services/catalogPng.js'
import {
  createProduct,
  findProductBySku,
  fetchAllProducts,
  resolveProductCategoryId,
  updateProduct,
  WooSite,
} from '../services/woo-client.js'

export const productRouter = Router()

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

// #region agent log
const DEBUG_SESSION = '3e75d0'
const DEBUG_LOG_PATH = path.join(process.cwd(), '..', 'debug-3e75d0.log')
const DEBUG_INGEST = 'http://127.0.0.1:7283/ingest/f336a3af-82ec-4f5a-8d73-8f982dad1000'
function agentLog(payload: Record<string, unknown>) {
  const base = { sessionId: DEBUG_SESSION, timestamp: Date.now(), ...payload }
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(base)}\n`)
  } catch {
    /* ignore */
  }
  fetch(DEBUG_INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': DEBUG_SESSION },
    body: JSON.stringify(base),
  }).catch(() => {})
}
// #endregion

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

const MAX_KEYWORD_TOKENS = 200

/** 按逗号/分号/换行切分，用于多 SKU 列表；不切普通空格，避免整句被拆散 */
function parseProductKeywordTokens(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.split(/[\n\r]+/)) {
    for (const seg of line.split(/[,;，；]+/)) {
      const t = seg.trim()
      if (t) out.push(t)
    }
  }
  return out.slice(0, MAX_KEYWORD_TOKENS)
}

/** 新建商品自动 SKU 前缀（与历史 VC 系列并存，仅 DK 序列递增） */
const AUTO_SKU_PREFIX = 'DK'

function generateSku(): string {
  const db = getDb()
  const like = `${AUTO_SKU_PREFIX}%`
  const row = db.get(
    `SELECT sku FROM products WHERE sku LIKE ? ORDER BY CAST(SUBSTR(sku, 3) AS INTEGER) DESC LIMIT 1`,
    [like],
  ) as { sku?: string } | undefined
  if (row?.sku) {
    const num = parseInt(row.sku.replace(AUTO_SKU_PREFIX, ''), 10) || 0
    return `${AUTO_SKU_PREFIX}${String(num + 1).padStart(3, '0')}`
  }
  return `${AUTO_SKU_PREFIX}001`
}

// GET /catalog 与 /catalog.png?audience=him|her — 客户图册长图（宽 1500px，PNG）
async function handleCatalogPng(req: Request, res: Response) {
  const audience = String(req.query.audience || '')
  if (audience !== 'him' && audience !== 'her') {
    return respondError(res, 'Query audience must be him or her', 400)
  }
  const tag = audience === 'him' ? CATALOG_TAG_HIM : CATALOG_TAG_HER
  const db = getDb()
  const like = `%"${tag.replace(/"/g, '')}"%`
  let rows: Array<{
    sku: string
    name: string
    sale_price: number
    regular_price: number
    images: string
    category: string | null
    supplier_codes: string | null
  }>
  try {
    rows = db.all(
      `SELECT p.sku, p.name, p.sale_price, p.regular_price, p.images, p.category,
       (SELECT GROUP_CONCAT(supplier_code, ', ') FROM (
          SELECT DISTINCT supplier_code FROM product_supplier WHERE product_id = p.id
        )) AS supplier_codes
     FROM products p
     WHERE p.status = 1 AND p.catalog_in = 1 AND p.tags LIKE ?
     ORDER BY
       CASE WHEN p.category IS NULL OR TRIM(p.category) = '' THEN 1 ELSE 0 END,
       p.category COLLATE NOCASE ASC,
       p.sku COLLATE NOCASE ASC`,
      [like],
    ) as typeof rows
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return respondError(res, `图册查询失败: ${msg}`, 500)
  }
  if (!rows || rows.length === 0) {
    return respondError(res, '没有已进图册、带对应标签且上架的商品', 400)
  }
  try {
    const { buffer, mimeType, fileExt } = await buildCatalogBrochureImage(rows, audience as 'him' | 'her')
    const filename = audience === 'him' ? `catalog-for-him.${fileExt}` : `catalog-for-her.${fileExt}`
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '生成图册失败'
    respondError(res, msg, 500)
  }
}
productRouter.get('/catalog', handleCatalogPng)
productRouter.get('/catalog.png', handleCatalogPng)

/** 自检：若返回 404，说明当前代理指向的端口上的进程不是本仓库后端或未重启 */
productRouter.get('/catalog-health', (_req: Request, res: Response) => {
  respond(res, { catalog: true, endpoints: ['/catalog', '/catalog.png'] })
})

// GET /items
productRouter.get('/items', (req: Request, res: Response) => {
  const db = getDb()
  const { keyword, page = '1', page_size = '20', category, status, has_supplier, tag, catalog_in } = req.query as Record<string, string>

  const conditions: string[] = []
  const params: unknown[] = []

  if (keyword && keyword.trim()) {
    const tokens = parseProductKeywordTokens(keyword)
    if (tokens.length >= 2) {
      // 多段：仅匹配本地 SKU 与供应商编码（OR），与「整句搜索名称」区分
      const per = tokens.map(
        () => '(p.sku LIKE ? OR EXISTS (SELECT 1 FROM product_supplier ps_m WHERE ps_m.product_id = p.id AND ps_m.supplier_code LIKE ?))',
      )
      conditions.push(`(${per.join(' OR ')})`)
      for (const t of tokens) {
        const w = `%${t}%`
        params.push(w, w)
      }
    } else if (tokens.length === 1) {
      const w = tokens[0].trim()
      if (w) {
        const kw = `%${w}%`
        conditions.push(
          '(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR EXISTS (SELECT 1 FROM product_supplier ps_kw WHERE ps_kw.product_id = p.id AND ps_kw.supplier_code LIKE ?))',
        )
        params.push(kw, kw, kw, kw)
      }
    }
  }

  if (category) {
    conditions.push('p.category = ?')
    params.push(category)
  }

  if (status !== undefined && status !== '') {
    conditions.push('p.status = ?')
    params.push(parseInt(status))
  }

  if (has_supplier === 'yes') {
    conditions.push('EXISTS (SELECT 1 FROM product_supplier ps_f WHERE ps_f.product_id = p.id)')
  } else if (has_supplier === 'no') {
    conditions.push('NOT EXISTS (SELECT 1 FROM product_supplier ps_f WHERE ps_f.product_id = p.id)')
  }

  if (tag && tag.trim()) {
    const t = tag.trim()
    conditions.push('p.tags LIKE ?')
    params.push(`%"${t.replace(/"/g, '')}"%`)
  }

  if (catalog_in === '0' || catalog_in === '1') {
    conditions.push('p.catalog_in = ?')
    params.push(parseInt(catalog_in, 10))
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(page_size) || 20))
  const offset = (pageNum - 1) * pageSize

  const totalRow = db.get(`SELECT COUNT(*) as count FROM products p ${where}`, params)
  const total = (totalRow as any)?.count ?? 0

  const items = db.all(
    `SELECT p.*,
       GROUP_CONCAT(DISTINCT ps2.supplier_code) as supplier_codes,
       (SELECT COUNT(*) FROM product_sync WHERE product_id = p.id AND sync_status = 'synced') as synced_count,
       (SELECT COUNT(*) FROM product_sync WHERE product_id = p.id AND sync_status = 'failed') as failed_count,
       (SELECT GROUP_CONCAT(s.name, ', ') FROM product_sync psn JOIN sites s ON psn.site_id = s.id WHERE psn.product_id = p.id AND psn.sync_status = 'synced') as synced_site_names
     FROM products p
     LEFT JOIN product_supplier ps2 ON p.id = ps2.product_id
     ${where}
     GROUP BY p.id
     ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const sitesRow = db.get("SELECT COUNT(*) as count FROM sites WHERE status = 'active'")
  const total_sites = (sitesRow as any)?.count ?? 0
  const dbTotalRow = db.get('SELECT COUNT(*) as count FROM products')
  const db_product_count = (dbTotalRow as any)?.count ?? 0

  respond(res, {
    items,
    total_sites,
    /** 本地库商品总数（不受当前列表 keyword/category 等筛选影响）；用于「全量同步」提示 */
    db_product_count,
    pagination: { page: pageNum, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
  })
})

// GET /items/csv-template — 须在 /items/:id 之前
productRouter.get('/items/csv-template', requireAuth, requireRole('operator'), (_req: Request, res: Response) => {
  const csv = buildProductCsvTemplate()
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"')
  res.send(csv)
})

// POST /items/import-csv — validate_only=1 仅校验不写库
productRouter.post(
  '/items/import-csv',
  requireAuth,
  requireRole('operator'),
  csvUpload.single('file'),
  (req: Request, res: Response) => {
    const file = req.file
    if (!file?.buffer) {
      return respondError(res, '请使用 multipart 上传 file 字段（CSV）', 400)
    }
    const q = String(req.query.validate_only || '')
    const validateOnly = q === '1' || q.toLowerCase() === 'true'
    let text: string
    try {
      text = file.buffer.toString('utf8')
    } catch {
      return respondError(res, '无法读取文件', 400)
    }
    try {
      const result = runProductCsvImport(text, validateOnly)
      respond(res, result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导入失败'
      respondError(res, msg, 500)
    }
  },
)

// PATCH /items/catalog-batch — 批量设置进图册（须已有 for him / for her 之一）
productRouter.patch('/items/catalog-batch', (req: Request, res: Response) => {
  const db = getDb()
  const { ids, catalog_in } = req.body as { ids?: unknown; catalog_in?: unknown }
  if (!Array.isArray(ids) || ids.length === 0) return respondError(res, 'ids 必须为非空数组', 400)
  if (catalog_in === undefined || ![0, 1, '0', '1'].includes(catalog_in as 0 | 1 | '0' | '1')) {
    return respondError(res, 'catalog_in 须为 0 或 1', 400)
  }
  const flag = Number(catalog_in) === 1 ? 1 : 0
  const failed: Array<{ id: string; reason: string }> = []
  const updated: string[] = []
  const ts = now()
  for (const rawId of ids) {
    const id = String(rawId)
    const row = db.get('SELECT id, tags FROM products WHERE id = ?', [id]) as { id: string; tags: string } | undefined
    if (!row) {
      failed.push({ id, reason: 'not found' })
      continue
    }
    let tags: unknown = []
    try {
      tags = JSON.parse(row.tags || '[]')
    } catch {
      tags = []
    }
    if (flag === 1 && !hasGenderCatalogTag(tags)) {
      failed.push({ id, reason: '需要 for him 或 for her 标签' })
      continue
    }
    db.run('UPDATE products SET catalog_in = ?, updated_at = ? WHERE id = ?', [flag, ts, id])
    updated.push(id)
  }
  respond(res, { updated, failed, count: updated.length })
})

// GET /items/id-list — 须在 /items/:id 之前注册，避免 id 被当成路由参数
productRouter.get('/items/id-list', (_req: Request, res: Response) => {
  const db = getDb()
  const rows = db.all('SELECT id FROM products ORDER BY sku COLLATE NOCASE ASC') as { id: string }[]
  respond(res, { ids: rows.map((r) => r.id) })
})

// GET /items/:id
productRouter.get('/items/:id', (req: Request, res: Response) => {
  const db = getDb()
  const product = db.get('SELECT * FROM products WHERE id = ?', [req.params.id])
  if (!product) return respondError(res, 'Product not found', 404)

  const syncList = db.all(
    `SELECT ps.*, s.name as site_name, s.url as site_url
     FROM product_sync ps JOIN sites s ON ps.site_id = s.id
     WHERE ps.product_id = ?`,
    [req.params.id]
  )

  respond(res, { ...product, sync: syncList })
})

// POST /items
productRouter.post('/items', (req: Request, res: Response) => {
  const { name, short_description, description, sale_price, regular_price, category, tags, images, status } = req.body
  if (!name) return respondError(res, 'Missing required field: name')
  const tagsNorm = dedupeGenderCatalogTags(tags)
  if (hasCatalogTagConflict(tagsNorm)) return respondError(res, catalogTagMessage(), 400)

  const db = getDb()
  const id = `prod-${uuidv4().slice(0, 8)}`
  const sku = generateSku()
  const ts = now()

  try {
    db.run(
      `INSERT INTO products (id, sku, name, short_description, description, sale_price, regular_price, category, tags, images, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sku, name, short_description || null, description || null, sale_price || 0, regular_price || 0, category || null, JSON.stringify(tagsNorm), JSON.stringify(images || []), status ?? 1, ts, ts]
    )
    const product = db.get('SELECT * FROM products WHERE id = ?', [id])
    respond(res, product, 201)
  } catch (err: any) {
    respondError(res, err.message, 500)
  }
})

// PUT /items/:id
productRouter.put('/items/:id', (req: Request, res: Response) => {
  const db = getDb()
  const product = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]) as Record<string, unknown> | undefined
  if (!product) return respondError(res, 'Product not found', 404)

  const nextTags: unknown[] | undefined = req.body.tags !== undefined ? req.body.tags : undefined
  const tagsNorm = nextTags !== undefined ? dedupeGenderCatalogTags(nextTags) : undefined
  if (tagsNorm !== undefined && hasCatalogTagConflict(tagsNorm)) {
    return respondError(res, catalogTagMessage(), 400)
  }

  let finalTags: unknown[]
  try {
    finalTags = tagsNorm !== undefined ? tagsNorm : JSON.parse(String(product.tags || '[]'))
  } catch {
    finalTags = []
  }

  let finalCatalogIn =
    req.body.catalog_in !== undefined ? (Number(req.body.catalog_in) === 1 ? 1 : 0) : (Number(product.catalog_in) || 0)

  if (!hasGenderCatalogTag(finalTags)) {
    if (req.body.catalog_in === 1 && Number(req.body.catalog_in) === 1) {
      return respondError(res, '进图册需先选择 for him 或 for her 标签', 400)
    }
    finalCatalogIn = 0
  }

  if (req.body.sku !== undefined) {
    const nextSku = String(req.body.sku).trim()
    if (!nextSku) return respondError(res, 'SKU 不能为空', 400)
    const currentSku = String(product.sku ?? '')
    if (nextSku !== currentSku) {
      const clash = db.get('SELECT id FROM products WHERE sku = ? AND id != ?', [nextSku, req.params.id]) as
        | { id: string }
        | undefined
      if (clash) return respondError(res, 'SKU 已被其他商品使用', 409)
    }
  }

  const updatable = ['name', 'short_description', 'description', 'sale_price', 'regular_price', 'category', 'tags', 'images', 'status', 'sku']
  const sets: string[] = []
  const params: unknown[] = []

  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`)
      let val: unknown =
        field === 'tags' && tagsNorm !== undefined ? tagsNorm : req.body[field]
      if (field === 'sku') val = String(val).trim()
      params.push((field === 'images' || field === 'tags') ? JSON.stringify(val) : val)
    }
  }

  const tagOrCatalogChanged = nextTags !== undefined || req.body.catalog_in !== undefined
  if (tagOrCatalogChanged) {
    sets.push('catalog_in = ?')
    params.push(finalCatalogIn)
  }

  if (sets.length === 0) return respondError(res, 'No fields to update')

  sets.push('updated_at = ?')
  params.push(now())
  params.push(req.params.id)

  db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, params)
  const updated = db.get('SELECT * FROM products WHERE id = ?', [req.params.id])
  respond(res, updated)
})

// DELETE /items/:id
productRouter.delete('/items/:id', (req: Request, res: Response) => {
  const db = getDb()
  const product = db.get('SELECT * FROM products WHERE id = ?', [req.params.id])
  if (!product) return respondError(res, 'Product not found', 404)

  db.run('DELETE FROM products WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

/** 共用同步循环；mode=full 时写 agentLog（全量单请求） */
async function runSyncLoopForProducts(
  products: any[],
  site_ids: string[] | undefined,
  mode: 'full' | 'batch',
): Promise<{
  products: number
  synced: number
  failed: number
  details: Array<{ product_id: string; sku: string; results: any[]; skipped_images: string[] }>
}> {
  const allResults: Array<{ product_id: string; sku: string; results: any[]; skipped_images: string[] }> = []
  const t0 = Date.now()
  if (mode === 'full') {
    agentLog({
      hypothesisId: 'H1',
      location: 'products.ts:sync-all',
      message: 'sync-all start',
      data: { runId: 'pre-fix', productCount: products.length, cwd: process.cwd() },
    })
  }

  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const { results, skipped_images } = await syncProductToSites(product, site_ids)
    allResults.push({ product_id: product.id, sku: product.sku, results, skipped_images })
    if (mode === 'full') {
      agentLog({
        hypothesisId: 'H1',
        location: 'products.ts:sync-all',
        message: 'sync-all product done',
        data: {
          runId: 'pre-fix',
          index: i,
          sku: product.sku,
          elapsedMs: Date.now() - t0,
          siteResults: results.length,
        },
      })
    }
  }

  const totalSynced = allResults.reduce((sum, r) => sum + r.results.filter((x: any) => x.success).length, 0)
  const totalFailed = allResults.reduce((sum, r) => sum + r.results.filter((x: any) => !x.success).length, 0)

  if (mode === 'full') {
    agentLog({
      hypothesisId: 'H1',
      location: 'products.ts:sync-all',
      message: 'sync-all complete',
      data: { runId: 'pre-fix', totalMs: Date.now() - t0, products: allResults.length, totalSynced, totalFailed },
    })
  }

  return { products: allResults.length, synced: totalSynced, failed: totalFailed, details: allResults }
}

// POST /items/sync-batch — 分批同步，避免单次 HTTP 超过 Nginx 默认 60s 导致 504
productRouter.post('/items/sync-batch', async (req: Request, res: Response) => {
  const db = getDb()
  const { site_ids, product_ids } = req.body || {}
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return respondError(res, 'Missing or empty product_ids')
  }
  const placeholders = product_ids.map(() => '?').join(',')
  const found = db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, product_ids) as any[]
  const byId = new Map(found.map((p) => [p.id, p]))
  const ordered = product_ids.map((id: string) => byId.get(id)).filter(Boolean) as any[]
  if (ordered.length === 0) return respondError(res, 'No matching products', 400)

  const out = await runSyncLoopForProducts(ordered, site_ids, 'batch')
  respond(res, out)
})

// POST /items/sync-all — 须注册在 /items/:id/sync 之前，避免路径被误解析（防御性顺序）
productRouter.post('/items/sync-all', async (req: Request, res: Response) => {
  const db = getDb()
  const { site_ids } = req.body || {}
  const products = db.all('SELECT * FROM products') as any[]
  if (products.length === 0) return respondError(res, 'No products to sync')

  const out = await runSyncLoopForProducts(products, site_ids, 'full')
  respond(res, out)
})

// POST /items/:id/sync — 仅同步这一件商品到各站点
productRouter.post('/items/:id/sync', async (req: Request, res: Response) => {
  const db = getDb()
  const product = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]) as any
  if (!product) return respondError(res, 'Product not found', 404)

  const { site_ids } = req.body || {}
  const { results, skipped_images } = await syncProductToSites(product, site_ids)
  respond(res, { product_id: product.id, results, skipped_images })
})

// POST /items/pull-from-site - 从源站拉取所有产品
productRouter.post('/items/pull-from-site', async (req: Request, res: Response) => {
  const { site_id } = req.body
  if (!site_id) return respondError(res, 'Missing site_id')

  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [site_id]) as any
  if (!site) return respondError(res, 'Site not found', 404)

  const wooSite: WooSite = { url: site.url, consumer_key: site.consumer_key, consumer_secret: site.consumer_secret }

  try {
    const wooProducts = await fetchAllProducts(wooSite)
    let created = 0, updated = 0, skipped = 0

    for (const wp of wooProducts) {
      if (!wp.name) { skipped++; continue }

      // 检查是否已有 product_sync 记录（通过 woo_product_id 匹配）
      const existing = db.get(
        'SELECT ps.product_id FROM product_sync ps WHERE ps.site_id = ? AND ps.woo_product_id = ?',
        [site_id, wp.id]
      ) as { product_id?: string } | undefined

      const category = wp.categories?.[0]?.name || null
      const tags = (wp.tags || []).map(t => t.name)
      const images = (wp.images || []).map(img => img.src)
      const salePrice = parseFloat(wp.sale_price || '0') || 0
      const regularPrice = parseFloat(wp.regular_price || '0') || 0

      let localProductId: string | null = null
      if (existing?.product_id) {
        const stillThere = db.get('SELECT id FROM products WHERE id = ?', [existing.product_id]) as { id?: string } | undefined
        if (stillThere?.id) {
          localProductId = existing.product_id
        } else {
          // 已清空本地产品但 product_sync 残留：删掉孤儿关联，按新建处理
          db.run('DELETE FROM product_sync WHERE site_id = ? AND woo_product_id = ?', [site_id, wp.id])
        }
      }

      if (localProductId) {
        db.run(
          `UPDATE products SET name = ?, short_description = ?, description = ?, sale_price = ?, regular_price = ?,
           category = ?, tags = ?, images = ?, status = 0, updated_at = ? WHERE id = ?`,
          [wp.name, wp.short_description || null, wp.description || null, salePrice, regularPrice,
           category, JSON.stringify(tags), JSON.stringify(images), now(), localProductId]
        )
        updated++
      } else {
        const id = `prod-${uuidv4().slice(0, 8)}`
        const sku = generateSku()
        const ts = now()

        db.run(
          `INSERT INTO products (id, sku, name, short_description, description, sale_price, regular_price, category, tags, images, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [id, sku, wp.name, wp.short_description || null, wp.description || null, salePrice, regularPrice,
           category, JSON.stringify(tags), JSON.stringify(images), ts, ts]
        )

        db.run(
          `INSERT INTO product_sync (product_id, site_id, woo_product_id, sync_status, last_synced_at)
           VALUES (?, ?, ?, 'synced', ?)`,
          [id, site_id, wp.id, ts]
        )
        created++
      }
    }

    respond(res, { total: wooProducts.length, created, updated, skipped })
  } catch (err: any) {
    respondError(res, `拉取失败: ${err.message}`, 500)
  }
})

/** 单张远程图是否可访问（与 Woo 拉图行为一致的前置检查） */
async function isImageUrlReachable(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) return true
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { Range: 'bytes=0-0' },
      })
    }
    return res.ok
  } catch {
    return false
  }
}

/**
 * 编辑页里填了但远程 404 的图片会跳过，其余字段照常同步。
 * SYNC_SKIP_IMAGE_PREFLIGHT=1 时不做检查，原样交给 Woo（由 Woo 报错或成功）。
 */
async function filterReachableImageUrls(urls: string[]): Promise<{ ok: string[]; skipped: string[] }> {
  if (urls.length === 0) return { ok: [], skipped: [] }
  if (process.env.SYNC_SKIP_IMAGE_PREFLIGHT === '1') {
    return { ok: [...urls], skipped: [] }
  }
  const outcomes = await Promise.all(
    urls.map(async (url, i) => ({ i, url, ok: await isImageUrlReachable(url) })),
  )
  outcomes.sort((a, b) => a.i - b.i)
  const ok = outcomes.filter(o => o.ok).map(o => o.url)
  const skipped = outcomes.filter(o => !o.ok).map(o => o.url)
  return { ok, skipped }
}

type SyncSiteResult = { site_id: string; site_name: string; success: boolean; error?: string }

/** Woo 端商品已删但本地仍保留 woo_product_id 时，PUT 会返回 invalid_id */
function isStaleWooProductIdError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('woocommerce_rest_product_invalid_id')
    || msg.includes('Invalid ID')
    || /"code"\s*:\s*"woocommerce_rest_product_invalid_id"/.test(msg)
  )
}

// 共用的同步逻辑；不可访问的图片写入 skipped_images，不阻塞其余字段
async function syncProductToSites(
  product: any,
  siteIds?: string[],
): Promise<{ results: SyncSiteResult[]; skipped_images: string[] }> {
  const db = getDb()
  let sites: any[]
  if (siteIds && siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',')
    sites = db.all(`SELECT * FROM sites WHERE status = 'active' AND id IN (${placeholders})`, siteIds)
  } else {
    sites = db.all("SELECT * FROM sites WHERE status = 'active'") as any[]
  }

  const rawImages = JSON.parse(product.images || '[]') as string[]
  const trimmed = rawImages.map((s) => String(s).trim()).filter(Boolean)
  const { ok: imageSrcs, skipped: skipped_images } = await filterReachableImageUrls(trimmed)

  const basePayload = {
    name: product.name,
    sku: product.sku,
    regular_price: String(product.regular_price || 0),
    sale_price: product.sale_price ? String(product.sale_price) : '',
    short_description: product.short_description || '',
    description: product.description || '',
    images: imageSrcs.map((src: string) => ({ src })),
    tags: JSON.parse(product.tags || '[]').map((t: string) => ({ name: t })),
    status: product.status === 1 ? 'publish' : 'draft',
  }

  const results: SyncSiteResult[] = []

  for (const site of sites) {
    const wooSite: WooSite = { url: site.url, consumer_key: site.consumer_key, consumer_secret: site.consumer_secret }
    const categoryCache = new Map<string, number>()
    let categories: { id: number }[] = []
    if (product.category && String(product.category).trim()) {
      try {
        const cid = await resolveProductCategoryId(wooSite, String(product.category), categoryCache)
        if (cid != null) categories = [{ id: cid }]
      } catch (err: any) {
        db.run(
          `INSERT INTO product_sync (product_id, site_id, sync_status, error)
           VALUES (?, ?, 'failed', ?)
           ON CONFLICT(product_id, site_id) DO UPDATE SET sync_status = 'failed', error = ?`,
          [product.id, site.id, err.message, err.message]
        )
        results.push({ site_id: site.id, site_name: site.name, success: false, error: `Woo 分类: ${err.message}` })
        continue
      }
    }

    const wooProduct = { ...basePayload, categories }

    try {
      const existing = db.get('SELECT * FROM product_sync WHERE product_id = ? AND site_id = ?', [product.id, site.id]) as any

      let wooId: number
      if (existing?.woo_product_id) {
        try {
          const updated = await updateProduct(wooSite, existing.woo_product_id, wooProduct)
          wooId = updated.id!
        } catch (e) {
          if (!isStaleWooProductIdError(e)) throw e
          agentLog({
            hypothesisId: 'H-stale-woo-id',
            location: 'products.ts:syncProductToSites',
            message: 'stale woo_product_id, fallback sku or create',
            data: { sku: product.sku, staleWooId: existing.woo_product_id, site_id: site.id },
          })
          const found = await findProductBySku(wooSite, product.sku)
          if (found?.id) {
            const updated = await updateProduct(wooSite, found.id, wooProduct)
            wooId = updated.id!
          } else {
            const created = await createProduct(wooSite, wooProduct)
            wooId = created.id!
          }
        }
      } else {
        const found = await findProductBySku(wooSite, product.sku)
        if (found?.id) {
          const updated = await updateProduct(wooSite, found.id, wooProduct)
          wooId = updated.id!
        } else {
          const created = await createProduct(wooSite, wooProduct)
          wooId = created.id!
        }
      }

      db.run(
        `INSERT INTO product_sync (product_id, site_id, woo_product_id, sync_status, last_synced_at, error)
         VALUES (?, ?, ?, 'synced', ?, NULL)
         ON CONFLICT(product_id, site_id) DO UPDATE SET woo_product_id = ?, sync_status = 'synced', last_synced_at = ?, error = NULL`,
        [product.id, site.id, wooId, now(), wooId, now()]
      )
      results.push({ site_id: site.id, site_name: site.name, success: true })
    } catch (err: any) {
      db.run(
        `INSERT INTO product_sync (product_id, site_id, sync_status, error)
         VALUES (?, ?, 'failed', ?)
         ON CONFLICT(product_id, site_id) DO UPDATE SET sync_status = 'failed', error = ?`,
        [product.id, site.id, err.message, err.message]
      )
      results.push({ site_id: site.id, site_name: site.name, success: false, error: err.message })
    }
  }

  return { results, skipped_images }
}
