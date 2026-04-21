import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import {
  dedupeGenderCatalogTags,
  hasCatalogTagConflict,
  hasGenderCatalogTag,
  catalogTagMessage,
} from '../catalogTags.js'

export const PRODUCT_CSV_HEADERS = [
  'sku',
  'name',
  'short_description',
  'description',
  'sale_price',
  'regular_price',
  'category',
  'tags',
  'images',
  'status',
  'catalog_in',
] as const

export type ProductCsvHeader = (typeof PRODUCT_CSV_HEADERS)[number]

export type ProductCsvImportRowFailure = { row: number; sku: string; error: string }

export type ProductCsvImportResult = {
  validate_only: boolean
  total_data_rows: number
  created: number
  updated: number
  failed: ProductCsvImportRowFailure[]
}

function now() {
  return new Date().toISOString()
}

/** 去除 UTF-8 BOM */
export function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1)
  return s
}

/** 极简 RFC4180 风格 CSV 解析（支持引号内逗号与换行） */
export function parseCsv(content: string): string[][] {
  const text = stripBom(content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') {
    rows.push(row)
  }
  return rows
}

function normHeader(h: string): string {
  return h.trim().toLowerCase()
}

function parseTagsOrImages(raw: string): { ok: true; value: unknown[] } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: true, value: [] }
  if (s.startsWith('[')) {
    try {
      const j = JSON.parse(s) as unknown
      if (!Array.isArray(j)) return { ok: false, error: '须为 JSON 数组' }
      return { ok: true, value: j }
    } catch {
      return { ok: false, error: 'JSON 解析失败' }
    }
  }
  const parts = s.split('|').map((x) => x.trim()).filter(Boolean)
  return { ok: true, value: parts }
}

function parseNum(raw: string, field: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: false, error: `${field} 不能为空` }
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, error: `${field} 须为数字` }
  return { ok: true, value: n }
}

function parseOptNum(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, error: '须为数字' }
  return { ok: true, value: n }
}

function parseStatus(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: true, value: 1 }
  if (s !== '0' && s !== '1') return { ok: false, error: 'status 须为 0 或 1' }
  return { ok: true, value: Number(s) }
}

function parseCatalogIn(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim()
  if (!s) return { ok: true, value: 0 }
  if (s !== '0' && s !== '1') return { ok: false, error: 'catalog_in 须为 0 或 1' }
  return { ok: true, value: Number(s) }
}

type RowObj = Record<ProductCsvHeader, string>

function rowToObject(headers: string[], cells: string[]): RowObj {
  const map = new Map<string, string>()
  for (let i = 0; i < headers.length; i++) {
    const key = normHeader(headers[i] || '')
    if (!key) continue
    map.set(key, cells[i] ?? '')
  }
  for (const h of PRODUCT_CSV_HEADERS) {
    if (!map.has(h)) map.set(h, '')
  }
  const o = {} as RowObj
  for (const h of PRODUCT_CSV_HEADERS) {
    o[h] = map.get(h) ?? ''
  }
  return o
}

/**
 * validate_only：只校验不写库；否则按行提交，部分成功。
 * 以 sku 匹配：存在则更新（不修改 sku），不存在则新建（name 必填）。
 * 更新时空单元格表示不修改该字段。
 */
