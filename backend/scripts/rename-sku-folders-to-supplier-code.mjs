/**
 * 将「情趣图片」目录下以 SKU 命名的文件夹重命名为对应供应商编码。
 * 用法（先 dry-run）：
 *   node scripts/rename-sku-folders-to-supplier-code.mjs
 *   node scripts/rename-sku-folders-to-supplier-code.mjs --apply
 *
 * 默认根目录：C:\Users\杜兆凯\Desktop\情趣图片
 * 可用环境变量 RENAME_PIC_ROOT 覆盖。
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'vaultcare.db')
const defaultRoot = path.join('C:', 'Users', '杜兆凯', 'Desktop', '情趣图片')
const rootDir = process.env.RENAME_PIC_ROOT || defaultRoot
const apply = process.argv.includes('--apply')

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('找不到数据库:', dbPath)
    process.exit(1)
  }
  if (!fs.existsSync(rootDir)) {
    console.error('找不到图片目录:', rootDir)
    process.exit(1)
  }

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

  if (!res.length || !res[0].values.length) {
    console.error('数据库中没有任何 SKU–供应商编码绑定，无法重命名。')
    process.exit(1)
  }

  /** @type {Map<string, string[]>} */
  const skuToCodes = new Map()
  for (const [sku, code] of res[0].values) {
    const s = String(sku)
    const c = String(code).trim()
    if (!c) continue
    if (!skuToCodes.has(s)) skuToCodes.set(s, [])
    skuToCodes.get(s).push(c)
  }

  const dirs = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  /** @type {{ from: string, to: string, note?: string }[]} */
  const renames = []
  const skipped = []
  const warnings = []

  for (const folder of dirs) {
    const codes = skuToCodes.get(folder)
    if (!codes || codes.length === 0) {
      skipped.push(`${folder}（无绑定）`)
      continue
    }
    const unique = [...new Set(codes)].sort()
    let target = unique[0]
    if (unique.length > 1) {
      warnings.push(`${folder} 对应多个供应商编码 [${unique.join(', ')}]，使用（字典序第一个）: ${target}`)
    }
    if (target === folder) {
      skipped.push(`${folder}（已是目标名）`)
      continue
    }
    renames.push({ from: folder, to: target, note: unique.length > 1 ? unique.join(',') : undefined })
  }

  /** 多个 SKU 文件夹要改成同一个供应商编码 */
  const targetCount = new Map()
  for (const r of renames) {
    targetCount.set(r.to, (targetCount.get(r.to) || 0) + 1)
  }
  const targetConflicts = [...targetCount.entries()].filter(([, n]) => n > 1)
  if (targetConflicts.length > 0) {
    console.error('错误：以下供应商编码被多个 SKU 文件夹同时指向，无法安全重命名（会互相覆盖）：')
    for (const [t, n] of targetConflicts) {
      const who = renames.filter(x => x.to === t).map(x => x.from)
      console.error(`  ${t} <- ${n} 个文件夹: ${who.join(', ')}`)
    }
    process.exit(1)
  }

  /** 目标名已存在且不是本次重命名来源 */
  const fromSet = new Set(renames.map(r => r.from))
  for (const r of renames) {
    const destPath = path.join(rootDir, r.to)
    if (fs.existsSync(destPath) && !fromSet.has(r.to)) {
      console.error(`错误：目标文件夹已存在且不是本次待改名的 SKU 目录: ${r.to}`)
      process.exit(1)
    }
  }

  console.log(`根目录: ${rootDir}`)
  console.log(`模式: ${apply ? '执行重命名' : '仅预览（加 --apply 执行）'}\n`)

  if (warnings.length) {
    console.log('--- 提示 ---')
    warnings.forEach(w => console.log(w))
    console.log('')
  }

  if (renames.length === 0) {
    console.log('没有需要重命名的文件夹。')
    if (skipped.length) console.log('\n跳过:\n', skipped.join('\n'))
    return
  }

  for (const r of renames) {
    const line = r.note
      ? `${r.from}  ->  ${r.to}  （多编码时选用其一，全部: ${r.note}）`
      : `${r.from}  ->  ${r.to}`
    console.log(line)
  }

  if (skipped.length) {
    console.log('\n--- 跳过 ---')
    console.log(skipped.join('\n'))
  }

  if (!apply) {
    console.log(`\n共 ${renames.length} 个文件夹将重命名。运行加 --apply 生效。`)
    return
  }

  /** 避免 A->B 与 B->C 链式覆盖：先全部改为临时名，再改为目标名 */
  const tmpSuffix = '.__renaming_tmp__'
  for (const r of renames) {
    const src = path.join(rootDir, r.from)
    const tmp = path.join(rootDir, r.from + tmpSuffix)
    fs.renameSync(src, tmp)
  }
  for (const r of renames) {
    const tmp = path.join(rootDir, r.from + tmpSuffix)
    const dest = path.join(rootDir, r.to)
    fs.renameSync(tmp, dest)
  }

  console.log(`\n完成：已重命名 ${renames.length} 个文件夹。`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
