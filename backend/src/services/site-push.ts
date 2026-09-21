/**
 * 中台 → 站点 全自动推送（包 3 核心）
 *
 * 对应需求：
 *   C1  商品变更后**自动推**到所有站点，不再需要人工点按钮
 *   A8  推「共同部分」：名称、图片、描述、编号、价格、库存、分类、标签，一律照抄供应商。
 *       **各站自己的副标题 short_description 不碰**
 *   A9  价格单独拎出来：`product_site_price(product_id, site_id, price)`，有值用它、没值用商品默认价
 *   A6  库存跟着供应商走：`products.in_stock` 是唯一来源，只有「有货 / 缺货」两态
 *   A5  供应商下架（中台还留着这条）→ 站上转「**售罄**」：status 保持 publish（页面保留），
 *       stock_status 置 outofstock，**绝不删除、绝不进回收站**
 *   A15 每次核对对齐供应商清单：中台有而站上没有 → 补上并上架；
 *       站上多出来的（供应商没有的编号 / 重复旧页）→ **改成草稿**，不删除
 *   A10 每次改价 / 上架 / 下架 / 改库存都留痕（product_change_log）
 *   护栏 2  同一商品对同一站点连续失败 N 次（默认 3）就停下不再推，并记录原因
 *   A13 已下架（售罄）商品的描述末尾追加「同类还在卖的商品」入口；
 *       用标记注释包住，推之前先剥旧的 → 推 N 次结果一致（幂等）
 *   护栏 2 联动  供应商**素材**连续同步失败被 `isSkuStopped()` 判停的商品，
 *       推送入口先摘掉、并留痕说明（与上面「推送失败 3 次停推」是两套，互不干扰）
 *
 * 硬约束：
 *   - 本模块**只写站点侧**；中台 products 表由 supplier-sync / 路由负责。
 *   - 不许删除站点上的任何商品（A5）。
 */

import { getDb, type DbWrapper } from '../db/index.js'
import {
  createProduct,
  fetchAllProducts,
  findProductBySku,
  resolveProductCategoryId,
  resolveProductTagId,
  searchProductsBySku,
  updateProduct,
  type WooProduct,
  type WooSite,
} from './woo-client.js'
// A13 的同类入口内容 + 护栏 2 联动的素材停推名单（daily-report 只读，本模块不改它）
import { buildSoldOutCrossSell, getStoppedSkus } from './daily-report.js'
import { ensureSkuAssetsOnServer, openAssetUploadSession } from './asset-upload.js'

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 护栏 2：连续失败多少次后停止再推 */
export const MAX_CONSECUTIVE_FAILURES = Math.max(
  1,
  Number(process.env.SITE_PUSH_MAX_FAILURES || 3),
)

/** C1：变更后合并多久再推（把同一秒内的多次改动并成一次） */
const AUTO_PUSH_DEBOUNCE_MS = Math.max(50, Number(process.env.SITE_PUSH_DEBOUNCE_MS || 1500))

/** A15：周期一致性核对间隔，默认 6 小时 */
export const RECONCILE_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.SITE_PUSH_RECONCILE_INTERVAL_MS || 6 * 60 * 60 * 1000),
)

/** 单张远程图可访问性预检的超时（与 products.ts 原逻辑一致） */
const IMAGE_PREFLIGHT_TIMEOUT_MS = 15_000

/** 留痕里超长文本（描述）截断长度 */
const LOG_VALUE_MAX = 300

function nowIso(): string {
  return new Date().toISOString()
}

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function truncate(value: unknown, max = LOG_VALUE_MAX): string | null {
  if (value === null || value === undefined) return null
  const text = String(value)
  return text.length > max ? `${text.slice(0, max)}…(共 ${text.length} 字符)` : text
}

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface CentralProduct {
  id: string
  sku: string
  name: string
  description: string | null
  regular_price: number | null
  sale_price: number | null
  images: string | null
  status: number | null
  in_stock: number | null
  category: string | null
  tags: string | null
}

interface SiteRow {
  id: string
  name: string
  url: string
  consumer_key: string
  consumer_secret: string
  status: string
}

export type PushAction = 'created' | 'updated' | 'blocked' | 'failed' | 'skipped'

export interface PushChange {
  change_type: string
  field: string | null
  before: string | null
  after: string | null
}

export interface SitePushItemResult {
  product_id: string
  sku: string
  site_id: string
  site_name: string
  success: boolean
  action: PushAction
  /** 站点侧商品 id（新建或更新后的） */
  woo_product_id?: number | null
  error?: string
  changes: PushChange[]
}

export interface SitePushRunResult {
  products: number
  sites: number
  created: number
  updated: number
  skipped: number
  failed: number
  blocked: number
  /** 护栏 2 联动：因素材连续同步失败被摘掉、本轮压根没推的商品数 */
  skipped_media: number
  /** 被摘掉的那些 sku（留痕见 product_change_log.change_type='skip_media_stopped'） */
  skipped_media_skus: string[]
  changes: number
  skipped_images: string[]
  errors: string[]
  items: SitePushItemResult[]
}

export interface SitePushOptions {
  /** 只推这些站点；不传 = 所有 active 站点 */
  siteIds?: string[]
  /** 留痕来源：manual | supplier_sync | auto | reconcile | backfill */
  source?: string
  /** 只补站点上缺的（A15 一致性核对用） */
  onlyMissing?: boolean
  /** 是否跳过被护栏 2 停掉的商品（默认 true；核对时也是 true） */
  respectBlocklist?: boolean
}

// ---------------------------------------------------------------------------
// A9：分站价格
// ---------------------------------------------------------------------------

export interface ResolvedPrice {
  regular: string
  sale: string
  /** site = 用了分站价；default = 用商品默认价 */
  source: 'site' | 'default'
}

/**
 * 解析某站点该用哪个价（A9）。
 * - `product_site_price` 有该 (商品, 站点) 且 price 非空 → 用它当唯一售价（regular_price=该价，sale_price 清空）
 * - 否则 → 用商品默认价（regular_price + sale_price 原样）
 */
export function resolveSitePrice(
  db: DbWrapper,
  product: Pick<CentralProduct, 'id' | 'regular_price' | 'sale_price'>,
  siteId: string,
): ResolvedPrice {
  const row = db.get('SELECT price FROM product_site_price WHERE product_id = ? AND site_id = ?', [
    product.id,
    siteId,
  ]) as { price: number | null } | undefined

  const sitePrice = row?.price
  if (sitePrice !== null && sitePrice !== undefined && Number.isFinite(Number(sitePrice))) {
    return { regular: String(Number(sitePrice)), sale: '', source: 'site' }
  }
  return {
    regular: String(Number(product.regular_price ?? 0)),
    sale: product.sale_price ? String(Number(product.sale_price)) : '',
    source: 'default',
  }
}

// ---------------------------------------------------------------------------
// A5 / A6：库存与上下架 → 站点侧两态
// ---------------------------------------------------------------------------

/**
 * 中台商品行 → 站点侧「共同部分」载荷（A8）。
 *
 * 分类 / 标签在 pushOne 里按站点解析成 term id 后再补上。
 * 故意**不放** short_description —— 那是各站自己的副标题。
 */
