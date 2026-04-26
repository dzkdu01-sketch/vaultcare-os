/**
 * Rename videos in a folder to: {SUPPLIER_CODE}-{price}aed.mp4
 * - Price from filename (e.g. 169AED) if present, else from vaultcare.db (products.sale_price via product_supplier)
 * - Disambiguate duplicates with -s2, -s3 before .mp4
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FOLDER =
  process.argv[2] || 'C:\\Users\\杜兆凯\\Desktop\\视频\\客户素材'
const OVERRIDE_JSON = process.argv[3] || path.join(FOLDER, 'video-price-overrides.json')
const DB_PATH = path.join(__dirname, '..', 'data', 'vaultcare.db')

function loadOverrides() {
  if (!fs.existsSync(OVERRIDE_JSON)) return new Map()
  try {
    const j = JSON.parse(fs.readFileSync(OVERRIDE_JSON, 'utf8'))
    const m = new Map()
    for (const [k, v] of Object.entries(j)) {
      const p = Number(v)
      if (!Number.isNaN(p) && p > 0) m.set(String(k).trim().toUpperCase(), p)
    }
    return m
  } catch (e) {
    console.warn('读取覆盖文件失败:', OVERRIDE_JSON, e.message)
    return new Map()
  }
}

function loadPriceMap() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('DB not found:', DB_PATH)
    return new Map()
  }
  const db = new Database(DB_PATH, { readonly: true })
  const rowList = db.prepare(
    `SELECT supplier_code, sale_price FROM (
       SELECT ps.supplier_code AS supplier_code, p.sale_price AS sale_price
       FROM product_supplier ps
       JOIN products p ON p.id = ps.product_id
       UNION ALL
       SELECT sp.supplier_code AS supplier_code, p.sale_price AS sale_price
       FROM supplier_products sp
       JOIN products p ON p.id = sp.mapped_product_id
       WHERE sp.mapped_product_id IS NOT NULL
     )`,
  ).all()
  db.close()
  const map = new Map()
  for (const row of rowList) {
    const c = String(row.supplier_code).trim().toUpperCase()
    const p = Number(row.sale_price)
    if (Number.isNaN(p) || p <= 0) continue
    if (!map.has(c)) map.set(c, p)
  }
  return map
}

function extractCode(name) {
  const base = name.replace(/\.mp4$/i, '').trim()
  const m = base.match(/^(VC\d+|LY\d+)/i)
  if (!m) return null
  return m[1].toUpperCase()
}

function extractPriceFromFilename(name) {
  const m = name.match(/(\d+)\s*AED/i)
  if (m) return parseInt(m[1], 10)
  const d = name.match(/(\d+)\s*dhs/i)
  if (d) return parseInt(d[1], 10)
  return null
}

function extractPartSuffix(name) {
  const base = name.replace(/\.mp4$/i, '')
  const s = base.match(/-s(\d+)$/i)
  if (s) return `s${s[1]}`
  const u = base.match(/_(\d+)$/)
  if (u) return `p${u[1]}`
  return null
}

async function main() {
  const priceMap = loadPriceMap()
  const overrides = loadOverrides()
  for (const [code, p] of overrides) priceMap.set(code, p)
  if (overrides.size) console.log('已加载手动覆盖价格:', overrides.size, '条 (', OVERRIDE_JSON, ')\n')
  const files = fs
    .readdirSync(FOLDER)
    .filter((f) => /\.mp4$/i.test(f))
    .sort()

  const planned = []
  for (const f of files) {
    const code = extractCode(f)
    if (!code) {
      planned.push({ from: f, skip: true, reason: '无法识别供应商编码(VC/LY+数字)' })
      continue
    }
    let price = extractPriceFromFilename(f)
    if (price == null) {
      price = priceMap.get(code)
      if (price == null || Number.isNaN(price)) {
        planned.push({ from: f, skip: true, reason: `无价格: 文件名无AED且数据库无 ${code}` })
        continue
      }
    }
    const part = extractPartSuffix(f)
    const priceInt = Math.round(Number(price))
    planned.push({ from: f, code, price: priceInt, part })
  }

  const targetCounts = new Map()
  for (const p of planned) {
    if (p.skip) continue
    const key = `${p.code}-${p.price}aed`
    targetCounts.set(key, (targetCounts.get(key) || 0) + 1)
  }

  const used = new Map()
  const renames = []
  for (const p of planned) {
    if (p.skip) {
      renames.push(p)
      continue
    }
    let base = `${p.code}-${p.price}aed`
    const dup = targetCounts.get(base) > 1
    let to = `${base}.mp4`
    if (dup && p.part) {
      to = `${base}-${p.part}.mp4`
    } else if (dup && !p.part) {
      const n = (used.get(base) || 0) + 1
      used.set(base, n)
      to = n === 1 ? `${base}.mp4` : `${base}-${n}.mp4`
    }
    const fullFrom = path.join(FOLDER, p.from)
    const fullTo = path.join(FOLDER, to)
    renames.push({ ...p, to, fullFrom, fullTo })
  }

  console.log('计划重命名（预览）:\n')
  for (const r of renames) {
    if (r.skip) console.log(`[跳过] ${r.from} — ${r.reason}`)
    else console.log(`  ${r.from}\n    → ${r.to}`)
  }

  const toApply = renames.filter((r) => !r.skip)
  const conflicts = new Set()
  const seen = new Set()
  for (const r of toApply) {
    if (seen.has(r.to)) conflicts.add(r.to)
    seen.add(r.to)
  }
  if (conflicts.size) {
    console.error('\n冲突目标文件名:', [...conflicts])
    process.exit(1)
  }

  for (const r of toApply) {
    if (r.fullFrom === r.fullTo) continue
    if (fs.existsSync(r.fullTo)) {
      console.error('目标已存在，中止:', r.to)
      process.exit(1)
    }
  }

  for (const r of toApply) {
    if (r.fullFrom === r.fullTo) continue
    fs.renameSync(r.fullFrom, r.fullTo)
  }
  console.log(`\n完成: ${toApply.filter((r) => r.fullFrom !== r.fullTo).length} 个文件已重命名`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
