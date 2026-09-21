/**
 * 供应商 → 中台 全自动拉货流水线（包 2 核心）
 *
 * 对应 `方案.md` 第一节的九步：
 *   1 读供应商商品清单（supplier-feed）
 *   2 按**编号（sku）**去中台 products 表找对应商品（不按名称、不按网址）
 *   3 下载素材：商品主图 + 描述里内嵌的图 + 视频
 *   4 加工：相册主图 → 800×800 白底 webp；描述内嵌图 → 原尺寸 webp；视频保持 mp4；地址一律 https
 *   5 重写描述：把供应商域名换成自己的素材地址（**不是可选项**）
 *   6 写进中台：新的建、有的更新、供应商没有的标下架（**不删除**）
 *   7 记录「变了什么」，供包 4 的日报用
 *   （第 8、9 步「推到 7 个站 / 写日报」分别是包 3、包 4 的活，这里只把数据准备好）
 *
 * 硬约束：
 *   - A3：标题、描述、价格**照抄**；相册主图允许加工（本版 800×800 白边）
 *   - A7：只按 sku 匹配
 *   - A8：共同部分照抄供应商（名称、图片、描述、编号、价格、库存、分类、标签）
 *   - A19/C2：products.sku 直接用供应商编号，老的中台自编码由 alignLegacySkus() 对齐
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type DbWrapper } from '../db/index.js'
import {
  fetchSupplierCatalog,
  fetchSupplierVideosBySku,
  normalizeFeedUrl,
  SupplierFeedError,
  type SupplierProduct,
} from './supplier-feed.js'
import {
  downloadMedia,
  mediaFileName,
  processSupplierImage,
  rewriteDescription,
  type SupplierImageRole,
} from './supplier-media.js'
import { enqueueSitePush, reconcileSites } from './site-push.js'
import { assetBaseUrl, assetKindOf } from './asset-url.js'
import {
  getUploadStats,
  openAssetUploadSession,
  remoteDirFor,
  resetUploadStats,
  uploadAssetToServer,
} from './asset-upload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 素材落地目录：backend/data/media/ */
const MEDIA_DIR = path.join(__dirname, '..', '..', 'data', 'media')

/** 图片下载超时（图片很快，60s 足够） */
const IMAGE_TIMEOUT_MS = 60_000
/**
 * 视频下载超时。
 *
 * 🔴 第 5 批 · G6-1：**从 240s 收到 90s**。
 *    原来 240s 的账算错了方向 —— 一整轮同步实测要跑 **50 分钟**，其中视频是大头：
 *    卡住的那些连接会把 240s 全耗完才失败（17 个素材里 16 个是视频）。
 *    缩到 90s 之后，坏连接失败得更快，好连接本来就 45–60 秒能下完，够用。
 *    再配上下面的**指数退避重试**，一次抖动不会直接判死刑。
 */
const VIDEO_TIMEOUT_MS = 90_000

/** 素材下载失败重试次数（G6-1：加指数退避重试） */
const MEDIA_RETRY_TIMES = 3
/** 第一次重试前等 1.5 秒，之后翻倍：1.5s → 3s */
const MEDIA_RETRY_BASE_MS = 1_500

/** 每次下载之间喘一口气，别把供应商站打急 */
const BETWEEN_DOWNLOADS_MS = 120

/**
 * 同时下载几个素材。
 * 实测供应商站单条连接只有约 110–780 KB/s，而全量一轮有 560+ 张图 + 90+ 个视频（合计 1GB 左右），
 * 串行要跑一个多小时。开 4 条并行实测能把总吞吐拉上去，也不至于把对面站打急。
 */
const MEDIA_CONCURRENCY = Math.max(1, Number(process.env.SUPPLIER_MEDIA_CONCURRENCY || 4))

/** 视频补救接口的并发（只在描述里没视频的商品上调用） */
const RECOVER_CONCURRENCY = 3

/** 需求 A1：每 48 小时自动跑一次 */
export const SYNC_INTERVAL_MS = 48 * 60 * 60 * 1000

/**
 * 素材公开地址（图片 / 视频分开）的逻辑统一放在 `./asset-url.js`。
 * 「管理中心」的设置页也要读它 —— 不该为了读一个地址把整条同步流水线拉进来。
 */

/** 供应商编号的形态：VC153 / VD01 / VDP06 / LY887 / QR35 */
const NAME_TOKEN_RE = /^[A-Z]{1,4}\d{1,4}[A-Z]?$/

const SUPPLIER_HOST_RE = /vaultcaredubai\.com/i

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowIso(): string {
  return new Date().toISOString()
}

function detailOf(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err)
}