export function buildSitePayload(
  product: CentralProduct,
  price: ResolvedPrice,
  imageSrcs: string[],
): WooProduct {
  // A5：供应商下架（中台 status=0）→ 站点上「售罄」，页面保留。
  // 中台清单里的商品：status 恒为 publish（售罄只靠 stock_status）。
  // 站上多出来、不在中台清单里的，由 reconcileSites 改成草稿，不在这里处理。
  const delisted = Number(product.status) !== 1
  const inStock = Number(product.in_stock) === 1 && !delisted

  return {
    name: product.name,
    sku: product.sku,
    description: product.description || '',
    images: imageSrcs.map((src) => ({ src })),
    regular_price: price.regular,
    sale_price: price.sale,
    stock_status: inStock ? 'instock' : 'outofstock',
    manage_stock: false,
    status: 'publish',
  }
}

/** 中台 category / tags：单个名字、逗号分隔，或 JSON 数组 */
export function parseNameList(raw: string | null | undefined): string[] {
  const text = String(raw ?? '').trim()
  if (!text || text === '[]') return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean)
    }
  } catch {
    /* 普通字符串 */
  }
  return text
    .split(/\s*(?:\/|,)\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function termNameKey(name: string): string {
  return name.trim().toLowerCase()
}

async function attachSupplierTaxonomy(
  site: WooSite,
  product: CentralProduct,
  payload: WooProduct,
  caches: { categories: Map<string, number>; tags: Map<string, number> },
): Promise<void> {
  const categories: Array<{ id: number }> = []
  for (const name of parseNameList(product.category)) {
    const id = await resolveProductCategoryId(site, name, caches.categories)
    if (id) categories.push({ id })
  }
  const tags: Array<{ id: number }> = []
  for (const name of parseNameList(product.tags)) {
    const id = await resolveProductTagId(site, name, caches.tags)
    if (id) tags.push({ id })
  }
  payload.categories = categories
  payload.tags = tags
}

// ---------------------------------------------------------------------------
// A13：售罄商品描述末尾追加「同类还在卖的商品」入口（幂等）
// ---------------------------------------------------------------------------

/** 标记注释：包住 A13 追加的那一段。推之前先按它剥掉旧的，所以推多少次都只有一段 */
export const CROSS_SELL_START = '<!-- vault-crosssell:start -->'
export const CROSS_SELL_END = '<!-- vault-crosssell:end -->'

/** A13 一个售罄商品最多放几个同类商品 */
const CROSS_SELL_LIMIT = Math.min(
  12,
  Math.max(1, Number(process.env.SITE_PUSH_CROSS_SELL_LIMIT || 4)),
)

/**
 * 把描述里**我们追加过的**同类入口整段剥掉，还原成中台原文。
 *
 * 幂等的关键：每次推送都是「先剥旧、再按当前状态决定加不加」，
 * 所以第二次推同样的内容不会变成两段。
 *
 * 三道兜底（站点侧可能把 HTML 注释过滤掉，只留 div）：
 *   1. 带 `\n\n` 分隔符 + 标记注释的整段（正常情况，连分隔符一起还原）
 *   2. 只剩标记注释的整段（中台原文为空时不会有分隔符）
 *   3. 注释被站点侧过滤掉、只剩我们那个 div 的情况（按 class 名兜底）
 */
export function stripCrossSellBlock(description: string | null | undefined): string {
  let out = String(description ?? '')
  out = out.replace(/\n\n<!-- vault-crosssell:start -->[\s\S]*?<!-- vault-crosssell:end -->/g, '')
  out = out.replace(/<!-- vault-crosssell:start -->[\s\S]*?<!-- vault-crosssell:end -->/g, '')
  out = out.replace(/\n\n<div class="vault-same-category">[\s\S]*?<\/div>/g, '')
  out = out.replace(/<div class="vault-same-category">[\s\S]*?<\/div>/g, '')
  return out
}

/**
 * A13：算出这条商品最终该发过去的描述。
 *
 * - `block` 有值（已下架且有同类在售）→ 原文 + 空行 + 标记包住的同类入口
 * - `block` 为 null（在售商品，或已下架但一个同类都挑不出来）→ 只有原文
 *
 * ⚠️ 只动 description。short_description 是各站自己的内容，A8 明令不许碰。
 */
export function applyCrossSellToDescription(
  description: string | null | undefined,
  block: { html: string } | null,
): string {
  const base = stripCrossSellBlock(description)
  if (!block || !block.html) return base
  const wrapped = `${CROSS_SELL_START}\n${block.html}\n${CROSS_SELL_END}`
  return base ? `${base}\n\n${wrapped}` : wrapped
}

/**
 * A13：给「已下架」商品算一份同类入口内容（只读，不写库）。
 * 生成失败不影响主推送 —— 降级成「这次不加」，绝不让 A13 把推送整个搞挂。
 */
function crossSellBlockFor(product: CentralProduct, site: SiteRow): { html: string } | null {
  try {
    return buildSoldOutCrossSell(product.id, {
      siteBaseUrl: site.url,
      siteId: site.id,
      limit: CROSS_SELL_LIMIT,
    })
  } catch (err) {
    console.warn(
      `[站点推送] A13 同类入口生成失败（${product.sku}@${site.name}）：${detailOf(err)}`,
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// 图片可访问性预检（沿用 products.ts 原行为，SYNC_SKIP_IMAGE_PREFLIGHT=1 可关）
// ---------------------------------------------------------------------------

async function isImageUrlReachable(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(IMAGE_PREFLIGHT_TIMEOUT_MS),
    })
    if (res.ok) return true
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(IMAGE_PREFLIGHT_TIMEOUT_MS),
        headers: { Range: 'bytes=0-0' },
      })
    }
    return res.ok
  } catch {
    return false
  }
}

export async function filterReachableImageUrls(
  urls: string[],
): Promise<{ ok: string[]; skipped: string[] }> {
  if (urls.length === 0) return { ok: [], skipped: [] }
  if (process.env.SYNC_SKIP_IMAGE_PREFLIGHT === '1') return { ok: [...urls], skipped: [] }
  const outcomes = await Promise.all(
    urls.map(async (url, i) => ({ i, url, ok: await isImageUrlReachable(url) })),
  )
  outcomes.sort((a, b) => a.i - b.i)
  return {
    ok: outcomes.filter((o) => o.ok).map((o) => o.url),
    skipped: outcomes.filter((o) => !o.ok).map((o) => o.url),
  }
}

// ---------------------------------------------------------------------------
// A10：留痕
// ---------------------------------------------------------------------------

