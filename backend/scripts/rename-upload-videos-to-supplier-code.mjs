/**
 * 上传目录内视频 → 按 SKU→供应商编码 重命名为：{供应商编码}-s序号.扩展名
 *
 *   node scripts/rename-upload-videos-to-supplier-code.mjs
 *   node scripts/rename-upload-videos-to-supplier-code.mjs --apply
 *
 * UPLOAD_VIDEO_ROOT 可覆盖目录。
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'vaultcare.db')
const defaultRoot = path.join('C:', 'Users', '杜兆凯', 'Desktop', '上传文件', '上传文件')
const rootDir = process.env.UPLOAD_VIDEO_ROOT || defaultRoot
const apply = process.argv.includes('--apply')

const VIDEO_EXT = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'])

function isVideo(name) {
  return VIDEO_EXT.has(path.extname(name).toLowerCase())
}

async function loadMaps() {
  const filebuffer = fs.readFileSync(dbPath)
  const SQL = await initSqlJs()
  const db = new SQL.Database(filebuffer)
  const res = db.exec(`
    SELECT p.sku, ps.supplier_code
    FROM products p
    JOIN product_supplier ps ON ps.product_id = p.id
    ORDER BY p.sku, ps.supplier_code
  `)
  db.close()
  const skuToSupplier = new Map()
  if (res[0]?.values?.length) {
    for (const [sku, code] of res[0].values) {
      const s = String(sku)
      const c = String(code).trim()
      if (!c) continue
      if (!skuToSupplier.has(s)) skuToSupplier.set(s, c)
    }
  }
  const supplierSet = new Set(skuToSupplier.values())
  return { skuToSupplier, supplierSet }
}

/** LY03 / LY101 / VC903 等：至少 2 位字母 + 数字 */
function parseLoosePrefix(base) {
  const m = /^([A-Za-z]{2}\d+)\b/.exec(base.trim())
  return m ? m[1] : null
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('找不到数据库:', dbPath)
    process.exit(1)
  }
  if (!fs.existsSync(rootDir)) {
    console.error('找不到目录:', rootDir)
    process.exit(1)
  }

  const { skuToSupplier, supplierSet } = await loadMaps()
  if (skuToSupplier.size === 0) {
    console.error('数据库无 SKU–供应商绑定')
    process.exit(1)
  }

  const names = fs
    .readdirSync(rootDir)
    .filter(n => {
      try {
        return fs.statSync(path.join(rootDir, n)).isFile() && isVideo(n)
      } catch {
        return false
      }
    })
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  /** @type {{ from: string, to: string, note: string }[]} */
  const plans = []
  const skipped = []
  /** 描述型文件名：按目标供应商分组，组内 s1、s2… */
  const looseBySupplier = new Map()

  function resolveSupplier(token) {
    if (skuToSupplier.has(token)) return skuToSupplier.get(token)
    if (supplierSet.has(token)) return token
    return null
  }

  for (const name of names) {
    const ext = path.extname(name)
    const base = path.parse(name).name

    const m = /^(.+?)-s(\d+)$/i.exec(base)
    if (m) {
      const sku = m[1]
      const seq = parseInt(m[2], 10)
      const sup = skuToSupplier.get(sku)
      if (!sup) {
        skipped.push(`${name}（SKU ${sku} 无绑定）`)
        continue
      }
      plans.push({ from: name, to: `${sup}-s${seq}${ext}`, note: `${sku}→${sup}` })
      continue
    }

    const trimmed = base.trim()
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      const sup = resolveSupplier(trimmed)
      if (sup) {
        plans.push({ from: name, to: `${sup}-s1${ext}`, note: `${trimmed}→${sup}` })
        continue
      }
    }

    const pref = parseLoosePrefix(base)
    if (pref) {
      const sup = resolveSupplier(pref)
      if (sup) {
        if (!looseBySupplier.has(sup)) looseBySupplier.set(sup, [])
        looseBySupplier.get(sup).push({ from: name, ext })
        continue
      }
    }

    skipped.push(`${name}（无法匹配 SKU/供应商绑定）`)
  }

  for (const [sup, items] of looseBySupplier) {
    items.sort((a, b) => a.from.localeCompare(b.from, 'en', { numeric: true }))
    items.forEach((item, i) => {
      plans.push({
        from: item.from,
        to: `${sup}-s${i + 1}${item.ext}`,
        note: `描述型→${sup}`,
      })
    })
  }

  const finalPlans = plans.filter(p => p.from !== p.to)

  const targetCount = new Map()
  for (const p of finalPlans) targetCount.set(p.to, (targetCount.get(p.to) || 0) + 1)
  const dup = [...targetCount.entries()].filter(([, n]) => n > 1)
  if (dup.length > 0) {
    console.error('错误：目标文件名重复：')
    dup.forEach(([t, n]) => console.error(`  ${t} ×${n}`))
    process.exit(1)
  }

  const fromSet = new Set(finalPlans.map(p => p.from))
  for (const p of finalPlans) {
    const dest = path.join(rootDir, p.to)
    if (fs.existsSync(dest) && !fromSet.has(p.to)) {
      console.error('错误：目标已存在:', p.to)
      process.exit(1)
    }
  }

  console.log(`目录: ${rootDir}`)
  console.log(`模式: ${apply ? '执行重命名' : '仅预览（加 --apply）'}\n`)

  for (const p of finalPlans) {
    console.log(`${p.from}  →  ${p.to}  （${p.note}）`)
  }

  const alreadyOk = plans.length - finalPlans.length
  if (alreadyOk > 0) console.log(`\n（另有 ${alreadyOk} 个已是目标文件名，跳过）`)

  if (skipped.length) {
    console.log('\n--- 跳过 ---')
    skipped.forEach(s => console.log(s))
  }

  console.log(`\n将重命名 ${finalPlans.length} 个文件。`)

  if (!apply || finalPlans.length === 0) {
    if (!apply && finalPlans.length) console.log('\n加 --apply 执行。')
    return
  }

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const tmps = finalPlans.map((p, i) => path.join(rootDir, `.__vid_${stamp}_${i}_${p.from}`))
  for (let i = 0; i < finalPlans.length; i++) {
    fs.renameSync(path.join(rootDir, finalPlans[i].from), tmps[i])
  }
  for (let i = 0; i < finalPlans.length; i++) {
    fs.renameSync(tmps[i], path.join(rootDir, finalPlans[i].to))
  }
  console.log('\n完成。')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