/** 启用中的供应商里填了的清单地址；一个都没填就走默认清单。 */
async function fetchActiveSupplierCatalogs(db: DbWrapper): Promise<SupplierProduct[]> {
  const rows = db.all(
    `SELECT feed_url FROM suppliers
     WHERE COALESCE(status, 'active') = 'active'
       AND TRIM(COALESCE(feed_url, '')) != ''`,
  ) as Array<{ feed_url?: string }>
  const urls: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const url = normalizeFeedUrl(String(row.feed_url ?? ''))
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  if (urls.length === 0) return fetchSupplierCatalog()

  const merged = new Map<string, SupplierProduct>()
  for (const url of urls) {
    const part = await fetchSupplierCatalog(url)
    for (const product of part) merged.set(product.sku, product)
  }
  return [...merged.values()]
}

/** 固定并发数跑一批任务（结果由 worker 自己收） */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

function truncate(value: unknown, max = 300): string | null {
  if (value === null || value === undefined) return null
  const text = String(value)
  return text.length > max ? `${text.slice(0, max)}…(共 ${text.length} 字符)` : text
}

// ---------------------------------------------------------------------------
// 素材上传（部署时才接的插口）
// ---------------------------------------------------------------------------

/**
 * 素材的**公开地址**（只拼网址，不上传）。
 *
 * 类型（图片 / 视频）由扩展名推导 —— 图 `.webp`、视频 `.mp4`，
 * 推导出来后用**各自那个地址前缀**拼（图片走 `pic/`、视频走 `vid/`）。
 *
 * ⚠️ 第 5 批 · G6-4 改名说明：这个函数**原来叫 `uploadAsset`**，但它从来就没上传过
 * （参数都被 `void` 掉了，只拼了个网址）—— 名字骗人，所以改成 `publicAssetUrl`。
 *
 * 真上传在 `asset-upload.ts` 的 `uploadAssetToServer()`，
 * 调用点是下面第 3、4 步的下载循环（**下载完落盘后立刻传**）。
 * 两个动作分开，是因为「地址怎么拼」和「文件怎么送」是两件事：
 * 前者同步、每次都要算；后者异步、可能失败、失败也不该拦住地址的生成。
 *
 * @param fileName  按约定命名的文件名，如 `VC459-1.webp` / `VC459-s1.mp4`（视频序号小写）
 */
export function publicAssetUrl(fileName: string): string {
  return `${assetBaseUrl(assetKindOf(fileName))}/${fileName}`
}

// ---------------------------------------------------------------------------
// A19 / C2：老编号对齐
// ---------------------------------------------------------------------------

export interface SkuAlignment {
  productId: string
  oldSku: string
  newSku: string
  reason: string
}

/** 取商品名的第一个词，且必须是「编号」形态（VC153 / VDP06 / QR35 …） */
function nameToken(name: string): string | null {
  const token = String(name || '').trim().split(/\s+/)[0]
  return NAME_TOKEN_RE.test(token) ? token : null
}

/**
 * 把中台自己编的编码对齐成供应商编号（A19 / C2）。
 *
 * 现状（2026-09-17 实测本机库）：115 个商品里 12 个的 sku 是历史上按顺序自编的
 * （`VC026`、`VC081` …），真正的供应商编号写在商品名第一个词里，素材文件名也能对上：
 *   - `VC026` 名字是 `VC872 Katelyn,…`，主图是 `VC872.png`
 *   - `VC087` 名字是 `VD01 Double-Sided…`，主图是 `VD01-1.png`
 *   - `VC095` 更特殊：`VC095` 这个编号**供应商现在拿去用了另一个商品**（Prostate Massager），
 *     而这一行其实是 `VD35`。若不改，同步会把这行的内容覆盖成别人的商品。
 *
 * 判定规则（只用客观证据，不猜）：
 *   1. 名字第一个词是编号形态，且该编号**在供应商清单里**，且与当前 sku 不同；
 *   2. 目标编号没被别的商品占着。
 * 两条都满足才改。绑定了供应商（product_supplier）且编码在清单里的，也一并纠正。
 *
 * @returns 实际改动的行（供留痕与报告）
 */