export function logProductChange(
  db: DbWrapper,
  entry: {
    product_id: string | null
    sku: string | null
    site_id: string | null
    site_name: string | null
    change_type: string
    field: string | null
    before: unknown
    after: unknown
    source: string
    note?: string | null
  },
): void {
  db.run(
    `INSERT INTO product_change_log
       (product_id, sku, site_id, site_name, change_type, field, before_value, after_value, source, note, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.product_id,
      entry.sku,
      entry.site_id,
      entry.site_name,
      entry.change_type,
      entry.field,
      truncate(entry.before),
      truncate(entry.after),
      entry.source,
      entry.note ?? null,
      nowIso(),
    ],
  )
}

// ---------------------------------------------------------------------------
// 站点侧「推前 / 推后」差异 → 留痕条目
// ---------------------------------------------------------------------------

function diffAgainstSite(
  product: CentralProduct,
  payload: WooProduct,
  existing: WooProduct | null,
): PushChange[] {
  if (!existing) {
    return [
      {
        change_type: 'create',
        field: null,
        before: null,
        after: `${payload.name}（${payload.regular_price}）`,
      },
    ]
  }

  const changes: PushChange[] = []
  const delisted = Number(product.status) !== 1

  if (String(existing.regular_price ?? '') !== payload.regular_price) {
    changes.push({
      change_type: 'price',
      field: 'regular_price',
      before: existing.regular_price ?? '',
      after: payload.regular_price ?? '',
    })
  }
  if (String(existing.sale_price ?? '') !== payload.sale_price) {
    changes.push({
      change_type: 'price',
      field: 'sale_price',
      before: existing.sale_price ?? '',
      after: payload.sale_price ?? '',
    })
  }
  if (String(existing.stock_status ?? '') !== payload.stock_status) {
    const type = delisted
      ? 'delist'
      : payload.stock_status === 'instock'
        ? 'restore'
        : 'stock'
    changes.push({
      change_type: type,
      field: 'stock_status',
      before: existing.stock_status ?? '',
      after: payload.stock_status ?? '',
    })
  }
  if (String(existing.status ?? '') !== String(payload.status)) {
    changes.push({
      change_type: payload.status === 'publish' ? 'publish' : 'delist',
      field: 'status',
      before: existing.status ?? '',
      after: payload.status ?? '',
    })
  }
  if (String(existing.name ?? '') !== String(payload.name)) {
    changes.push({ change_type: 'content', field: 'name', before: existing.name ?? '', after: payload.name })
  }
  if (String(existing.description ?? '') !== String(payload.description)) {
    changes.push({
      change_type: 'content',
      field: 'description',
      before: existing.description ?? '',
      after: payload.description ?? '',
    })
  }
  const beforeImgs = (existing.images || []).map((i) => i.src).join('\n')
  const afterImgs = (payload.images || []).map((i) => i.src).join('\n')
  if (beforeImgs !== afterImgs) {
    changes.push({
      change_type: 'content',
      field: 'images',
      before: `${(existing.images || []).length} 张`,
      after: `${(payload.images || []).length} 张`,
    })
  }
  const wantCats = parseNameList(product.category).map(termNameKey).sort().join('|')
  const haveCats = (existing.categories || [])
    .map((c) => termNameKey(c.name || ''))
    .filter(Boolean)
    .sort()
    .join('|')
  if (wantCats !== haveCats) {
    changes.push({
      change_type: 'content',
      field: 'category',
      before: haveCats || '（无）',
      after: wantCats || '（无）',
    })
  }
  const wantTags = parseNameList(product.tags).map(termNameKey).sort().join('|')
  const haveTags = (existing.tags || [])
    .map((t) => termNameKey(t.name || ''))
    .filter(Boolean)
    .sort()
    .join('|')
  if (wantTags !== haveTags) {
    changes.push({
      change_type: 'content',
      field: 'tags',
      before: haveTags || '（无）',
      after: wantTags || '（无）',
    })
  }
  return changes
}

// ---------------------------------------------------------------------------
// 护栏 2：失败计数 / 停推 / 解除
// ---------------------------------------------------------------------------

interface SyncRow {
  woo_product_id: number | null
  fail_count: number
  blocked: number
}

function readSyncRow(db: DbWrapper, productId: string, siteId: string): SyncRow {
  const row = db.get(
    'SELECT woo_product_id, COALESCE(fail_count, 0) AS fail_count, COALESCE(blocked, 0) AS blocked FROM product_sync WHERE product_id = ? AND site_id = ?',
    [productId, siteId],
  ) as SyncRow | undefined
  return row ?? { woo_product_id: null, fail_count: 0, blocked: 0 }
}

function markSynced(
  db: DbWrapper,
  productId: string,
  siteId: string,
  wooId: number,
  action: PushAction,
): void {
  db.run(
    `INSERT INTO product_sync (product_id, site_id, woo_product_id, sync_status, last_synced_at, error, fail_count, blocked, blocked_reason, blocked_at, last_action)
     VALUES (?, ?, ?, 'synced', ?, NULL, 0, 0, NULL, NULL, ?)
     ON CONFLICT(product_id, site_id) DO UPDATE SET
       woo_product_id = ?, sync_status = 'synced', last_synced_at = ?, error = NULL,
       fail_count = 0, blocked = 0, blocked_reason = NULL, blocked_at = NULL, last_action = ?`,
    [productId, siteId, wooId, nowIso(), action, wooId, nowIso(), action],
  )
}

/**
 * 护栏 2：记一次失败；达到阈值就把该 (商品, 站点) 停掉。
 *
 * `forceBlocked` 给「重试多少次都是同一个结果」的那类用（见 `SkuOccupiedError`）——
 * 直接判停，不用等攒够 3 次。
 */
function markFailed(
  db: DbWrapper,
  productId: string,
  siteId: string,
  message: string,
  forceBlocked = false,
): { failCount: number; blocked: boolean } {
  const prev = readSyncRow(db, productId, siteId)
  const failCount = Number(prev.fail_count || 0) + 1
  const blocked = forceBlocked || failCount >= MAX_CONSECUTIVE_FAILURES
  db.run(
    `INSERT INTO product_sync (product_id, site_id, sync_status, error, fail_count, blocked, blocked_reason, blocked_at, last_action)
     VALUES (?, ?, 'failed', ?, ?, ?, ?, ?, 'failed')
     ON CONFLICT(product_id, site_id) DO UPDATE SET
       sync_status = 'failed', error = ?, fail_count = ?, blocked = ?, blocked_reason = ?, blocked_at = ?, last_action = 'failed'`,
    [
      productId,
      siteId,
      message,
      failCount,
      blocked ? 1 : 0,
      blocked ? message : null,
      blocked ? nowIso() : null,
      message,
      failCount,
      blocked ? 1 : 0,
      blocked ? message : null,
      blocked ? nowIso() : null,
    ],
  )
  return { failCount, blocked }
}

/** 解除某商品（可指定站点）的停推状态；返回被解除的条数 */
export function resetProductBlock(productId: string, siteId?: string): number {
  const db = getDb()
  const where = siteId
    ? 'WHERE product_id = ? AND site_id = ?'
    : 'WHERE product_id = ?'
  const params = siteId ? [productId, siteId] : [productId]
  const before = db.get(
    `SELECT COUNT(*) AS c FROM product_sync ${where} AND blocked = 1`,
    params,
  ) as { c: number } | undefined
  db.run(
    `UPDATE product_sync SET blocked = 0, fail_count = 0, blocked_reason = NULL, blocked_at = NULL ${where}`,
    params,
  )
  return Number(before?.c ?? 0)
}

// ---------------------------------------------------------------------------
// Woo 侧：PUT 时商品已被删（invalid_id）→ 退回按 sku 找或新建
// ---------------------------------------------------------------------------

function isStaleWooProductIdError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('woocommerce_rest_product_invalid_id') ||
    msg.includes('Invalid ID') ||
    /"code"\s*:\s*"woocommerce_rest_product_invalid_id"/.test(msg)
  )
}

// ---------------------------------------------------------------------------
// G6-6 ②：站点说「这个编号已经被占着了」——不是失败，是「这条商品站点上已经有了」
//
// 真 Woo 有两种文案，都要认：
//   ① woocommerce_rest_product_not_created
//      "The product with SKU (VC001) you are trying to insert is already present in the lookup table"
//   ② product_invalid_sku
//      "Invalid or duplicated SKU."
// ---------------------------------------------------------------------------

/** 站点侧说「这个编号已经被占了」 */
function isSkuTakenError(err: unknown): boolean {
  const msg = detailOf(err)
  return (
    msg.includes('woocommerce_rest_product_not_created') ||
    msg.includes('already present in the lookup table') ||
    msg.includes('product_invalid_sku') ||
    msg.includes('Invalid or duplicated SKU')
  )
}

/** 从错误文本里抠出「站点上被占着的那个编号」（报错原文里通常带着它） */
function skuFromTakenError(err: unknown): string | null {
  const msg = detailOf(err)
  const byMessage = msg.match(/SKU\s*\(([^)]+)\)/)
  if (byMessage) return byMessage[1].trim()
  const byJson = msg.match(/"unique_sku"\s*:\s*"([^"]+)"/)
  return byJson ? byJson[1].trim() : null
}

/**
 * G6-6②：「站点上这个编号被占着，但按编号又查不到商品」。
 *
 * 真 Woo 的原话是
 *   The product with SKU (VC001) you are trying to insert is already present in the lookup table
 * ——「lookup table」是站点自己的一张**编号索引表**。
 * 这句话 + 按编号查不到，两条合起来只可能是：那张表里留着一条**指向已不存在商品**的废记录。
 * 这种站点侧的历史垃圾，**从接口这头修不了**，只能在 WordPress 后台清。
 *
 * 所以单独归一类：不再当成「普通失败」反复重试（重试一万次也是同一个结果），
 * 而是直接判停 + 写清「要人工处理哪几个编号」。
 */
class SkuOccupiedError extends Error {
  readonly sku: string
  constructor(sku: string, original: string) {
    super(original)
    this.name = 'SkuOccupiedError'
    this.sku = sku
  }
}

/** 站点抓不到某张图（远端图挂了 / 过期了） */
function isImageUploadError(err: unknown): boolean {
  const msg = detailOf(err)
  return (
    msg.includes('woocommerce_product_image_upload_error') ||
    msg.includes('Error getting remote image')
  )
}

/** 从错误文本里抠出「抓不到的那张图」的地址 */
function imageUrlFromError(err: unknown): string | null {
  const msg = detailOf(err)
  const m = msg.match(/remote image\s+(\S+?)(?:\.\s|\s+Error|"|$)/)
  if (!m) return null
  return m[1].replace(/\\\//g, '/').trim() || null
}

/**
 * 按编号找站点上的商品（放宽版）——比 `findProductBySku` 多两手：
 *   ① 再查一次（偶发的查询失败）
 *   ② 换关键词搜一遍，按返回体里的 `sku` 精确比对（绕过站点那张会残留旧编号的索引表）
 */
async function findProductBySkuLoose(site: WooSite, sku: string): Promise<WooProduct | null> {
  const wanted = String(sku || '').trim()
  if (!wanted) return null
  try {
    const first = await findProductBySku(site, wanted)
    if (first?.id) return first
  } catch {
    // 查询本身失败 → 继续往下试
  }
  try {
    return await searchProductsBySku(site, wanted)
  } catch {
    return null
  }
}

/** 一张图抓不到时，最多摘掉几张再放弃（防止把整个商品的图全摘光） */
const IMAGE_FALLBACK_MAX_DROP = 3

/**
 * 写站点（新建 / 更新都走这里）：
 * 站点报「某张图抓不到」时，把那张图摘掉再试一次。
 * 一张图挂掉不该让整个商品推不上去。
 *
 * 返回实际摘掉的图片地址，供留痕说明「少推了哪张图」。
 */
async function writeProductWithImageFallback(
  site: WooSite,
  payload: WooProduct,
  wooId: number | null,
): Promise<{ product: WooProduct; droppedImages: string[] }> {
  const droppedImages: string[] = []
  for (;;) {
    try {
      const product =
        wooId === null
          ? await createProduct(site, payload)
          : await updateProduct(site, wooId, payload)
      return { product, droppedImages }
    } catch (err) {
      if (droppedImages.length >= IMAGE_FALLBACK_MAX_DROP || !isImageUploadError(err)) throw err
      const list = payload.images || []
      if (list.length === 0) throw err
      const bad = imageUrlFromError(err)
      const target =
        (bad ? list.find((i) => String(i.src).includes(bad) || bad.includes(String(i.src))) : undefined) ||
        list[0]
      payload.images = list.filter((i) => i !== target)
      droppedImages.push(String(target.src))
      console.warn(`[站点推送] 站点抓不到这张图，摘掉重试：${target.src}`)
    }
  }
}

// ---------------------------------------------------------------------------
// 单商品 × 单站点
// ---------------------------------------------------------------------------

async function pushOne(
  db: DbWrapper,
  product: CentralProduct,
  site: SiteRow,
  options: {
    source: string
    imageSrcs: string[]
    respectBlocklist: boolean
    categoryCache: Map<string, number>
    tagCache: Map<string, number>
  },
): Promise<SitePushItemResult> {
  const base: Omit<SitePushItemResult, 'success' | 'action' | 'changes'> = {
    product_id: product.id,
    sku: product.sku,
    site_id: site.id,
    site_name: site.name,
  }

  const sync = readSyncRow(db, product.id, site.id)
  if (options.respectBlocklist && Number(sync.blocked) === 1) {
    return {
      ...base,
      success: false,
      action: 'blocked',
      woo_product_id: sync.woo_product_id,
      error: '连续失败已达上限，已停止推送（护栏 2）',
      changes: [],
    }
  }

  const wooSite: WooSite = {
    url: site.url,
    consumer_key: site.consumer_key,
    consumer_secret: site.consumer_secret,
  }
  const price = resolveSitePrice(db, product, site.id)
  const payload = buildSitePayload(product, price, options.imageSrcs)

  try {
    await attachSupplierTaxonomy(wooSite, product, payload, {
      categories: options.categoryCache,
      tags: options.tagCache,
    })

    // A13：已下架（售罄）商品的描述末尾追加「同类还在卖的商品」入口。
    // 在售商品不加（并且会把历史遗留的那段剥掉），保证推 N 次结果一致。
    const crossSell = Number(product.status) !== 1 ? crossSellBlockFor(product, site) : null
    payload.description = applyCrossSellToDescription(payload.description, crossSell)

    // 站点侧现有商品：按 sku 查（真 Woo 的 sku 是唯一键，比本地记的 id 更可靠）
    let existing: WooProduct | null = await findProductBySku(wooSite, product.sku)

    // G6-6 ②：「建」被拒、改成「改」时记下接手的是哪条（编号可能和站点上的不一样）
    let adoptedFrom: { wooId: number; skuOnSite: string } | null = null
    let wooId: number | null = existing?.id ?? null
    let wrote = false
    const droppedImages: string[] = []

    if (!existing) {
      try {
        const { product: created, droppedImages: dropped } = await writeProductWithImageFallback(
          wooSite,
          payload,
          null,
        )
        droppedImages.push(...dropped)
        wooId = created.id ?? null
        wrote = true
      } catch (err) {
        // G6-6 ②：站点说这个编号已经被占着了 —— 这不是失败，是「这条商品站点上已经有了」。
        // 多半是编号被改过，或者站点那张编号索引表里留了旧编号。
        // 正确做法：把它找出来，改成「更新」，而不是记一笔失败。
        if (!isSkuTakenError(err)) throw err

        const hinted = skuFromTakenError(err)
        const adopted =
          (await findProductBySkuLoose(wooSite, product.sku)) ||
          (hinted && hinted !== product.sku ? await findProductBySkuLoose(wooSite, hinted) : null)

        // 找得到才叫「已存在」，那就改成「更新」；
        // 真找不到 → 站点那张编号索引表里是条垃圾记录，从接口这头修不了，
        // 单独归一类（判停 + 写明要人工处理），不要当成普通失败反复重试。
        if (!adopted?.id) throw new SkuOccupiedError(product.sku, detailOf(err))

        existing = adopted
        adoptedFrom = { wooId: adopted.id, skuOnSite: String(adopted.sku ?? '').trim() || hinted || '' }
        wooId = adopted.id
      }
    }

    const changes = diffAgainstSite(product, payload, existing)
    const action: PushAction = existing ? 'updated' : 'created'

    // 接手过来的这条：只要站点上的编号和中台对不上，就得写一次把编号纠回来
    if (adoptedFrom) {
      if (adoptedFrom.skuOnSite !== product.sku) {
        changes.push({
          change_type: 'content',
          field: 'sku',
          before: adoptedFrom.skuOnSite || '（站点上没编号）',
          after: product.sku,
        })
      }
      if (changes.length > 0) {
        const { product: updated, droppedImages: dropped } = await writeProductWithImageFallback(
          wooSite,
          payload,
          adoptedFrom.wooId,
        )
        droppedImages.push(...dropped)
        wooId = updated.id ?? adoptedFrom.wooId
        wrote = true
      }
    } else if (existing && changes.length > 0) {
      try {
        const { product: updated, droppedImages: dropped } = await writeProductWithImageFallback(
          wooSite,
          payload,
          existing.id!,
        )
        droppedImages.push(...dropped)
        wooId = updated.id ?? existing.id ?? null
        wrote = true
      } catch (err) {
        if (!isStaleWooProductIdError(err)) throw err
        // 站点上这条 id 已失效（被人删了）→ 再按 sku 找一次，找不到就新建
        const again = await findProductBySku(wooSite, product.sku)
        const { product: updated, droppedImages: dropped } = await writeProductWithImageFallback(
          wooSite,
          payload,
          again?.id ?? null,
        )
        droppedImages.push(...dropped)
        wooId = updated.id ?? again?.id ?? null
        wrote = true
      }
    }

    if (wrote) {
      markSynced(db, product.id, site.id, wooId ?? 0, action)
      if (adoptedFrom) {
        // 摘掉「建」那一步误记的 create，换成真实的接手说明
        const idx = changes.findIndex((c) => c.change_type === 'create')
        if (idx >= 0) changes.splice(idx, 1)
        logProductChange(db, {
          product_id: product.id,
          sku: product.sku,
          site_id: site.id,
          site_name: site.name,
          change_type: 'content',
          field: 'sku',
          before: adoptedFrom.skuOnSite || '（站点上没编号）',
          after: product.sku,
          source: options.source,
          note: `站点上这个编号已被占用，改成更新已有商品（id ${adoptedFrom.wooId}），不再报失败`,
        })
      }
      if (droppedImages.length > 0) {
        logProductChange(db, {
          product_id: product.id,
          sku: product.sku,
          site_id: site.id,
          site_name: site.name,
          change_type: 'content',
          field: 'images',
          before: `${droppedImages.length} 张图站点抓不到`,
          after: '已跳过这几张，其余照常推',
          source: options.source,
          note: droppedImages.join('\n'),
        })
      }
      for (const c of changes) {
        logProductChange(db, {
          product_id: product.id,
          sku: product.sku,
          site_id: site.id,
          site_name: site.name,
          change_type: c.change_type,
          field: c.field,
          before: c.before,
          after: c.after,
          source: options.source,
        })
      }
    } else {
      // 无差异：只刷新时间戳，不写留痕（避免噪音）
      db.run(
        `INSERT INTO product_sync (product_id, site_id, woo_product_id, sync_status, last_synced_at, error, fail_count, blocked, last_action)
         VALUES (?, ?, ?, 'synced', ?, NULL, 0, 0, 'skipped')
         ON CONFLICT(product_id, site_id) DO UPDATE SET
           woo_product_id = COALESCE(?, woo_product_id), sync_status = 'synced', last_synced_at = ?,
           error = NULL, fail_count = 0, blocked = 0, blocked_reason = NULL, blocked_at = NULL, last_action = 'skipped'`,
        [product.id, site.id, wooId, nowIso(), wooId, nowIso()],
      )
    }

    return {
      ...base,
      success: true,
      action: wrote ? action : 'skipped',
      woo_product_id: wooId,
      changes,
    }
  } catch (err) {
    // G6-6②：站点那张编号索引表里留着一条指向已不存在商品的废记录 —— 重试多少次都一样，
    // 直接判停 + 把「要人工处理哪个编号」写清楚（文案给凯哥看的，不是给程序看的）。
    const occupied = err instanceof SkuOccupiedError ? err : null
    const message = occupied
      ? `站点上编号 ${occupied.sku} 被一条废记录占着（那条记录指向的商品已经不存在了），按编号查不到、也没法覆盖。需要到 WordPress 后台清一下这个编号。原文：${occupied.message}`
      : detailOf(err)
    const { failCount, blocked } = markFailed(db, product.id, site.id, message, Boolean(occupied))
    logProductChange(db, {
      product_id: product.id,
      sku: product.sku,
      site_id: site.id,
      site_name: site.name,
      change_type: 'push_failed',
      field: null,
      before: null,
      after: message,
      source: options.source,
      note: occupied
        ? `站点上这个编号被一条废记录占着，接口这头修不了 —— 已直接停下不再重试，等人工在 WordPress 后台清理编号「${occupied.sku}」`
        : blocked
        ? `连续失败 ${failCount} 次，已停止再推（护栏 2，上限 ${MAX_CONSECUTIVE_FAILURES}）`
        : `连续失败 ${failCount} 次（上限 ${MAX_CONSECUTIVE_FAILURES}）`,
    })
    return {
      ...base,
      success: false,
      action: blocked ? 'blocked' : 'failed',
      error: message,
      changes: [],
    }
  }
}

// ---------------------------------------------------------------------------
// 批量推送
// ---------------------------------------------------------------------------

function loadSites(db: DbWrapper, siteIds?: string[]): SiteRow[] {
  if (siteIds && siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',')
    return db.all(
      `SELECT id, name, url, consumer_key, consumer_secret, status FROM sites WHERE status = 'active' AND id IN (${placeholders})`,
      siteIds,
    ) as unknown as SiteRow[]
  }
  return db.all(
    "SELECT id, name, url, consumer_key, consumer_secret, status FROM sites WHERE status = 'active' ORDER BY created_at",
  ) as unknown as SiteRow[]
}

/** 推一批商品到站点（C1 的落点） */
export async function pushProductsToSites(
  productIds: string[],
  options: SitePushOptions = {},
): Promise<SitePushRunResult> {
  const db = getDb()
  const source = options.source || 'auto'
  const sites = loadSites(db, options.siteIds)

  const result: SitePushRunResult = {
    products: 0,
    sites: sites.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    blocked: 0,
    skipped_media: 0,
    skipped_media_skus: [],
    changes: 0,
    skipped_images: [],
    errors: [],
    items: [],
  }
  if (productIds.length === 0 || sites.length === 0) return result

  const placeholders = productIds.map(() => '?').join(',')
  const rows = db.all(
    `SELECT id, sku, name, description, regular_price, sale_price, images, status, in_stock, category, tags
     FROM products WHERE id IN (${placeholders}) ORDER BY sku COLLATE NOCASE`,
    productIds,
  ) as unknown as CentralProduct[]
  result.products = rows.length
  if (rows.length === 0) return result

  // 护栏 2 联动：供应商**素材**（图/视频）连续同步失败 → 内容可能是残缺的，别再往站上推。
  // 只摘这一类；「推送失败 3 次停推」那套护栏（product_sync.blocked）在 pushOne 里，原样不动。
  const stoppedSkus = new Set(getStoppedSkus().map((s) => String(s).trim()))
  const pushable: CentralProduct[] = []
  for (const row of rows) {
    if (!stoppedSkus.has(String(row.sku ?? '').trim())) {
      pushable.push(row)
      continue
    }
    result.skipped_media++
    result.skipped_media_skus.push(row.sku)
    // 留痕：跳过必须看得见，不能静默吞掉
    logProductChange(db, {
      product_id: row.id,
      sku: row.sku,
      site_id: null,
      site_name: null,
      change_type: 'skip_media_stopped',
      field: null,
      before: '待推送',
      after: '未推送',
      source,
      note: `供应商素材连续同步失败已停止（护栏 2），本轮跳过推送｜目标站点：${
        sites.map((s) => s.name).join('/') || '（无 active 站点）'
      }`,
    })
  }
  if (result.skipped_media > 0) {
    console.warn(
      `[站点推送] 因素材连续同步失败已停，跳过 ${result.skipped_media} 个商品：${result.skipped_media_skus.join(', ')}（来源 ${source}）`,
    )
  }
  if (pushable.length === 0) return result

  // 推之前先把本机已有、素材站还缺的图/视频补上去，否则预检会把图全摘掉。
  const uploadSession = await openAssetUploadSession()
  try {
    for (const row of pushable) {
      const up = await ensureSkuAssetsOnServer(row.sku, {
        client: uploadSession.client ?? undefined,
        cfg: uploadSession.cfg,
      })
      if (up.uploaded > 0) {
        console.log(`[站点推送] ${row.sku} 补传素材 ${up.uploaded} 个（失败 ${up.failed}）`)
      }
    }
  } finally {
    uploadSession.close()
  }

  // 图片预检：同一商品的图片对所有站点是同一批，算一次即可
  const imageCache = new Map<string, string[]>()
  for (const row of pushable) {
    let raw: string[] = []
    try {
      const parsed = JSON.parse(row.images || '[]')
      raw = Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean) : []
    } catch {
      raw = []
    }
    const { ok, skipped } = await filterReachableImageUrls(raw)
    imageCache.set(row.id, ok)
    if (skipped.length > 0) result.skipped_images.push(...skipped)
  }

  const respectBlocklist = options.respectBlocklist !== false
  const taxCache = new Map<string, { categories: Map<string, number>; tags: Map<string, number> }>()

  for (const row of pushable) {
    const imageSrcs = imageCache.get(row.id) || []
    for (const site of sites) {
      let cache = taxCache.get(site.id)
      if (!cache) {
        cache = { categories: new Map(), tags: new Map() }
        taxCache.set(site.id, cache)
      }
      const item = await pushOne(db, row, site, {
        source,
        imageSrcs,
        respectBlocklist,
        categoryCache: cache.categories,
        tagCache: cache.tags,
      })
      result.items.push(item)
      if (item.action === 'created') result.created++
      else if (item.action === 'updated') result.updated++
      else if (item.action === 'skipped') result.skipped++
      else if (item.action === 'blocked') result.blocked++
      else result.failed++
      result.changes += item.changes.length
      if (item.error) result.errors.push(`${row.sku}@${site.name}: ${item.error}`)
    }
  }

  return result
}

/** 推单个商品 */
export async function pushProductToSites(
  productId: string,
  options: SitePushOptions = {},
): Promise<SitePushRunResult> {
  return pushProductsToSites([productId], options)
}

// ---------------------------------------------------------------------------
// G5-2 #10：把「推送失败」的商品重推一遍
// ---------------------------------------------------------------------------

export interface RetryFailedPushReport extends SitePushRunResult {
  /** 本次重推的商品数 */
  retried: number
  /** 重推前失败的条数（商品 × 站点） */
  failed_before: number
  /** 重推后仍然失败的条数 */
  failed_after: number
  /** 重推后仍然失败的明细（给界面直接显示） */
  still_failing: Array<{ sku: string; site_name: string; error: string }>
}

/**
 * 重推所有「推失败」的商品。
 *
 * 与普通推送的区别：
 *   - 先把这些 (商品, 站点) 的失败计数和停推标记清掉（`resetProductBlock`），
 *     否则护栏 2 会把它们直接挡回来，按钮点了等于没点；
 *   - `respectBlocklist: false`，本次不看护栏。
 */
export async function retryFailedPushes(options: SitePushOptions = {}): Promise<RetryFailedPushReport> {
  const db = getDb()

  // ⚠️ 只认「商品还在的」那些行。
  // 库里实测有 1 条历史遗留（`product_sync.id=1` → 商品 `prod-34a1b011` 早就没了），
  // 它永远推不动、也不该算进「失败几个」里，否则界面上的数字对不上
  // （产品页按 `products` 表数，是 21；这里如果按 product_sync 数，就是 22）。
  const failedRows = db.all(
    `SELECT DISTINCT ps.product_id
       FROM product_sync ps
       JOIN products p ON p.id = ps.product_id
      WHERE ps.sync_status = 'failed'`,
  ) as unknown as Array<{ product_id: string }>
  const productIds = failedRows.map((r) => String(r.product_id)).filter(Boolean)

  const failedBefore = Number(
    (
      db.get(
        `SELECT COUNT(*) AS c
           FROM product_sync ps
           JOIN products p ON p.id = ps.product_id
          WHERE ps.sync_status = 'failed'`,
      ) as { c: number } | undefined
    )?.c ?? 0,
  )

  const empty: RetryFailedPushReport = {
    products: 0,
    sites: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    blocked: 0,
    skipped_media: 0,
    skipped_media_skus: [],
    changes: 0,
    skipped_images: [],
    errors: [],
    items: [],
    retried: 0,
    failed_before: failedBefore,
    failed_after: failedBefore,
    still_failing: [],
  }
  if (productIds.length === 0) return empty

  for (const id of productIds) {
    resetProductBlock(id)
  }

  const run = await pushProductsToSites(productIds, {
    ...options,
    source: options.source || 'retry_failed',
    respectBlocklist: false,
  })

  const still = db.all(
    `SELECT ps.error, p.sku, s.name AS site_name
       FROM product_sync ps
       JOIN products p ON p.id = ps.product_id
       LEFT JOIN sites s ON s.id = ps.site_id
      WHERE ps.sync_status = 'failed'`,
  ) as unknown as Array<{ sku: string | null; site_name: string | null; error: string | null }>

  return {
    ...run,
    retried: productIds.length,
    failed_before: failedBefore,
    failed_after: still.length,
    still_failing: still.map((r) => ({
      sku: String(r.sku ?? ''),
      site_name: String(r.site_name ?? ''),
      error: String(r.error ?? ''),
    })),
  }
}

// ---------------------------------------------------------------------------
// A15：一致性核对 —— 哪个站少了哪个商品，自动补齐
// ---------------------------------------------------------------------------

export interface ReconcileSiteReport {
  site_id: string
  site_name: string
  site_product_count: number
  central_product_count: number
  missing_skus: string[]
  extra_skus: string[]
  filled: number
  drafted: number
  republished: number
  failed: number
  error?: string
}

export interface ReconcileReport {
  /** 中台有 sku 的商品总数（含已停推的） */
  central_product_count: number
  /** 其中真正参与核对的（已剔掉「素材连续失败被停」的） */
  pushable_product_count: number
  /** 护栏 2 联动：因素材连续失败被停、不参与核对与补齐的 sku */
  excluded_media_stopped: string[]
  sites: ReconcileSiteReport[]
  total_missing: number
  total_extra: number
  total_filled: number
  total_drafted: number
  total_republished: number
  total_failed: number
  consistent: boolean
}

/** 同一编号在站上有多条时，留下哪一条继续上架 */
export function pickKeepWooId(
  candidates: Array<{ id?: number; status?: string; images?: unknown[] }>,
  preferredWooId: number | null,
): number | null {
  const usable = candidates.filter((c) => Number.isFinite(Number(c.id)))
  if (usable.length === 0) return null
  if (preferredWooId != null && usable.some((c) => Number(c.id) === preferredWooId)) {
    return preferredWooId
  }
  const rank = (status: string | undefined) => {
    if (status === 'publish') return 0
    if (status === 'private' || status === 'pending') return 1
    if (status === 'draft') return 2
    if (status === 'trash') return 4
    return 3
  }
  const sorted = [...usable].sort((a, b) => {
    const rs = rank(a.status) - rank(b.status)
    if (rs !== 0) return rs
    const ai = Array.isArray(a.images) ? a.images.length : 0
    const bi = Array.isArray(b.images) ? b.images.length : 0
    return bi - ai
  })
  return Number(sorted[0].id)
}

/**
 * 逐站对齐供应商清单：
 *   中台有、站上没有 → 补推上架
 *   中台有、站上是草稿 → 重新上架
 *   站上多出来（没有编号 / 编号不在中台 / 同一编号的重复旧页）→ 改成草稿，不删除
 * 已经对准的在售商品不在这里改内容（内容覆盖由 C1 的变更推送负责）。
 */
export async function reconcileSites(options: SitePushOptions = {}): Promise<ReconcileReport> {
  const db = getDb()
  const source = options.source || 'reconcile'
  const sites = loadSites(db, options.siteIds)

  const centralAll = db.all(
    "SELECT id, sku FROM products WHERE sku IS NOT NULL AND TRIM(sku) <> '' ORDER BY sku COLLATE NOCASE",
  ) as unknown as Array<{ id: string; sku: string }>

  // 护栏 2 联动：素材连续失败被停的商品不参与「缺了就补」的比对 ——
  // 否则每轮核对都会把它当「站点上缺了」，反复尝试推 + 留一堆误导性的 reconcile_fill。
  const stoppedSkus = new Set(getStoppedSkus().map((s) => String(s).trim()))
  const central = centralAll.filter((p) => !stoppedSkus.has(p.sku))
  const excludedMediaStopped = centralAll.filter((p) => stoppedSkus.has(p.sku)).map((p) => p.sku)
  const centralBySku = new Map(central.map((p) => [p.sku, p.id]))

  const report: ReconcileReport = {
    central_product_count: centralAll.length,
    pushable_product_count: central.length,
    excluded_media_stopped: excludedMediaStopped,
    sites: [],
    total_missing: 0,
    total_extra: 0,
    total_filled: 0,
    total_drafted: 0,
    total_republished: 0,
    total_failed: 0,
    consistent: true,
  }

  if (excludedMediaStopped.length > 0) {
    console.warn(
      `[站点推送] 核对时排除 ${excludedMediaStopped.length} 个「素材连续失败已停」的商品：${excludedMediaStopped.join(', ')}`,
    )
  }

  for (const site of sites) {
    const wooSite: WooSite = {
      url: site.url,
      consumer_key: site.consumer_key,
      consumer_secret: site.consumer_secret,
    }
    const siteReport: ReconcileSiteReport = {
      site_id: site.id,
      site_name: site.name,
      site_product_count: 0,
      central_product_count: central.length,
      missing_skus: [],
      extra_skus: [],
      filled: 0,
      drafted: 0,
      republished: 0,
      failed: 0,
    }

    try {
      const remote = await fetchAllProducts(wooSite)
      siteReport.site_product_count = remote.filter((p) => p.status === 'publish').length

      const preferredBySku = new Map<string, number>()
      const syncRows = db.all(
        'SELECT product_id, woo_product_id FROM product_sync WHERE site_id = ? AND woo_product_id IS NOT NULL',
        [site.id],
      ) as unknown as Array<{ product_id: string; woo_product_id: number }>
      for (const row of syncRows) {
        const sku = central.find((p) => p.id === row.product_id)?.sku
        if (sku && !preferredBySku.has(sku)) preferredBySku.set(sku, Number(row.woo_product_id))
      }

      const bySku = new Map<string, WooProduct[]>()
      for (const p of remote) {
        const sku = String(p.sku || '').trim()
        if (!sku) continue
        const list = bySku.get(sku) || []
        list.push(p)
        bySku.set(sku, list)
      }

      const keepIds = new Set<number>()
      const missing: Array<{ id: string; sku: string }> = []
      const republishIds = new Set<string>()

      for (const p of central) {
        const keepId = pickKeepWooId(bySku.get(p.sku) || [], preferredBySku.get(p.sku) ?? null)
        if (keepId == null) {
          missing.push(p)
          continue
        }
        keepIds.add(keepId)
        const kept = (bySku.get(p.sku) || []).find((c) => Number(c.id) === keepId)
        if (!kept) continue
        if (kept.status !== 'publish' || (kept.images || []).length === 0) {
          republishIds.add(p.id)
        }
      }

      const extras = remote.filter((p) => {
        if (p.id == null) return false
        if (keepIds.has(p.id)) return false
        if (p.status === 'trash' || p.status === 'draft') return false
        return true
      })
      siteReport.missing_skus = missing.map((p) => p.sku)
      siteReport.extra_skus = extras.map((p) => String(p.sku || '').trim() || `#${p.id}`)
      report.total_missing += missing.length
      report.total_extra += extras.length

      for (const extra of extras) {
        if (extra.id == null) continue
        try {
          await updateProduct(wooSite, extra.id, { status: 'draft' })
          siteReport.drafted++
          report.total_drafted++
          const sku = String(extra.sku || '').trim()
          logProductChange(db, {
            product_id: sku ? centralBySku.get(sku) ?? null : null,
            sku: sku || null,
            site_id: site.id,
            site_name: site.name,
            change_type: 'reconcile_draft',
            field: 'status',
            before: extra.status || 'publish',
            after: 'draft',
            source,
            note: extra.id ? `woo_id=${extra.id}` : null,
          })
        } catch (err) {
          siteReport.failed++
          report.total_failed++
          console.error(
            `[站点推送] 核对 ${site.name} 把多余商品改草稿失败（${extra.sku || extra.id}）：${detailOf(err)}`,
          )
        }
      }

      const toPush = [...missing.map((p) => p.id), ...republishIds]
      if (toPush.length > 0) {
        const out = await pushProductsToSites(toPush, {
          ...options,
          source,
          siteIds: [site.id],
          respectBlocklist: true,
        })
        siteReport.filled = out.created + out.updated
        siteReport.republished = republishIds.size
        siteReport.failed += out.failed + out.blocked
        report.total_filled += out.created + out.updated
        report.total_republished += republishIds.size
        report.total_failed += out.failed + out.blocked
        for (const sku of siteReport.missing_skus) {
          const pid = centralBySku.get(sku)
          if (pid) {
            logProductChange(db, {
              product_id: pid,
              sku,
              site_id: site.id,
              site_name: site.name,
              change_type: 'reconcile_fill',
              field: null,
              before: '站点上没有这个商品',
              after: '已补齐',
              source,
            })
          }
        }
      }

      const liveCount = siteReport.site_product_count - siteReport.drafted + siteReport.filled
      if (siteReport.failed > 0 || liveCount < central.length) {
        report.consistent = false
      }
    } catch (err) {
      siteReport.error = detailOf(err)
      report.consistent = false
      report.total_failed++
      console.error(`[站点推送] 核对 ${site.name} 失败：${siteReport.error}`)
    }

    report.sites.push(siteReport)
  }

  return report
}

