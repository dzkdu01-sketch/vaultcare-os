/**
 * 根据 CSV（SKU, 对应供应商编码）批量绑定供应商导入记录到内部产品。
 * 依赖 supplier_products 中已存在对应 supplier_code 的导入行（与后台「货源导入」一致）。
 *
 * 用法：
 *   npx tsx scripts/bind-sku-supplier-csv.ts
 *   npx tsx scripts/bind-sku-supplier-csv.ts path/to/file.csv
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb, getDb } from '../src/db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function now() {
  return new Date().toISOString()
}

function parseCsv(content: string): Array<{ sku: string; supplierCode: string }> {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const out: Array<{ sku: string; supplierCode: string }> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const idx = line.indexOf(',')
    if (idx === -1) continue
    const sku = line.slice(0, idx).trim()
    const supplierCode = line.slice(idx + 1).trim()
    if (!sku || !supplierCode) continue
    out.push({ sku, supplierCode })
  }
  return out
}

function bindOne(
  db: ReturnType<typeof getDb>,
  sku: string,
  supplierCode: string,
): { ok: true } | { ok: false; reason: string } {
  const product = db.get('SELECT id FROM products WHERE sku = ?', [sku]) as { id?: string } | undefined
  if (!product?.id) {
    return { ok: false, reason: `无内部产品 SKU=${sku}` }
  }
  const productId = product.id

  const imported = db.all(
    `SELECT id, supplier_id, supplier_code, cost_price_aed, mapped_product_id
     FROM supplier_products
     WHERE trim(supplier_code) = trim(?)
     ORDER BY CASE WHEN mapped_product_id IS NULL THEN 0 ELSE 1 END, id`,
    [supplierCode],
  ) as Array<{
    id: number
    supplier_id: string
    supplier_code: string
    cost_price_aed: number | null
    mapped_product_id: string | null
  }>

  if (imported.length === 0) {
    return { ok: false, reason: `货源中无供应商编码「${supplierCode}」（请先导入供应商 Excel）` }
  }

  const row = imported[0]
  if (row.mapped_product_id && row.mapped_product_id !== productId) {
    return {
      ok: false,
      reason: `编码 ${supplierCode} 已绑定其它产品 ${row.mapped_product_id}（supplier_products.id=${row.id}）`,
    }
  }

  const ts = now()
  db.run('UPDATE supplier_products SET mapped_product_id = ?, updated_at = ? WHERE id = ?', [
    productId,
    ts,
    row.id,
  ])

  const existingMapping = db.get(
    'SELECT * FROM product_supplier WHERE product_id = ? AND supplier_id = ?',
    [productId, row.supplier_id],
  ) as { id?: number } | undefined

  if (existingMapping?.id) {
    db.run(
      'UPDATE product_supplier SET supplier_code = ?, cost_price = ?, note = ? WHERE id = ?',
      [row.supplier_code, row.cost_price_aed ?? null, '', existingMapping.id],
    )
  } else {
    db.run(
      'INSERT INTO product_supplier (product_id, supplier_id, supplier_code, cost_price, note) VALUES (?, ?, ?, ?, ?)',
      [productId, row.supplier_id, row.supplier_code, row.cost_price_aed ?? null, ''],
    )
  }

  return { ok: true }
}

async function main() {
  const csvPath =
    process.argv[2] || path.join(__dirname, '../../products-sku-name.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('找不到 CSV 文件:', csvPath)
    process.exit(1)
  }

  const raw = fs.readFileSync(csvPath, 'utf-8')
  // 去 BOM
  const content = raw.replace(/^\uFEFF/, '')
  const rows = parseCsv(content)
  if (rows.length === 0) {
    console.error('CSV 无有效数据行')
    process.exit(1)
  }

  await initDb()
  const db = getDb()

  let ok = 0
  const errors: string[] = []

  for (const { sku, supplierCode } of rows) {
    const r = bindOne(db, sku, supplierCode)
    if (r.ok) {
      ok++
    } else {
      errors.push(`${sku} -> ${supplierCode}: ${r.reason}`)
    }
  }

  console.log(`完成：成功 ${ok} / ${rows.length}`)
  if (errors.length > 0) {
    console.log('\n失败或跳过：')
    for (const e of errors) console.log(e)
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