export function runProductCsvImport(csvText: string, validateOnly: boolean): ProductCsvImportResult {
  const db = getDb()
  const rows = parseCsv(csvText)
  if (rows.length < 2) {
    return {
      validate_only: validateOnly,
      total_data_rows: 0,
      created: 0,
      updated: 0,
      failed: [{ row: 1, sku: '', error: 'CSV 至少需要表头行与一行数据' }],
    }
  }

  const headerCells = rows[0].map((c) => normHeader(c))
  const missing = PRODUCT_CSV_HEADERS.filter((h) => !headerCells.includes(h))
  if (missing.length > 0) {
    return {
      validate_only: validateOnly,
      total_data_rows: 0,
      created: 0,
      updated: 0,
      failed: [{ row: 1, sku: '', error: `缺少列: ${missing.join(', ')}` }],
    }
  }

  const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''))
  const failed: ProductCsvImportRowFailure[] = []
  let created = 0
  let updated = 0
  const seenSku = new Set<string>()

  const ts = now()

  for (let di = 0; di < dataRows.length; di++) {
    const lineIndex = di + 2
    const cells = dataRows[di]
    const obj = rowToObject(rows[0], cells)

    const skuRaw = obj.sku.trim()
    if (!skuRaw) {
      failed.push({ row: lineIndex, sku: '', error: 'sku 不能为空' })
      continue
    }
    const skuKey = skuRaw.toUpperCase()
    if (seenSku.has(skuKey)) {
      failed.push({ row: lineIndex, sku: skuRaw, error: '本文件内 SKU 重复' })
      continue
    }
    seenSku.add(skuKey)

    const existing = db.get(
      'SELECT * FROM products WHERE LOWER(TRIM(sku)) = LOWER(TRIM(?))',
      [skuRaw],
    ) as Record<string, unknown> | undefined

    if (!existing) {
      const name = obj.name.trim()
      if (!name) {
        failed.push({ row: lineIndex, sku: skuRaw, error: '新建商品时 name 不能为空' })
        continue
      }

      const tagsParsed = parseTagsOrImages(obj.tags)
      if (!tagsParsed.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `tags: ${tagsParsed.error}` })
        continue
      }
      const imgsParsed = parseTagsOrImages(obj.images)
      if (!imgsParsed.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `images: ${imgsParsed.error}` })
        continue
      }
      const tagsNorm = dedupeGenderCatalogTags(tagsParsed.value)
      if (hasCatalogTagConflict(tagsNorm)) {
        failed.push({ row: lineIndex, sku: skuRaw, error: catalogTagMessage() })
        continue
      }

      const sp = parseOptNum(obj.sale_price)
      if (!sp.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `sale_price: ${sp.error}` })
        continue
      }
      const rp = parseOptNum(obj.regular_price)
      if (!rp.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `regular_price: ${rp.error}` })
        continue
      }
      const st = parseStatus(obj.status)
      if (!st.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: st.error })
        continue
      }
      const ci = parseCatalogIn(obj.catalog_in)
      if (!ci.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: ci.error })
        continue
      }

      let finalCatalogIn = ci.value
      if (!hasGenderCatalogTag(tagsNorm)) {
        if (finalCatalogIn === 1) {
          failed.push({ row: lineIndex, sku: skuRaw, error: '进图册需先选择 for him 或 for her 标签' })
          continue
        }
        finalCatalogIn = 0
      }

      if (validateOnly) {
        created++
        continue
      }

      const id = `prod-${uuidv4().slice(0, 8)}`
      try {
        db.run(
          `INSERT INTO products (id, sku, name, short_description, description, sale_price, regular_price, category, tags, images, status, catalog_in, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            skuRaw,
            name,
            obj.short_description.trim() || null,
            obj.description.trim() || null,
            sp.value ?? 0,
            rp.value ?? 0,
            obj.category.trim() || null,
            JSON.stringify(tagsNorm),
            JSON.stringify(Array.isArray(imgsParsed.value) ? imgsParsed.value : []),
            st.value,
            finalCatalogIn,
            ts,
            ts,
          ],
        )
        created++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        failed.push({ row: lineIndex, sku: skuRaw, error: msg })
      }
      continue
    }

    // --- update ---
    const mergeStr = (incoming: string, current: unknown): string => {
      if (incoming.trim() === '') return String(current ?? '')
      return incoming
    }

    const nextName = obj.name.trim() === '' ? String(existing.name ?? '') : obj.name.trim()
    if (!nextName) {
      failed.push({ row: lineIndex, sku: skuRaw, error: 'name 不能为空' })
      continue
    }

    let nextShort = mergeStr(obj.short_description, existing.short_description)
    let nextDesc = mergeStr(obj.description, existing.description)

    let nextSale = Number(existing.sale_price) || 0
    if (obj.sale_price.trim() !== '') {
      const p = parseOptNum(obj.sale_price)
      if (!p.ok || p.value === null) {
        failed.push({ row: lineIndex, sku: skuRaw, error: 'sale_price: 须为数字' })
        continue
      }
      nextSale = p.value
    }

    let nextReg = Number(existing.regular_price) || 0
    if (obj.regular_price.trim() !== '') {
      const p = parseOptNum(obj.regular_price)
      if (!p.ok || p.value === null) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `regular_price: 须为数字` })
        continue
      }
      nextReg = p.value
    }

    let nextCat = obj.category.trim() === '' ? String(existing.category ?? '') : obj.category.trim()

    let tagsNorm: unknown[]
    if (obj.tags.trim() === '') {
      try {
        tagsNorm = dedupeGenderCatalogTags(JSON.parse(String(existing.tags || '[]')))
      } catch {
        tagsNorm = dedupeGenderCatalogTags([])
      }
    } else {
      const tagsParsed = parseTagsOrImages(obj.tags)
      if (!tagsParsed.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `tags: ${tagsParsed.error}` })
        continue
      }
      tagsNorm = dedupeGenderCatalogTags(tagsParsed.value)
    }
    if (hasCatalogTagConflict(tagsNorm)) {
      failed.push({ row: lineIndex, sku: skuRaw, error: catalogTagMessage() })
      continue
    }

    let nextImages: unknown[]
    if (obj.images.trim() === '') {
      try {
        nextImages = JSON.parse(String(existing.images || '[]')) as unknown[]
        if (!Array.isArray(nextImages)) nextImages = []
      } catch {
        nextImages = []
      }
    } else {
      const imgsParsed = parseTagsOrImages(obj.images)
      if (!imgsParsed.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: `images: ${imgsParsed.error}` })
        continue
      }
      nextImages = Array.isArray(imgsParsed.value) ? imgsParsed.value : []
    }

    let nextStatus = Number(existing.status) === 0 ? 0 : 1
    if (obj.status.trim() !== '') {
      const st = parseStatus(obj.status)
      if (!st.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: st.error })
        continue
      }
      nextStatus = st.value
    }

    let nextCatalogIn = Number(existing.catalog_in) === 1 ? 1 : 0
    if (obj.catalog_in.trim() !== '') {
      const ci = parseCatalogIn(obj.catalog_in)
      if (!ci.ok) {
        failed.push({ row: lineIndex, sku: skuRaw, error: ci.error })
        continue
      }
      nextCatalogIn = ci.value
    }

    if (!hasGenderCatalogTag(tagsNorm)) {
      if (obj.catalog_in.trim() !== '' && nextCatalogIn === 1) {
        failed.push({ row: lineIndex, sku: skuRaw, error: '进图册需先选择 for him 或 for her 标签' })
        continue
      }
      nextCatalogIn = 0
    }

    if (validateOnly) {
      updated++
      continue
    }

    const productId = String(existing.id)

    try {
      db.run(
        `UPDATE products SET name = ?, short_description = ?, description = ?, sale_price = ?, regular_price = ?,
         category = ?, tags = ?, images = ?, status = ?, catalog_in = ?, updated_at = ?
         WHERE id = ?`,
        [
          nextName,
          nextShort || null,
          nextDesc || null,
          nextSale,
          nextReg,
          nextCat || null,
          JSON.stringify(tagsNorm),
          JSON.stringify(nextImages),
          nextStatus,
          nextCatalogIn,
          ts,
          productId,
        ],
      )
      updated++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      failed.push({ row: lineIndex, sku: skuRaw, error: msg })
    }
  }

  return {
    validate_only: validateOnly,
    total_data_rows: dataRows.length,
    created,
    updated,
    failed,
  }
}

export function buildProductCsvTemplate(): string {
  const header = PRODUCT_CSV_HEADERS.join(',')
  const bom = '\uFEFF'
  return `${bom}${header}\n`
}