// ---------------------------------------------------------------------------
// C1：自动推送队列（变更 → 合并 → 推送，不需要人工点按钮）
// ---------------------------------------------------------------------------

const pendingProductIds = new Set<string>()
let debounceTimer: NodeJS.Timeout | null = null
let queueSource = 'auto'
let inflight: Promise<SitePushRunResult | null> = Promise.resolve(null)

/** 商品变更后调用：把商品 id 丢进队列，去抖后自动推 */
export function enqueueSitePush(productIds: string[], source = 'auto'): void {
  let added = 0
  for (const raw of productIds) {
    const id = raw == null ? '' : String(raw).trim()
    if (!id) continue
    if (!pendingProductIds.has(id)) added++
    pendingProductIds.add(id)
  }
  if (added === 0) return
  queueSource = source
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushSitePushQueue()
  }, AUTO_PUSH_DEBOUNCE_MS)
  debounceTimer.unref?.()
}

/** 立刻把队列里攒的商品推出去（返回 null 表示队列是空的） */
export async function flushSitePushQueue(): Promise<SitePushRunResult | null> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (pendingProductIds.size === 0) return null
  const ids = [...pendingProductIds]
  pendingProductIds.clear()
  const source = queueSource

  // 串行化：上一次还在跑就排队等它
  inflight = inflight.then(async () => {
    try {
      const out = await pushProductsToSites(ids, { source })
      console.log(
        `[站点推送] 自动推送完成（${source}）：商品 ${out.products}｜站点 ${out.sites}｜新建 ${out.created}｜更新 ${out.updated}｜无变化 ${out.skipped}｜失败 ${out.failed}｜停推 ${out.blocked}｜素材停跳过 ${out.skipped_media}｜留痕 ${out.changes}`,
      )
      return out
    } catch (err) {
      console.error(`[站点推送] 自动推送异常：${detailOf(err)}`)
      return null
    }
  })
  return inflight
}

