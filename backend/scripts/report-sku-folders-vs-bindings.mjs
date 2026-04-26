/**
 * 对照：① 有供应商绑定但桌面无对应文件夹（文件夹名可为 SKU 或任一供应商编码）
 *     ② 桌面文件夹名为系统内 SKU，但该 SKU 无供应商绑定
 *     ③ 桌面文件夹既非当前任一商品 SKU，也非任一绑定中的供应商编码（孤儿/拼写等）
 *
 *   node scripts/report-sku-folders-vs-bindings.mjs
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'vaultcare.db')
const defaultRoot = path.join('C:', 'Users', '杜兆凯', 'Desktop', '情趣图片')
const rootDir = process.env.RENAME_PIC_ROOT || defaultRoot

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('找不到数据库:', dbPath)
    process.exit(1)
  }

  const db = new Database(dbPath, { readonly: true })

  const productRows = db.prepare('SELECT id, sku FROM products').all()
  const idToSku = new Map()
  const skuSet = new Set()
  for (const row of productRows) {
    idToSku.set(String(row.id), String(row.sku))
    skuSet.add(String(row.sku))
  }

  const bindingRows = db.prepare('SELECT product_id, supplier_code FROM product_supplier').all()
  /** product_id -> supplier_code[] */
  const pidToCodes = new Map()
  /** 所有出现过的供应商编码（用于识别「已是供应商文件夹名」） */
  const allSupplierCodes = new Set()
  for (const row of bindingRows) {
    const pid = String(row.product_id)
    const c = String(row.supplier_code).trim()
    if (!c) continue
    allSupplierCodes.add(c)
    if (!pidToCodes.has(pid)) pidToCodes.set(pid, [])
    pidToCodes.get(pid).push(c)
  }

  const hasBinding = new Set(pidToCodes.keys())

  db.close()

  let folderNames = new Set()
  if (fs.existsSync(rootDir)) {
    folderNames = new Set(
      fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name),
    )
  } else {
    console.warn('警告：桌面目录不存在：', rootDir)
  }

  /** 该商品是否已有「图片文件夹」（名为 SKU 或任一供应商编码） */
  function productHasFolder(productId) {
    const sku = idToSku.get(productId)
    if (sku && folderNames.has(sku)) return true
    for (const c of pidToCodes.get(productId) || []) {
      if (folderNames.has(c)) return true
    }
    return false
  }

  /** 一、有绑定，但桌面上既没有 SKU 文件夹，也没有任一供应商编码文件夹 */
  const boundNoFolder = []
  for (const pid of hasBinding) {
    if (!productHasFolder(pid)) {
      const sku = idToSku.get(pid) || pid
      boundNoFolder.push({
        sku,
        codes: [...new Set(pidToCodes.get(pid) || [])].sort().join(', '),
      })
    }
  }
  boundNoFolder.sort((a, b) => String(a.sku).localeCompare(String(b.sku), 'en'))

  /** 二、文件夹名 = 系统内某 SKU，但该商品无供应商绑定 */
  const folderNoBinding = []
  for (const name of folderNames) {
    if (!skuSet.has(name)) continue
    const pid = [...idToSku.entries()].find(([, s]) => s === name)?.[0]
    if (!pid || hasBinding.has(pid)) continue
    folderNoBinding.push(name)
  }
  folderNoBinding.sort((a, b) => a.localeCompare(b, 'en'))

  /** 三、文件夹名既不是任一 SKU，也不是任一绑定表中的供应商编码 */
  const orphanFolders = [...folderNames].filter(
    n => !skuSet.has(n) && !allSupplierCodes.has(n),
  ).sort((a, b) => a.localeCompare(b, 'en'))

  const lines = []
  lines.push('# SKU 与「情趣图片」文件夹对照')
  lines.push('')
  lines.push(`生成时间（本地）：${new Date().toLocaleString('zh-CN')}`)
  lines.push(`数据库：\`${dbPath}\``)
  lines.push(`桌面目录：\`${rootDir}\``)
  lines.push('')
  lines.push('说明：**已把文件夹改成供应商编码的**，只要文件夹名等于该商品任一供应商编码，即视为已有对应文件夹。')
  lines.push('')
  lines.push(`- 系统商品总数：${skuSet.size}`)
  lines.push(`- 至少有一条供应商绑定的商品数：${hasBinding.size}`)
  lines.push(`- 桌面子文件夹数：${folderNames.size}`)
  lines.push('')

  lines.push('## 一、有供应商绑定，但桌面没有对应文件夹')
  lines.push('')
  lines.push(
    `共 **${boundNoFolder.length}** 条。规则：桌面上应存在 **与 SKU 同名** 或 **与任一已绑定供应商编码同名** 的文件夹（满足其一即可）。`,
  )
  lines.push('')
  lines.push('| # | SKU | 已绑定的供应商编码（参考） |')
  lines.push('|---|-----|------------------------------|')
  boundNoFolder.forEach((row, i) => lines.push(`| ${i + 1} | ${row.sku} | ${row.codes || '—'} |`))
  lines.push('')

  lines.push('## 二、桌面有文件夹（文件夹名 = 系统内 SKU），但该 SKU 无供应商绑定')
  lines.push('')
  lines.push(`共 **${folderNoBinding.length}** 条。请在系统里补 **供应商编码** 绑定。`)
  lines.push('')
  lines.push('| # | 文件夹名（SKU） |')
  lines.push('|---|----------------|')
  folderNoBinding.forEach((sku, i) => lines.push(`| ${i + 1} | ${sku} |`))
  lines.push('')

  lines.push('## 三、桌面文件夹名在系统中无对应（既非 SKU，也非任一绑定中的供应商编码）')
  lines.push('')
  lines.push(
    `共 **${orphanFolders.length}** 条。可能是拼写错误、已删商品、或手工命名；请人工核对。`,
  )
  lines.push('')
  lines.push('| # | 文件夹名 |')
  lines.push('|---|----------|')
  orphanFolders.forEach((name, i) => lines.push(`| ${i + 1} | ${name} |`))
  lines.push('')

  const outPath = path.join(__dirname, '..', 'data', 'sku-folder-binding-report.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')

  console.log(lines.join('\n'))
  console.log('\n---')
  console.log('已写入:', outPath)
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