export function alignLegacySkus(db: DbWrapper, feedSkus: Iterable<string>): SkuAlignment[] {
  const feed = new Set(feedSkus)
  const rows = db.all('SELECT id, sku, name FROM products ORDER BY sku') as Array<{
    id: string
    sku: string
    name: string
  }>

  const taken = new Set(rows.map((r) => r.sku))
  const bindings = db.all(
    'SELECT product_id, MIN(supplier_code) AS supplier_code FROM product_supplier GROUP BY product_id',
  ) as Array<{ product_id: string; supplier_code: string | null }>
  const boundCode = new Map(bindings.map((b) => [b.product_id, (b.supplier_code || '').trim()]))

  const alignments: SkuAlignment[] = []

  for (const row of rows) {
    let target: string | null = null
    let reason = ''

    const bound = boundCode.get(row.id)
    if (bound && bound !== row.sku && feed.has(bound) && !taken.has(bound)) {
      target = bound
      reason = `供应商绑定编码为 ${bound}`
    } else {
      const token = nameToken(row.name)
      if (token && token !== row.sku && feed.has(token) && !taken.has(token)) {
        target = token
        reason = `商品名首词与素材文件名均为 ${token}`
      }
    }

    if (!target) continue

    taken.delete(row.sku)
    taken.add(target)
    db.run('UPDATE products SET sku = ?, updated_at = ? WHERE id = ?', [target, nowIso(), row.id])
    alignments.push({ productId: row.id, oldSku: row.sku, newSku: target, reason })
  }

  return alignments
}

// ---------------------------------------------------------------------------
// 描述 HTML：补视频 + 重写域名
// ---------------------------------------------------------------------------

/**
 * 把空 `<video ...></video>` 标签补成可用的视频标签。
 *
 * 供应商 96 个商品里有 50 个的描述 HTML 是空视频标签（地址在清单里根本不存在）。
 * 补救接口能按编号找回视频地址，这里把它填回描述里，顺序与空标签一一对应，
 * 多出来的追加到描述末尾。
 */
export function fillMissingVideos(html: string, videoUrls: string[]): string {
  if (!html || videoUrls.length === 0) return html

  let cursor = 0
  const filled = html.replace(/<video\b[^>]*>\s*<\/video>/gi, () => {
    if (cursor >= videoUrls.length) return ''
    const url = videoUrls[cursor++]
    return `<video controls="controls" preload="metadata" src="${url}"></video>`
  })

  if (cursor >= videoUrls.length) return filled
  return (
    filled + videoUrls.slice(cursor).map((url) => `\n<video controls="controls" preload="metadata" src="${url}"></video>`).join('')
  )
}

/** 兜底：万一还有供应商域名残留（理论上不会），强行换掉，保证描述里 0 残留 */
function sweepResidualSupplierUrls(html: string): string {
  return html.replace(/https?:\/\/[^\s"'<>()\\]*vaultcaredubai\.com[^\s"'<>()\\]*/gi, (url) => {
    const tail = url.split('/').filter(Boolean).pop() || 'asset'
    // 按扩展名分流：图走 pic、视频走 vid
    return `${assetBaseUrl(assetKindOf(tail))}/${tail}`
  })
}

// ---------------------------------------------------------------------------
// 素材计划与下载
// ---------------------------------------------------------------------------

type MediaRole = SupplierImageRole | 'video'

interface MediaFile {
  fileName: string
  url: string
  kind: 'image' | 'video'
  role: MediaRole
  sku: string
}

interface MediaPlan {
  files: MediaFile[]
  urlToFile: Map<string, string>
}

/**
 * 为一个商品排素材：相册主图在前、描述内嵌图在后，统一编号；
 * 视频单独按 `-s1 / -s2` 编号。同一地址只存一份（先出现的角色赢，所以相册优先）。
 */
function planMedia(
  sku: string,
  galleryUrls: string[],
  embeddedUrls: string[],
  videoUrls: string[],
): MediaPlan {
  const urlToFile = new Map<string, string>()
  const files: MediaFile[] = []

  let imageIndex = 0
  const pushImage = (url: string, role: SupplierImageRole) => {
    if (urlToFile.has(url)) return
    const fileName = mediaFileName(sku, ++imageIndex, 'image')
    urlToFile.set(url, fileName)
    files.push({ fileName, url, kind: 'image', role, sku })
  }

  for (const url of [...new Set(galleryUrls)]) pushImage(url, 'gallery')
  for (const url of [...new Set(embeddedUrls)]) pushImage(url, 'embedded')

  let videoIndex = 0
  for (const url of [...new Set(videoUrls)]) {
    if (urlToFile.has(url)) continue
    const fileName = mediaFileName(sku, ++videoIndex, 'video')
    urlToFile.set(url, fileName)
    files.push({ fileName, url, kind: 'video', role: 'video', sku })
  }

  return { files, urlToFile }
}

// ---------------------------------------------------------------------------
// 同步主流程
// ---------------------------------------------------------------------------

export interface SupplierSyncResult {
  runId: number
  status: 'success' | 'failed'
  feedCount: number
  created: number
  updated: number
  delisted: number
  restored: number
  skuAligned: number
  imageOk: number
  imageFail: number
  videoOk: number
  videoFail: number
  videoRecovered: number
  mediaBytes: number
  error: string | null
  errors: string[]
  durationMs: number
}

