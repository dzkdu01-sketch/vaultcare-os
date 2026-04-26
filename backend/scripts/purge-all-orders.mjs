/**
 * 清空 SQLite 中全部订单及订单状态流水，并重置 order_number_seq。
 * 使用 plain Node，不依赖 tsx（VPS 生产环境常见无 tsx）。
 * 使用前务必停掉占用 vaultcare.db 的 API（如 pm2 stop）。
 *
 *   cd backend && node scripts/purge-all-orders.mjs
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'vaultcare.db')

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('DB not found:', DB_PATH)
    process.exit(1)
  }

  const db = new Database(DB_PATH)
  db.pragma('foreign_keys = ON')

  const before = Number(
    db.prepare('SELECT COUNT(*) AS c FROM orders').get().c
  )

  db.exec('DELETE FROM orders')
  db.exec('DELETE FROM order_number_seq')

  db.close()

  console.log(`Purged ${before} orders, cleared order_number_seq. DB: ${DB_PATH}`)
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
