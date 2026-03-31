/**
 * 一次性清空所有产品（含 product_sync / product_supplier 级联；货源 mapped_product_id 置空）。
 * 运行：npx tsx scripts/clear-all-products.ts
 */
import { initDb, getDb } from '../src/db/index.js'

async function main() {
  await initDb()
  const db = getDb()
  const before = db.get('SELECT COUNT(*) as c FROM products') as { c: number }
  db.run('DELETE FROM products')
  const after = db.get('SELECT COUNT(*) as c FROM products') as { c: number }
  console.log(`Deleted all products. Before: ${before.c}, after: ${after.c}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
