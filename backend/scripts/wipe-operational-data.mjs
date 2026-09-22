/**
 * 清空过程数据：订单、商品、同步/映射/收藏/导入货源，以及 2.0 上可能存在的留痕/同步日志。
 * 保留站点、分销商、操作员、供应商主数据、settings。
 *
 * 使用前务必停掉占用 vaultcare.db 的 API（pm2 stop / 停本地 tsx）。
 *
 *   cd backend && node scripts/wipe-operational-data.mjs
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'vaultcare.db')

const KEEP = new Set([
  'sqlite_sequence',
  'sqlite_stat1',
  'sites',
  'distributors',
  'operators',
  'suppliers',
  'settings',
])

const NAMED = [
  'orders',
  'order_status_log',
  'order_number_seq',
  'products',
  'product_sync',
  'product_supplier',
  'product_favorites',
  'supplier_products',
  'supplier_sync_runs',
  'supplier_sync_log',
  'sync_runs',
  'sync_logs',
  'change_logs',
  'audit_logs',
  'activity_logs',
  'media_downloads',
]

function looksOperational(name) {
  return /order|product|sync|log|audit|change|media|import|favorite|webhook/i.test(name)
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('没有数据库文件，无需清空:', DB_PATH)
    return
  }

  const db = new Database(DB_PATH)
  db.pragma('foreign_keys = OFF')

  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY 1
  `).all().map((r) => r.name)

  const targets = new Set(NAMED.filter((n) => tables.includes(n)))
  for (const name of tables) {
    if (KEEP.has(name)) continue
    if (looksOperational(name)) targets.add(name)
  }

  const summary = []
  for (const name of [...targets].sort()) {
    const before = Number(db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c)
    db.exec(`DELETE FROM "${name}"`)
    db.exec(`DELETE FROM sqlite_sequence WHERE name = '${name.replace(/'/g, "''")}'`)
    summary.push({ table: name, deleted: before })
  }

  db.pragma('foreign_keys = ON')
  db.exec('VACUUM')
  db.close()

  console.log('Wiped operational data. DB:', DB_PATH)
  for (const row of summary) {
    console.log(`  ${row.table}: ${row.deleted}`)
  }
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
