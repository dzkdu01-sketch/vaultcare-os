/**
 * 将「已有 product_supplier 绑定」的商品的 products.sku 批量改为绑定的供应商编码。
 * 多供应商时取 product_supplier.id 最小的一条（当前库无多绑定场景）。
 *
 *   node scripts/sync-product-sku-to-supplier-code.mjs           # 仅预览
 *   node scripts/sync-product-sku-to-supplier-code.mjs --apply  # 执行（会先备份 .db）
 *
 * 重要：后端 (npm run dev / PM2) 使用 sql.js 在内存中持有整库。若改库时 API 仍在运行，
 * 磁盘虽被本脚本更新，但进程内仍是旧数据，界面会显示旧 SKU；且之后任意一次写入会把旧内存整库写回磁盘。
 * 正确顺序：先停止后端 → 再 --apply → 再启动后端。（或 apply 后立刻重启后端。）
 */
import initSqlJs from 'sql.js'
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
        '\n[!] 检测到本机 3002 端口有 Vaultcare API 在响应。若继续执行 --apply，请先 Ctrl+C 停止该进程，' +
          '否则界面仍会显示旧 SKU，且后续一次保存可能把旧数据写回 vaultcare.db。\n',
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

  const SQL = await initSqlJs()
  let db = new SQL.Database(fs.readFileSync(dbPath))

  const q = (sql) => {
    const r = db.exec(sql)
    return r[0]?.values || []
  }

  const multi = q(`
    SELECT p.id, p.sku, COUNT(ps.id) AS cnt
    FROM products p
    JOIN product_supplier ps ON ps.product_id = p.id
    GROUP BY p.id
    HAVING COUNT(ps.id) > 1
  `)
  if (multi.length > 0) {
    console.error('存在同一商品绑定多个供应商，请先人工决定用哪条 supplier_code，或改脚本后再执行。')
    console.error('样例:', multi.slice(0, 5))
    process.exit(1)
  }

  const rows = q(`
    SELECT p.id, p.sku AS old_sku, trim(ps.supplier_code) AS new_sku
    FROM products p
    JOIN product_supplier ps ON ps.product_id = p.id
    WHERE ps.id = (
      SELECT MIN(ps2.id) FROM product_supplier ps2 WHERE ps2.product_id = p.id
    )
    ORDER BY p.sku
  `)

  const targets = rows.filter((r) => String(r[1]) !== String(r[2]))
  const unchanged = rows.length - targets.length

  const newSkuCounts = new Map()
  for (const [, , newSku] of targets) {
    newSkuCounts.set(String(newSku), (newSkuCounts.get(String(newSku)) || 0) + 1)
  }
  const dupNew = [...newSkuCounts.entries()].filter(([, n]) => n > 1)
  if (dupNew.length > 0) {
    console.error('冲突：多个商品将改为同一 supplier_code，违反 products.sku UNIQUE：', dupNew)
    process.exit(1)
  }

  console.log(`将更新 ${targets.length} 条（已有绑定且 sku≠供应商编码）；已一致跳过 ${unchanged} 条。`)
  for (const [id, oldSku, newSku] of targets) {
    console.log(`  ${oldSku} -> ${newSku}  (${id})`)
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
  db.run('BEGIN')
  try {
    for (const [id, oldSku, newSku] of targets) {
      db.run('UPDATE products SET sku = ?, updated_at = ? WHERE id = ?', [String(newSku), ts, String(id)])
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }

  const out = db.export()
  fs.writeFileSync(dbPath, Buffer.from(out))
  db.close()
  console.log('完成。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