export function getPendingPushCount(): number {
  return pendingProductIds.size
}

// ---------------------------------------------------------------------------
// C1 兜底：变更侦测
// ---------------------------------------------------------------------------

/**
 * 兜住**所有**写 products 的路径。
 *
 * 路由（PUT/POST /items）、CSV 导入、供应商同步都会显式 enqueueSitePush()，
 * 但「商品变更后自动推」这条需求是对**任何**改动都成立的，所以这里再放一张网：
 * 每 N 秒扫一次 products.updated_at，凡是被改过的商品一律进队列。
 * 已经推过的商品不会产生重复写（pushOne 会先比对，没差异就跳过，不写留痕）。
 */
const WATCH_INTERVAL_MS = Math.max(1000, Number(process.env.SITE_PUSH_WATCH_INTERVAL_MS || 10_000))

/** id → 上次已入队的 updated_at */
const watchedUpdatedAt = new Map<string, string>()

/** 扫一遍变更；返回本次新发现变更的商品 id */
export function scanProductChanges(): string[] {
  const db = getDb()
  const rows = db.all('SELECT id, updated_at FROM products') as unknown as Array<{
    id: string
    updated_at: string | null
  }>
  const changed: string[] = []
  for (const row of rows) {
    const stamp = String(row.updated_at ?? '')
    if (watchedUpdatedAt.get(row.id) === stamp) continue
    watchedUpdatedAt.set(row.id, stamp)
    changed.push(row.id)
  }
  if (changed.length > 0) enqueueSitePush(changed, 'auto')
  return changed
}

