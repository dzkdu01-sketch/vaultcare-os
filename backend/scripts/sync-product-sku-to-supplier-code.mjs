/**
 * 将「已有 product_supplier 绑定」的商品的 products.sku 批量改为绑定的供应商编码。
 * 多供应商时取 product_supplier.id 最小的一条（当前库无多绑定场景）。
 *
 *   node scripts/sync-product-sku-to-supplier-code.mjs           # 仅预览
 *   node scripts/sync-product-sku-to-supplier-code.mjs --apply  # 执行（会先备份 .db）
 *
 * 使用 better-sqlite3 直接写 vaultcare.db。若改库时 API 仍占用同一库文件，请先
 * `pm2 stop vault-os11-api` 或自行确保无并发写入。
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'vaultcare.db')
const apply = process.argv.includes('--apply')

function nowIso() {
  return new Date().toISOString()
}

async function warnIfBackendLikelyRunning() {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 800)
    const res = await fetch('http://127.0.0.1:3002/api/health', { signal: ac.signal })
    clearTimeout(t)
    if (res.ok) {
      console.warn(
        '\n[!] 检测到本机 3002 端口有 Vaultcare API 在响应。若继续执行 --apply，请先停止该进程，' +
          '避免与脚本同时写同一数据库文件。\n',
      )
    }
  } catch {
    /* 无服务或未监听 */
  }
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('找不到数据库:', dbPath)
    process.exit(1)
  }

  if (apply) await warnIfBackendLikelyRunning()

  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  const multi = db.prepare(`
    SELECT p.id, p.sku, COUNT(ps.id) AS cnt
    FROM products p
    JOIN product_supplier ps ON ps.product_id = p.id
    GROUP BY p.id
    HAVING COUNT(ps.id) > 1
  `).all()
  if (multi.length > 0) {
    console.error('存在同一商品绑定多个供应商，请先人工决定用哪条 supplier_code，或改脚本后再执行。')
    console.error('样例:', multi.slice(0, 5))
    process.exit(1)
  }

  const rows = db.prepare(`
    SELECT p.id, p.sku AS old_sku, trim(ps.supplier_code) AS new_sku
    FROM products p
    JOIN product_supplier ps ON ps.product_id = p.id
    WHERE ps.id = (
      SELECT MIN(ps2.id) FROM product_supplier ps2 WHERE ps2.product_id = p.id
    )
    ORDER BY p.sku
  `).all()

  const targets = rows.filter((r) => String(r.old_sku) !== String(r.new_sku))
  const unchanged = rows.length - targets.length

  const newSkuCounts = new Map()
  for (const r of targets) {
    newSkuCounts.set(String(r.new_sku), (newSkuCounts.get(String(r.new_sku)) || 0) + 1)
  }
  const dupNew = [...newSkuCounts.entries()].filter(([, n]) => n > 1)
  if (dupNew.length > 0) {
    console.error('冲突：多个商品将改为同一 supplier_code，违反 products.sku UNIQUE：', dupNew)
    process.exit(1)
  }

  console.log(`将更新 ${targets.length} 条（已有绑定且 sku≠供应商编码）；已一致跳过 ${unchanged} 条。`)
  for (const r of targets) {
    console.log(`  ${r.old_sku} -> ${r.new_sku}  (${r.id})`)
  }

  if (!apply) {
    console.log('\n预览结束。执行请追加: --apply')
    db.close()
    return
  }

  const backup = `${dbPath}.${Date.now()}.bak`
  fs.copyFileSync(dbPath, backup)
  console.log('\n已备份:', backup)

  const ts = nowIso()
  const updateStmt = db.prepare('UPDATE products SET sku = ?, updated_at = ? WHERE id = ?')
  const runBatch = db.transaction((list) => {
    for (const r of list) {
      updateStmt.run(String(r.new_sku), ts, String(r.id))
    }
  })
  runBatch(targets)
  db.close()
  console.log('完成。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
