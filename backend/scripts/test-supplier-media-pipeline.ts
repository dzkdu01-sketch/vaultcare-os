/**
 * 验收脚本：供应商抓取 + 素材加工 全链路真跑
 *
 * 流程：抓清单 → 下主图/内嵌图/视频 → 主图 800×800 白底 webp、内嵌图原尺寸 webp、视频保持 mp4 → 重写描述 → 落盘
 * 输出目录：backend/data/media-test/
 *
 * 说明：视频单独一批、串行下载。实测供应商站视频只有 ~350KB/s，
 * 14MB 的文件需要 ~41s，若与几十张图片并发抢带宽会撞上 downloadMedia 的 60s 超时。
 *
 * 用法：npx tsx scripts/test-supplier-media-pipeline.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchSupplierCatalog, type SupplierProduct } from '../src/services/supplier-feed.js'
import {
  downloadMedia,
  listSupplierAssetUrls,
  mediaFileName,
  rewriteDescription,
  optimizeGalleryImage,
  toWebp,
} from '../src/services/supplier-media.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../data/media-test')

/** 挑这 3 个：VC459 只有内嵌图且 <video> 是空标签；VC038 视频在 <video src>；VD51 视频在 <video> 内的 <a href> */
const TARGET_SKUS = ['VC459', 'VC038', 'VD51']

/** 自己的素材地址前缀。视频故意用 http，用来验证重写时会被提升成 https */
const ASSET_BASE_IMAGE = 'https://assets.vaultcare.ae/media'
const ASSET_BASE_VIDEO = 'http://assets.vaultcare.ae/media'

const IMAGE_CONCURRENCY = 6
const VIDEO_CONCURRENCY = 1

/**
 * 视频单独给更长的超时预算。
 * 实测供应商站约 320KB/s，视频 14.4MB / 19.2MB 需 44s / 56s，
 * downloadMedia 默认的 60s（按需求约定）会随网络波动而失败。
 */
const VIDEO_TIMEOUT_MS = 240_000

type Kind = 'image' | 'video'
type Folder = 'main' | 'embedded' | 'video'

interface Task {
  url: string
  kind: Kind
  folder: Folder
  index: number
}

