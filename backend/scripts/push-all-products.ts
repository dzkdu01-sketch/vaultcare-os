/**
 * 把中台在架商品全部再推一遍站点（同步结束后 FTP 已补上、但推站被单站 401 打断时用）
 *
 * 用法：npx tsx scripts/push-all-products.ts
 */
import '../src/load-env.js'
import { getDb, initDb } from '../src/db/index.js'
import { pushProductsToSites } from '../src/services/site-push.js'

await initDb()
const rows = getDb().all("SELECT id FROM products WHERE status = 1 ORDER BY sku") as Array<{
  id: string
}>
const ids = rows.map((r) => r.id)
console.log(`[全量推站] ${ids.length} 个在架商品`)
const out = await pushProductsToSites(ids, { source: 'supplier_sync' })
console.log(
  `[全量推站] 完成：商品 ${out.products}｜站点 ${out.sites}｜新建 ${out.created}｜更新 ${out.updated}｜无变化 ${out.skipped}｜失败 ${out.failed}｜停推 ${out.blocked}`,
)
if (out.errors.length > 0) {
  console.log(`[全量推站] 失败明细（前 20）：`)
  for (const line of out.errors.slice(0, 20)) console.log(`  ${line}`)
}
