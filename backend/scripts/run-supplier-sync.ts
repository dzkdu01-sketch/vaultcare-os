/**
 * 手动跑一轮供应商同步（等同界面「立刻同步一次」）
 *
 * 用法：npx tsx scripts/run-supplier-sync.ts
 */
import '../src/load-env.js'
import { initDb } from '../src/db/index.js'
import { runSupplierSyncWithAlert } from '../src/services/daily-report.js'

await initDb()
console.log('[立刻同步] 开始')
const r = await runSupplierSyncWithAlert()
const summary = {
  ok: r.ok,
  status: r.result?.status ?? null,
  feedCount: r.result?.feedCount ?? null,
  created: r.result?.created ?? null,
  updated: r.result?.updated ?? null,
  delisted: r.result?.delisted ?? null,
  imageOk: r.result?.imageOk ?? null,
  imageFail: r.result?.imageFail ?? null,
  videoOk: r.result?.videoOk ?? null,
  videoFail: r.result?.videoFail ?? null,
  durationMs: r.result?.durationMs ?? null,
  error: r.result?.error ?? null,
  errorCount: r.result?.errors?.length ?? 0,
  errorsHead: r.result?.errors?.slice(0, 15) ?? [],
}
console.log('[立刻同步] 结束')
console.log(JSON.stringify(summary, null, 2))
if (!r.ok) process.exit(1)