interface AssetOutcome {
  url: string
  kind: Kind
  folder: Folder
  fileName: string
  relativePath: string
  assetUrl: string
  ok: boolean
  attempts: number
  downloadedBytes: number
  writtenBytes: number
  elapsedMs: number
  error?: string
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function buildOutcome(product: SupplierProduct, task: Task): AssetOutcome {
  const fileName = mediaFileName(product.sku, task.index, task.kind)
  return {
    url: task.url,
    kind: task.kind,
    folder: task.folder,
    fileName,
    relativePath: `${task.folder}/${fileName}`,
    assetUrl: `${task.kind === 'image' ? ASSET_BASE_IMAGE : ASSET_BASE_VIDEO}/${task.folder}/${fileName}`,
    ok: false,
    attempts: 0,
    downloadedBytes: 0,
    writtenBytes: 0,
    elapsedMs: 0,
  }
}

/** 下载一个素材：图片转 webp，视频原样保存。只尝试一次，重试由外层统一安排。 */
async function attemptAsset(product: SupplierProduct, task: Task): Promise<AssetOutcome> {
  const outcome = buildOutcome(product, task)
  const startedAt = Date.now()
  outcome.attempts = 1

  try {
    const raw = await downloadMedia(
      task.url,
      task.kind === 'video' ? VIDEO_TIMEOUT_MS : undefined,
    )
    outcome.downloadedBytes = raw.length
    const finalBuffer =
      task.kind === 'image'
        ? task.folder === 'main'
          ? await optimizeGalleryImage(raw)
          : await toWebp(raw)
        : raw
    outcome.writtenBytes = finalBuffer.length
    await writeFile(path.join(OUT_DIR, task.folder, outcome.fileName), finalBuffer)
    outcome.ok = true
  } catch (err) {
    outcome.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  }

  outcome.elapsedMs = Date.now() - startedAt
  return outcome
}

/**
 * 跑一批任务：先并发/串行跑一轮，失败的原样再跑一轮（共 2 轮）。
 * 重试轮不隐藏首轮失败 —— 两个数字都会带出来。
 */
async function runBatch(
  product: SupplierProduct,
  tasks: Task[],
  concurrency: number,
): Promise<AssetOutcome[]> {
  const first = await mapLimit(tasks, concurrency, (task) => attemptAsset(product, task))
  const failed = first.filter((o) => !o.ok)
  if (failed.length === 0) return first

  const retried = await mapLimit(failed, concurrency, async (outcome) => {
    const again = await attemptAsset(
      product,
      tasks.find((t) => t.url === outcome.url)!,
    )
    again.attempts = 2
    return again.ok ? again : { ...again, error: again.error, attempts: 2 }
  })

  const byUrl = new Map(retried.map((o) => [o.url, o]))
  return first.map((o) => (o.ok ? o : (byUrl.get(o.url) ?? o)))
}

async function main(): Promise<void> {
  console.log('='.repeat(72))
  console.log('供应商抓取 + 素材加工 全链路验收')
  console.log('='.repeat(72))

  for (const folder of ['main', 'embedded', 'video']) {
    await mkdir(path.join(OUT_DIR, folder), { recursive: true })
  }

  // ---------- 1. 抓清单 ----------
  const t0 = Date.now()
  const catalog = await fetchSupplierCatalog()
  const fetchMs = Date.now() - t0
  console.log(`\n[1] 抓清单成功：${catalog.length} 个商品，耗时 ${fetchMs}ms`)
  console.log(`    含内嵌图片的商品数: ${catalog.filter((p) => p.embeddedImages.length > 0).length}`)
  console.log(`    含视频的商品数:     ${catalog.filter((p) => p.videos.length > 0).length}`)

  const summary: Array<Record<string, unknown>> = []

  for (const sku of TARGET_SKUS) {
    const product = catalog.find((p) => p.sku === sku)
    if (!product) {
      console.log(`\n[!] 清单里找不到 ${sku}，跳过`)
      summary.push({ sku, found: false })
      continue
    }

    console.log('\n' + '-'.repeat(72))
    console.log(`[商品] ${product.sku}  ${product.name}`)
    console.log(
      `  价格 regular=${product.regularPrice} sale=${product.salePrice} 库存=${product.inStock ? '有货' : '缺货'}`,
    )
    console.log(
      `  原始描述 ${product.descriptionHtml.length} 字符 | 内嵌图 ${product.embeddedImages.length} 张 | 视频 ${product.videos.length} 个 | 主图共 ${product.images.length} 张(本轮只下第1张)`,
    )

    const residualBefore = (product.descriptionHtml.match(/vaultcaredubai\.com/gi) || []).length
    console.log(`  原始描述里 vaultcaredubai.com 出现次数: ${residualBefore}`)

    const imageTasks: Task[] = [
      ...product.images.slice(0, 1).map((url, i) => ({
        url,
        kind: 'image' as const,
        folder: 'main' as const,
        index: i + 1,
      })),
      ...product.embeddedImages.map((url, i) => ({
        url,
        kind: 'image' as const,
        folder: 'embedded' as const,
        index: i + 1,
      })),
    ]
    const videoTasks: Task[] = product.videos.map((url, i) => ({
      url,
      kind: 'video' as const,
      folder: 'video' as const,
      index: i + 1,
    }))

    // 图片一批，视频单独一批串行，避免抢带宽撞 60s 超时
    const imageOutcomes = await runBatch(product, imageTasks, IMAGE_CONCURRENCY)
    const videoOutcomes = await runBatch(product, videoTasks, VIDEO_CONCURRENCY)
    const allOutcomes = [...imageOutcomes, ...videoOutcomes]

    // 用真实落盘结果建「原始地址 → 自己的素材地址」映射
    const assetUrlByOrig = new Map<string, string>()
    for (const outcome of allOutcomes) assetUrlByOrig.set(outcome.url, outcome.assetUrl)

    let fallbackLookups = 0
    const rewrittenHtml = rewriteDescription(product.descriptionHtml, (origUrl, kind) => {
      const mapped = assetUrlByOrig.get(origUrl)
      if (mapped) return mapped
      // 重写不能依赖下载成功：没下到的也要换成自己的地址
      fallbackLookups++
      const base = kind === 'image' ? ASSET_BASE_IMAGE : ASSET_BASE_VIDEO
      const name = path.basename(new URL(origUrl).pathname)
      return `${base}/unresolved/${name}`
    })

    const residualAfter = (rewrittenHtml.match(/vaultcaredubai\.com/gi) || []).length
    const httpAfter = (rewrittenHtml.match(/http:\/\//gi) || []).length
    const supplierAssetUrls = listSupplierAssetUrls(product.descriptionHtml)

    await writeFile(path.join(OUT_DIR, `${sku}.description.html`), rewrittenHtml, 'utf8')

    const report = (label: string, list: AssetOutcome[]) => {
      const ok = list.filter((o) => o.ok).length
      const retriedOk = list.filter((o) => o.ok && o.attempts > 1).length
      const retriedFail = list.filter((o) => !o.ok && o.attempts > 1).length
      const notes: string[] = []
      if (retriedOk > 0) notes.push(`${retriedOk} 个重试后成功`)
      if (retriedFail > 0) notes.push(`${retriedFail} 个重试后仍失败`)
      console.log(`  ${label}: ${ok}/${list.length} 成功${notes.length ? `（${notes.join('，')}）` : ''}`)
    }
    report('主图  ', imageOutcomes.filter((o) => o.folder === 'main'))
    report('内嵌图', imageOutcomes.filter((o) => o.folder === 'embedded'))
    report('视频  ', videoOutcomes)

    const failures = allOutcomes.filter((o) => !o.ok)
    for (const f of failures) {
      console.log(`    [最终失败] ${f.url}`)
      console.log(`               ${f.attempts} 次尝试均失败 | ${f.error}`)
    }

    const videoTiming = videoOutcomes
      .filter((o) => o.ok)
      .map((o) => `${o.fileName} ${(o.writtenBytes / 1024 / 1024).toFixed(1)}MB/${(o.elapsedMs / 1000).toFixed(1)}s`)
    if (videoTiming.length > 0) console.log(`    视频耗时: ${videoTiming.join(', ')}`)

    console.log(
      `  重写: 供应商素材地址 ${supplierAssetUrls.length} 个 | 重写后残留 vaultcaredubai.com = ${residualAfter} | 重写后 http:// = ${httpAfter}`,
    )
    if (fallbackLookups > 0) console.log(`    兜底映射（未下载到的地址）次数: ${fallbackLookups}`)

    summary.push({
      sku,
      found: true,
      name: product.name,
      embeddedImages: product.embeddedImages.length,
      videos: product.videos.length,
      mainImagesTotal: product.images.length,
      imageOk: imageOutcomes.filter((o) => o.ok).length,
      imageTotal: imageOutcomes.length,
      videoOk: videoOutcomes.filter((o) => o.ok).length,
      videoTotal: videoOutcomes.length,
      residualBefore,
      residualAfter,
      httpAfter,
      htmlBytes: Buffer.byteLength(rewrittenHtml, 'utf8'),
      outcomes: allOutcomes,
    })
  }

  // ---------- 汇总 ----------
  console.log('\n' + '='.repeat(72))
  console.log('汇总')
  console.log('='.repeat(72))
  for (const row of summary) {
    if (!row.found) {
      console.log(`${row.sku}: 未在清单中找到`)
      continue
    }
    console.log(
      `${row.sku}: 内嵌图 ${row.embeddedImages} / 视频 ${row.videos} | ` +
        `下载成功 图 ${row.imageOk}/${row.imageTotal} 视频 ${row.videoOk}/${row.videoTotal} | ` +
        `残留域名 ${row.residualBefore} → ${row.residualAfter} | 重写后 http:// ${row.httpAfter}`,
    )
  }

  const totalResidual = summary.reduce((a, r) => a + ((r.residualAfter as number) || 0), 0)
  const totalFailed = summary.reduce(
    (a, r) => a + (((r.imageTotal as number) || 0) - ((r.imageOk as number) || 0)) + (((r.videoTotal as number) || 0) - ((r.videoOk as number) || 0)),
    0,
  )
  console.log(`\n全部商品重写后残留 vaultcaredubai.com 总数: ${totalResidual}`)
  console.log(`全部最终下载失败总数: ${totalFailed}`)
  console.log(`落盘目录: ${OUT_DIR}`)

  // 失败明细汇总
  const allFailures = summary.flatMap((r) =>
    ((r.outcomes as AssetOutcome[]) || []).filter((o) => !o.ok),
  )
  if (allFailures.length > 0) {
    console.log('\n失败明细:')
    for (const f of allFailures) console.log(`  - ${f.url}\n    ${f.error}`)
  }
}

main().catch((err) => {
  console.error('\n验收脚本失败：')
  console.error(err)
  process.exitCode = 1
})