/** 启动变更侦测（C1 兜底）。第一次扫描只建基线，不推。 */
export function startProductChangeWatcher(): void {
  const db = getDb()
  const rows = db.all('SELECT id, updated_at FROM products') as unknown as Array<{
    id: string
    updated_at: string | null
  }>
  for (const row of rows) watchedUpdatedAt.set(row.id, String(row.updated_at ?? ''))
  console.log(
    `[站点推送] 变更侦测已启动：每 ${WATCH_INTERVAL_MS / 1000}s 扫一次 products.updated_at（已建基线 ${rows.length} 个商品）`,
  )
  setInterval(() => {
    try {
      scanProductChanges()
    } catch (err) {
      console.error(`[站点推送] 变更侦测异常：${detailOf(err)}`)
    }
  }, WATCH_INTERVAL_MS).unref()
}

// ---------------------------------------------------------------------------
// 调度
// ---------------------------------------------------------------------------

/**
 * A15：周期性一致性核对。在 `backend/src/index.ts` 里调用。
 * 默认只挂定时器；`SITE_PUSH_RECONCILE_ON_START=true` 时启动后立刻核对一次。
 */
export function startSitePushScheduler(): void {
  const hours = (RECONCILE_INTERVAL_MS / 3600_000).toFixed(1)
  console.log(
    `[站点推送] 已调度：商品变更后自动推（去抖 ${AUTO_PUSH_DEBOUNCE_MS}ms）；每 ${hours} 小时做一次一致性核对（A15）；连续失败 ${MAX_CONSECUTIVE_FAILURES} 次停推（护栏 2）`,
  )

  setInterval(() => {
    reconcileSites({ source: 'reconcile' })
      .then((r) => {
        console.log(
          `[站点推送] 一致性核对：中台 ${r.central_product_count} 个商品｜${r.sites
            .map((s) => `${s.site_name}=${s.site_product_count}`)
            .join(' ')}｜补齐 ${r.total_filled}｜改草稿 ${r.total_drafted}｜失败 ${r.total_failed}｜一致=${r.consistent}`,
        )
      })
      .catch((err) => {
        console.error(`[站点推送] 一致性核对异常：${detailOf(err)}`)
      })
  }, RECONCILE_INTERVAL_MS).unref()

  /**
   * 🔴 第 5 批 · G6-3④：**默认改成 true**。
   *
   * 原来是「只有显式设成 'true' 才核对」，等于默认关着 ——
   * 配合「新站要等 6 小时」那个问题，表现就是「重启完中台，站上还是老样子」。
   * 现在默认开机核对一次；要关掉就显式设 `SITE_PUSH_RECONCILE_ON_START=false`。
   */
  const reconcileOnStart = process.env.SITE_PUSH_RECONCILE_ON_START !== 'false'
  if (reconcileOnStart) {
    console.log('[站点推送] 启动后立刻核对一次（要关掉：SITE_PUSH_RECONCILE_ON_START=false）')
    reconcileSites({ source: 'reconcile' }).catch((err) => {
      console.error(`[站点推送] 启动核对失败：${detailOf(err)}`)
    })
  }
}
