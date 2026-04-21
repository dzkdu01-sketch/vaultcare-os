/**
 * 清空 SQLite 中全部订单及订单状态流水，并重置 order_number_seq。
 * 使用前务必停掉占用 vaultcare.db 的 API 进程（如 pm2 stop），避免并发写库。
 *
 *   cd backend && npx tsx scripts/purge-all-orders.ts
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'vaultcare.db')

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('数据库不存在:', DB_PATH)
    process.exit(1)
  }

  const SQL = await initSqlJs()
  const fileBuf = fs.readFileSync(DB_PATH)
  const db = new SQL.Database(fileBuf)
  db.run('PRAGMA foreign_keys = ON')

  const countRow = db.exec('SELECT COUNT(*) AS c FROM orders')
  const before = Number(countRow[0]?.values[0]?.[0] ?? 0)

  db.run('DELETE FROM orders')
  db.run('DELETE FROM order_number_seq')

  const out = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(out))
  db.close()

  console.log(`已删除 ${before} 条订单，并清空 order_number_seq。数据库: ${DB_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