interface ProductRow {
  id: string
  sku: string
  name: string
  short_description: string | null
  description: string | null
  sale_price: number | null
  regular_price: number | null
  images: string | null
  status: number | null
  in_stock: number | null
}

let running = false

/** 当前是否有同步在跑（手动触发接口用它防重入） */
export function isSupplierSyncRunning(): boolean {
  return running
}

/** 读最近一次同步的汇总，供调度器判断是否超期 */
export function getLastSyncRun(): Record<string, unknown> | undefined {
  return getDb().get('SELECT * FROM supplier_sync_run ORDER BY id DESC LIMIT 1')
}

function insertChange(
  db: DbWrapper,
  runId: number,
  productId: string | null,
  sku: string,
  changeType: string,
  field: string | null,
  before: unknown,
  after: unknown,
): void {
  db.run(
    `INSERT INTO supplier_sync_change (run_id, product_id, sku, change_type, field, before_value, after_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, productId, sku, changeType, field, truncate(before), truncate(after), nowIso()],
  )
}

/** 一个分类存名字；多个就存 JSON，推送时再拆开。 */
function categoryValue(names: string[]): string | null {
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return JSON.stringify(names)
}

/**
 * 跑一轮完整同步。九步流水线的实现。
 *
 * 读不到供应商清单时（被斗篷挡 / 超时 / 格式变）会把失败原因写进 `supplier_sync_run`，
 * 供包 4 的日报做断线告警（A17），然后把错误抛出去。
 */
export async function syncSupplierCatalog(): Promise<SupplierSyncResult> {
  if (running) throw new Error('已有一轮供应商同步在进行中，本次跳过')
  running = true

  const db = getDb()
  const startedAt = Date.now()
  const startedIso = nowIso()

  db.run(
    `INSERT INTO supplier_sync_run (started_at, status) VALUES (?, 'running')`,
    [startedIso],
  )
  const runId = Number(
    (db.get('SELECT last_insert_rowid() AS id') as { id: number } | undefined)?.id ?? 0,
  )

  const errors: string[] = []
  /**
   * G6-4：「素材传不上去」和「素材下载失败」是两件事，分开记。
   * 下载成功但传不出去 → 本机有、站点上没有 = 客户看到缺图，必须单独看得见。
   */
  const uploadErrors: string[] = []
  // 上传计数每轮清零（界面上的「本轮传上去几个」才是本轮的，不是历史累计）
  resetUploadStats()
  let finished = false
  const stats = {
    feedCount: 0,
    created: 0,
    updated: 0,
    delisted: 0,
    restored: 0,
    skuAligned: 0,
    imageOk: 0,
    imageFail: 0,
    videoOk: 0,
    videoFail: 0,
    videoRecovered: 0,
    mediaBytes: 0,
  }

  const finish = (status: 'success' | 'failed', error: string | null): void => {
    finished = true
    db.run(
      `UPDATE supplier_sync_run SET finished_at = ?, status = ?, feed_count = ?, created_count = ?,
         updated_count = ?, delisted_count = ?, restored_count = ?, sku_aligned_count = ?,
         image_ok = ?, image_fail = ?, video_ok = ?, video_fail = ?, video_recovered = ?,
         media_bytes = ?, error = ?, detail = ?
       WHERE id = ?`,
      [
        nowIso(),
        status,
        stats.feedCount,
        stats.created,
        stats.updated,
        stats.delisted,
        stats.restored,
        stats.skuAligned,
        stats.imageOk,
        stats.imageFail,
        stats.videoOk,
        stats.videoFail,
        stats.videoRecovered,
        stats.mediaBytes,
        error,
        // ⚠️ `errors` 只放「下载失败」——「读不到的素材」那一页（C5b）解析的就是它。
        // 「传不上去」另起一个键，别混进去，否则那一页会把上传失败也当成「读不到」。
        JSON.stringify({
          errors: errors.slice(0, 200),
          upload_errors: uploadErrors.slice(0, 200),
        }),
        runId,
      ],
    )
  }

  try {
    // ---- 第 1 步：读供应商商品清单 ------------------------------------------
    let feed: SupplierProduct[]
    try {
      feed = await fetchActiveSupplierCatalogs(db)
    } catch (err) {
      // A17：读不到 → 把分类原因落库，日报据此告警
      const reason = err instanceof SupplierFeedError ? err.reason : 'NETWORK'
      const message = `[${reason}] ${detailOf(err)}`
      finish('failed', message)
      throw err
    }
    stats.feedCount = feed.length
    console.log(`[供应商同步] 第 1 步：清单读到 ${feed.length} 个商品`)

    // ---- 第 2 步（前置）：A19 老编号对齐 ------------------------------------
    const feedSkus = new Set(feed.map((p) => p.sku))
    const alignments = alignLegacySkus(db, feedSkus)
    stats.skuAligned = alignments.length
    for (const item of alignments) {
      insertChange(db, runId, item.productId, item.newSku, 'sku_align', 'sku', item.oldSku, item.newSku)
      console.log(`[供应商同步] 编号对齐：${item.oldSku} → ${item.newSku}（${item.reason}）`)
    }

    fs.mkdirSync(MEDIA_DIR, { recursive: true })

    // ---- 第 3 步（前置）：描述里抓不到视频的，用媒体库接口补一次 ----------------
    // 只在「描述里一个视频都没有」时才查，不做 96 个商品无脑全查。
    const needRecover = feed.filter((p) => p.videos.length === 0)
    const recoveredMap = new Map<string, string[]>()
    if (needRecover.length > 0) {
      await runPool(needRecover, RECOVER_CONCURRENCY, async (product) => {
        const found = await fetchSupplierVideosBySku(product.sku)
        if (found.length > 0) {
          recoveredMap.set(product.sku, found)
          stats.videoRecovered += found.length
          console.log(`[供应商同步] ${product.sku}：描述里没有视频，媒体库补救到 ${found.length} 个`)
        }
      })
      console.log(
        `[供应商同步] 视频补救：${needRecover.length} 个商品描述里没有视频，命中 ${recoveredMap.size} 个`,
      )
    }

    // ---- 第 2 步：按编号认商品 + 排素材计划 ----------------------------------
    interface Prepared {
      product: SupplierProduct
      descriptionHtml: string
      plan: MediaPlan
    }
    const prepared: Prepared[] = []
    const allFiles = new Map<string, MediaFile>()

    for (const product of feed) {
      let descriptionHtml = product.descriptionHtml
      let videos = product.videos
      const recovered = recoveredMap.get(product.sku)
      if (videos.length === 0 && recovered) {
        // 把补救到的视频填回描述里的空 <video> 标签
        descriptionHtml = fillMissingVideos(descriptionHtml, recovered)
        videos = recovered
      }

      const plan = planMedia(product.sku, product.images, product.embeddedImages, videos)
      for (const file of plan.files) allFiles.set(file.fileName, file)
      prepared.push({ product, descriptionHtml, plan })
    }

    console.log(`[供应商同步] 第 3、4 步：共 ${allFiles.size} 个素材文件待下载（并发 ${MEDIA_CONCURRENCY}）`)

    // ---- 第 3、4 步：下载素材 + 加工（图片转 webp，视频保持 mp4）------------
    //
    // 🔴 第 5 批 · G6-4：下载完**顺手真上传**到素材服务器。
    // 原来只有下载、没有上传 —— 本机攒了 655 个素材，站点上引用的却是
    // `https://vault-me.site/pic/xxx.webp`，没被手工传过的全是 404（客户看到缺图）。
    // 这里开一条 FTP 长连接，整个下载循环复用（不每个文件都重新登录）。
    // 上传失败不抛：一个素材传不上去，不该让整轮同步挂掉。
    const uploadSession = await openAssetUploadSession()
    if (!uploadSession.cfg.enabled) {
      console.warn(`[素材上传] 没开：${uploadSession.cfg.disabledReason}`)
    } else {
      console.log(
        `[素材上传] 已连上 ${uploadSession.cfg.host}:${uploadSession.cfg.port}（${
          uploadSession.cfg.secure === 'off' ? '普通 FTP' : `${uploadSession.cfg.secure} FTPS`
        }）；图片 → ${remoteDirFor('image')}，视频 → ${remoteDirFor('video')}`,
      )
    }

    /** 相册主图字节变了（URL 可能没变）→ 仍要推站，否则 7 站还是旧图 */
    const rewrittenGallerySkus = new Set<string>()
    const originalDir = path.join(MEDIA_DIR, 'original')
    /** basic-ftp 一个 Client 不能并行发命令，下载并发 4 时上传必须排队 */
    let uploadChain = Promise.resolve()
    const enqueueUpload = <T,>(fn: () => Promise<T>): Promise<T> => {
      const run = uploadChain.then(fn, fn)
      uploadChain = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    }

    let downloaded = 0
    await runPool([...allFiles.values()], MEDIA_CONCURRENCY, async (file) => {
      const target = path.join(MEDIA_DIR, file.fileName)
      const timeout = file.kind === 'video' ? VIDEO_TIMEOUT_MS : IMAGE_TIMEOUT_MS
      try {
        /*
         * 🔴 第 5 批 · G6-1：**指数退避重试**。
         * 原来一次失败就记一笔错误、这个素材就空了（17 个素材就是这么攒出来的）。
         * 现在同一个文件最多试 3 次，间隔 1.5s → 3s —— 对面一抖不至于直接判死刑。
         */
        let output: Buffer | null = null
        let lastErr: unknown = null
        for (let attempt = 1; attempt <= MEDIA_RETRY_TIMES; attempt++) {
          try {
            const raw = await downloadMedia(file.url, timeout)
            if (file.role === 'gallery') {
              try {
                fs.mkdirSync(originalDir, { recursive: true })
                fs.writeFileSync(path.join(originalDir, file.fileName.replace(/\.webp$/i, '')), raw)
              } catch (backupErr) {
                console.warn(
                  `[供应商同步] 原图备份失败 ${file.fileName}：${detailOf(backupErr)}（继续加工）`,
                )
              }
            }
            output =
              file.kind === 'image'
                ? await processSupplierImage(raw, file.role === 'gallery' ? 'gallery' : 'embedded')
                : raw
            break
          } catch (err) {
            lastErr = err
            if (attempt < MEDIA_RETRY_TIMES) {
              await sleep(MEDIA_RETRY_BASE_MS * 2 ** (attempt - 1))
            }
          }
        }
        if (!output) throw lastErr ?? new Error('下载失败')
        // 下载 + 加工都成功了才落盘，避免把已有的好文件覆盖成半个
        let previous: Buffer | null = null
        try {
          if (fs.existsSync(target)) previous = fs.readFileSync(target)
        } catch {
          previous = null
        }
        fs.writeFileSync(target, output)
        if (file.role === 'gallery' && (!previous || !previous.equals(output))) {
          rewrittenGallerySkus.add(file.sku)
        }
        if (file.kind === 'image') stats.imageOk++
        else stats.videoOk++
        stats.mediaBytes += output.length

        // G6-4：落盘之后立刻传到素材服务器。传不上去只记一笔，不算这一轮素材失败
        // （素材本身是好的，问题在「送不出去」，两件事分开算，别混成一个数）
        const up = await enqueueUpload(() =>
          uploadAssetToServer(target, file.fileName, {
            cfg: uploadSession.cfg,
            client: uploadSession.client ?? undefined,
          }),
        )
        if (!up.ok) {
          const message = `${file.fileName} 传到素材服务器失败：${up.reason}`
          uploadErrors.push(message)
          console.warn(`[素材上传] ${message}`)
        }
      } catch (err) {
        if (file.kind === 'image') stats.imageFail++
        else stats.videoFail++
        const message = `${file.fileName} ← ${file.url}：${detailOf(err)}`
        errors.push(message)
        console.warn(`[供应商同步] 素材失败 ${message}`)
      }
      downloaded++
      if (downloaded % 50 === 0) {
        console.log(`[供应商同步] 素材进度 ${downloaded}/${allFiles.size}`)
      }
      await sleep(BETWEEN_DOWNLOADS_MS)
    })

    // G6-4：下载 + 上传都完事了，把这条 FTP 长连接关掉
    uploadSession.close()
    const upStats = getUploadStats()
    if (uploadSession.cfg.enabled) {
      console.log(
        `[素材上传] 本轮：尝试 ${upStats.attempted} 个 · 真传上去 ${upStats.uploaded} 个 · ` +
          `远端已有跳过 ${upStats.skipped} 个 · 失败 ${upStats.failed} 个` +
          (upStats.lastError ? `（最后一个错误：${upStats.lastError}）` : ''),
      )
    }

    // ---- 第 5、6 步：重写描述 + 写进中台 ------------------------------------
    const seenSkus = new Set<string>()
    /** 包 3 / C1：本轮改动过的商品，同步结束后自动推到所有站点 */
    const affectedProductIds = new Set<string>()

    for (const { product, descriptionHtml, plan } of prepared) {
      seenSkus.add(product.sku)
      const existing = db.get('SELECT * FROM products WHERE sku = ?', [product.sku]) as
        | ProductRow
        | undefined

      // 第 5 步：重写描述 —— 供应商域名换成自己的素材地址
      const assetUrlFor = (origUrl: string): string => {
        const fileName = plan.urlToFile.get(origUrl)
        if (!fileName) return origUrl
        // 地址而已 —— 文件早在上面第 3、4 步就传上去了（G6-4）
        return publicAssetUrl(fileName)
      }

      let description: string
      try {
        description = rewriteDescription(descriptionHtml, assetUrlFor)
      } catch (err) {
        // 理论上不会走到（实测供应商描述里没有非图片/视频的自家链接），留个兜底
        const message = `${product.sku} 描述重写异常：${detailOf(err)}`
        errors.push(message)
        console.warn(`[供应商同步] ${message}`)
        description = sweepResidualSupplierUrls(descriptionHtml)
      }
      let shortDescription: string
      try {
        shortDescription = rewriteDescription(product.shortDescriptionHtml, assetUrlFor)
      } catch {
        shortDescription = sweepResidualSupplierUrls(product.shortDescriptionHtml)
      }

      const images = [...new Set(product.images)].map((url) => {
        const fileName = plan.urlToFile.get(url)
        return fileName ? publicAssetUrl(fileName) : url
      })

      const inStock = product.inStock ? 1 : 0
      const ts = nowIso()

      // 第 6 步：写进中台 —— 新的建
      if (!existing) {
        const id = `prod-${uuidv4().slice(0, 8)}`
        db.run(
          `INSERT INTO products (id, sku, name, short_description, description, sale_price,
             regular_price, category, tags, images, status, catalog_in, in_stock, permalink,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`,
          [
            id,
            product.sku,
            product.name,
            shortDescription,
            description,
            product.salePrice,
            product.regularPrice,
            categoryValue(product.categories),
            JSON.stringify(product.tags),
            JSON.stringify(images),
            inStock,
            product.permalink || null,
            ts,
            ts,
          ],
        )
        stats.created++
        affectedProductIds.add(id)
        insertChange(db, runId, id, product.sku, 'create', null, null, `${product.name}（${product.salePrice}）`)
        continue
      }

      // 第 6 步：写进中台 —— 有的更新
      const changes: Array<[string, string, string, unknown, unknown]> = []
      if (existing.name !== product.name) changes.push(['content', 'name', 'content', existing.name, product.name])
      if ((existing.description ?? '') !== description) {
        changes.push(['content', 'description', 'content', existing.description ?? '', description])
      }
      if ((existing.short_description ?? '') !== shortDescription) {
        changes.push([
          'content',
          'short_description',
          'content',
          existing.short_description ?? '',
          shortDescription,
        ])
      }
      if (Number(existing.sale_price ?? 0) !== product.salePrice) {
        changes.push(['price', 'sale_price', 'price', existing.sale_price ?? 0, product.salePrice])
      }
      if (Number(existing.regular_price ?? 0) !== product.regularPrice) {
        changes.push([
          'price',
          'regular_price',
          'price',
          existing.regular_price ?? 0,
          product.regularPrice,
        ])
      }
      if (Number(existing.in_stock ?? 1) !== inStock) {
        changes.push(['stock', 'in_stock', 'stock', existing.in_stock ?? 1, inStock])
      }
      const imagesJson = JSON.stringify(images)
      if ((existing.images ?? '') !== imagesJson) {
        changes.push([
          'content',
          'images',
          'content',
          `${(JSON.parse(existing.images || '[]') as string[]).length} 张`,
          `${images.length} 张`,
        ])
      } else if (rewrittenGallerySkus.has(product.sku)) {
        // URL 没变、像素变了（例如统一成 800×800）—— 不记这条 7 站不会换图
        changes.push(['content', 'images', 'content', '原尺寸', '800×800'])
      }
      if (Number(existing.status ?? 1) !== 1) {
        changes.push(['restore', 'status', 'restore', '已下架', '上架'])
        stats.restored++
      }
      const nextCategory = categoryValue(product.categories)
      const nextTags = JSON.stringify(product.tags)
      const existingRow = existing as ProductRow & { category?: string | null; tags?: string | null }
      if ((existingRow.category ?? '') !== (nextCategory ?? '')) {
        changes.push(['content', 'category', 'content', existingRow.category ?? '', nextCategory ?? ''])
      }
      if ((existingRow.tags ?? '[]') !== nextTags) {
        changes.push(['content', 'tags', 'content', existingRow.tags ?? '[]', nextTags])
      }

      db.run(
        `UPDATE products SET name = ?, short_description = ?, description = ?, sale_price = ?,
           regular_price = ?, category = ?, tags = ?, images = ?, status = 1, in_stock = ?, permalink = ?, updated_at = ?
         WHERE id = ?`,
        [
          product.name,
          shortDescription,
          description,
          product.salePrice,
          product.regularPrice,
          nextCategory,
          nextTags,
          imagesJson,
          inStock,
          product.permalink || null,
          ts,
          existing.id,
        ],
      )
      stats.updated++
      if (changes.length > 0) affectedProductIds.add(existing.id)

      for (const [changeType, field, _kind, before, after] of changes) {
        insertChange(db, runId, existing.id, product.sku, changeType, field, before, after)
      }
    }

    // ---- 第 6 步：供应商已经没有的商品 → 标记下架（不删除） -------------------
    const stale = db.all(
      "SELECT id, sku, name, status FROM products WHERE status = 1 ORDER BY sku",
    ) as Array<{ id: string; sku: string; name: string; status: number }>

    for (const row of stale) {
      if (seenSkus.has(row.sku)) continue
      db.run('UPDATE products SET status = 0, in_stock = 0, updated_at = ? WHERE id = ?', [
        nowIso(),
        row.id,
      ])
      stats.delisted++
      affectedProductIds.add(row.id)
      insertChange(db, runId, row.id, row.sku, 'delist', 'status', '上架', '下架（供应商已无此商品）')
    }

    // ---- 第 8 步（包 3 / C1）：本轮变了的商品，自动推到所有站点 ----------------
    if (affectedProductIds.size > 0) {
      enqueueSitePush([...affectedProductIds], 'supplier_sync')
      console.log(`[供应商同步] 第 8 步：${affectedProductIds.size} 个商品已入自动推送队列（包 3）`)
    } else {
      console.log('[供应商同步] 第 8 步：本轮无商品变更，不需要推送')
    }

    // 每次供应商更新后对齐各站：少的上架、多的改草稿（不删除）
    void reconcileSites({ source: 'reconcile' })
      .then((r) => {
        console.log(
          `[供应商同步] 站点对齐：补齐 ${r.total_filled}｜改草稿 ${r.total_drafted}｜失败 ${r.total_failed}｜一致=${r.consistent}`,
        )
      })
      .catch((err) => {
        console.error(`[供应商同步] 站点对齐失败：${err instanceof Error ? err.message : String(err)}`)
      })

    finish('success', null)

    const result: SupplierSyncResult = {
      runId,
      status: 'success',
      ...stats,
      error: null,
      errors,
      durationMs: Date.now() - startedAt,
    }
    console.log(
      `[供应商同步] 完成：清单 ${stats.feedCount}｜新建 ${stats.created}｜更新 ${stats.updated}｜下架 ${stats.delisted}｜重新上架 ${stats.restored}｜编号对齐 ${stats.skuAligned}｜图片 ${stats.imageOk} 成功/${stats.imageFail} 失败｜视频 ${stats.videoOk} 成功/${stats.videoFail} 失败（补救 ${stats.videoRecovered}）`,
    )
    return result
  } catch (err) {
    // 已经在前面 finish 过的（例如清单读不到）不要重复写
    if (!finished) finish('failed', detailOf(err))
    throw err
  } finally {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 调度（A1：每 48 小时一次）
// ---------------------------------------------------------------------------

/**
 * 注册 48 小时定时器。在 `backend/src/index.ts` 里调用。
 *
 * - 默认只挂定时器，不立刻跑（避免每次重启后端都拉一轮几十分钟的全量同步）
 * - 设 `SUPPLIER_SYNC_ON_START=true` 时，启动后立刻补跑一轮（生产建议打开）
 * - 启动时会看一眼上次运行时间，超过 48 小时就明确告警（A17 的「断线要能发现」）
 */
export function startSupplierSyncScheduler(): void {
  let last: Record<string, unknown> | undefined
  try {
    last = getLastSyncRun()
  } catch {
    last = undefined
  }

  const lastStarted = typeof last?.started_at === 'string' ? (last.started_at as string) : null
  const lastStatus = typeof last?.status === 'string' ? (last.status as string) : null
  const overdue = !lastStarted || Date.now() - Date.parse(lastStarted) > SYNC_INTERVAL_MS

  console.log(
    `[供应商同步] 已调度：每 48 小时自动跑一次。上次运行：${
      lastStarted ? `${lastStarted}（${lastStatus}）` : '从未'
    }`,
  )
  if (overdue) {
    console.warn(
      '[供应商同步] ⚠️ 距上次成功同步已超过 48 小时（或从未跑过）—— 请手动触发 POST /api/v1/suppliers/sync',
    )
  }

  setInterval(() => {
    if (running) {
      console.warn('[供应商同步] 上一轮还没跑完，本轮跳过')
      return
    }
    syncSupplierCatalog().catch((err) => {
      console.error(`[供应商同步] 定时任务失败：${detailOf(err)}`)
    })
  }, SYNC_INTERVAL_MS).unref()

  if (process.env.SUPPLIER_SYNC_ON_START === 'true') {
    console.log('[供应商同步] SUPPLIER_SYNC_ON_START=true，启动后立刻补跑一轮')
    syncSupplierCatalog().catch((err) => {
      console.error(`[供应商同步] 启动补跑失败：${detailOf(err)}`)
    })
  } else {
    console.log('[供应商同步] 启动补跑：关闭（要打开就设 SUPPLIER_SYNC_ON_START=true）')
  }
}

/** 素材落地目录，供脚本核对文件用 */
export function getMediaDir(): string {
  return MEDIA_DIR
}

export { SUPPLIER_HOST_RE }
