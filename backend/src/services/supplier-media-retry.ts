import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db/index.js'
import { downloadMedia, isGalleryImageFile, processSupplierImage } from './supplier-media.js'
import { openAssetUploadSession, uploadAssetToServer } from './asset-upload.js'

/**
 * 第 5 批 · G5-2 #20「读不到的素材」+ 原型 C5b。
 *
 * 背景：数据库里实测有 17 个商品素材读不到（16 个视频 + 1 个图片），
 * 原来界面上**一处入口都没有** —— 只能等客户投诉说商品没图。
 *
 * 这一页要做三件事：
 *   1. 把「哪几个文件没读到」列出来（编号 / 商品 / 文件名 / 连着失败几次 / 什么时候）
 *   2. 「全部重试一次」—— **只补这几个文件**，不用全量重读供应商（省时间、也省服务器）
 *   3. 说明「连着失败 3 次会自动停掉」
 *
 * 失败明细从 `supplier_sync_run.detail.errors` 里读，格式是：
 *   `VD63-S1.mp4 ← https://vaultcaredubai.com/wp-content/uploads/2026/08/VD63-S1.mp4：SupplierMediaError: ...`
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEDIA_DIR = path.join(__dirname, '..', '..', 'data', 'media')

/** 连着失败多少次就自动停掉，不再反复试（免得把服务器拖死） */
export const MEDIA_FAIL_STREAK_LIMIT = 3

/** 往前看几轮同步来数「连着失败几次」 */
const STREAK_LOOKBACK_RUNS = 6

/** 重试时的超时：比全量同步宽松一点，但不再是 240 秒 */
const RETRY_VIDEO_TIMEOUT_MS = 90_000
const RETRY_IMAGE_TIMEOUT_MS = 60_000

const FILE_RE = /^(.+?)-(?:s)?(\d+)\.(mp4|webp)$/i

export interface FailedAsset {
  fileName: string
  url: string
  kind: 'image' | 'video'
  /** 从文件名反推的商品编号，如 `VD63-S1.mp4` → `VD63` */
  sku: string
  /** 这个商品在中台叫什么（反查不到就是 null） */
  productName: string | null
  /** 失败原因（截断过，太长的不往界面上堆） */
  reason: string
  /** 连着失败几次 */
  failStreak: number
  /** 超过上限 → 已自动停掉，不再重试 */
  stopped: boolean
  lastFailedAt: string | null
}

/** 把一条失败明细拆成「文件名 / 地址 / 原因」 */
export function parseFailedAssetMessage(msg: string): { fileName: string; url: string; reason: string } | null {
  const sep = msg.indexOf(' ← ')
  if (sep < 0) return null
  const fileName = msg.slice(0, sep).trim()
  const rest = msg.slice(sep + 3)
  const colon = rest.indexOf('：')
  const url = (colon >= 0 ? rest.slice(0, colon) : rest).trim()
  const reason = colon >= 0 ? rest.slice(colon + 1).trim() : ''
  if (!fileName || !url) return null
  return { fileName, url, reason }
}

function kindOf(fileName: string): 'image' | 'video' {
  return fileName.toLowerCase().endsWith('.mp4') ? 'video' : 'image'
}

function skuOf(fileName: string): string {
  const m = FILE_RE.exec(fileName)
  return m ? m[1] : fileName.replace(/\.[a-z0-9]+$/i, '')
}

function galleryCountForSku(sku: string): number {
  const row = getDb().get('SELECT images FROM products WHERE sku = ?', [sku]) as
    | { images: string | null }
    | undefined
  if (!row?.images) return 0
  try {
    const parsed = JSON.parse(row.images)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function parseDetailErrors(raw: unknown): string[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray((parsed as { errors?: unknown })?.errors)
      ? ((parsed as { errors: string[] }).errors || [])
      : []
  } catch {
    return []
  }
}

/**
 * 列出「现在还没读到」的素材。
 *
 * 「还没读到」= 最近一轮同步里失败的文件；如果这个文件已经在更近的某轮里成功了，
 * 就不该再列出来（不然修好了还一直显示）。
 */
/**
 * 🔴 2026-09-18 新增（「重推这一个」配套，实测发现的问题）：
 *
 * 问题现场：点「重推这一个」→ 接口回 `{tried:1, ok:1}`（真读到了）→
 * **但那一行还留在列表上**。因为 `listFailedAssets()` 只认「最近一轮同步的失败明细」，
 * 单推不是一轮同步，不写 `supplier_sync_run`，所以列表看不见「它已经好了」。
 * 老板看到的就是「说读到了，可它还挂在那儿」→ 会反复点。
 *
 * 这张表记一笔「这个文件什么时候单独重推过、成没成」：
 *   - `ok = 1` 且**比最近一轮同步更晚** → 从「读不到」列表里拿掉（它真的好了）
 *   - `ok = 0` → 留着，而且用这次更新的原因（比上一轮同步的旧原因准）
 *
 * 为什么不用「本机文件在不在」当判据：下载成功但传不上去的时候，本机也有文件，
 * 可客户那边还是看不到 —— 那样判会**把没修好的当成修好了**。
 */
function ensureRetryTable(db: ReturnType<typeof getDb>): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_media_retry (
      file_name TEXT PRIMARY KEY,
      ok        INTEGER NOT NULL,
      reason    TEXT,
      at        TEXT NOT NULL
    )
  `)
}

/** 记一笔单推结果（不管成没成都记，失败的原因也留着） */
function recordRetry(fileName: string, ok: boolean, reason: string | null): void {
  const db = getDb()
  ensureRetryTable(db)
  db.run(
    `INSERT INTO supplier_media_retry (file_name, ok, reason, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(file_name) DO UPDATE SET ok = excluded.ok, reason = excluded.reason, at = excluded.at`,
    [fileName, ok ? 1 : 0, reason, new Date().toISOString()],
  )
}

export function listFailedAssets(): FailedAsset[] {
  const db = getDb()
  ensureRetryTable(db)
  const runs = db.all(
    'SELECT id, finished_at, detail FROM supplier_sync_run ORDER BY id DESC LIMIT ?',
    [STREAK_LOOKBACK_RUNS],
  ) as Array<{ id: number; finished_at: string | null; detail: string | null }>

  if (runs.length === 0) return []

  const latest = runs[0]
  const latestErrors = parseDetailErrors(latest.detail)
  if (latestErrors.length === 0) return []

  // 「单独重推成功过，而且是在最近一轮同步之后」的文件 → 不再算读不到
  const latestAt = latest.finished_at ? Date.parse(latest.finished_at) : 0
  const fixed = new Set<string>()
  const retried = new Map<string, { ok: number; reason: string | null; at: string }>()
  for (const row of db.all('SELECT file_name, ok, reason, at FROM supplier_media_retry') as Array<{
    file_name: string
    ok: number
    reason: string | null
    at: string
  }>) {
    retried.set(row.file_name, { ok: row.ok, reason: row.reason, at: row.at })
    if (row.ok === 1 && Date.parse(row.at) >= latestAt) fixed.add(row.file_name)
  }

  // 商品名反查：文件名 → 编号 → 商品
  const productBySku = new Map<string, string>()
  const products = db.all('SELECT sku, name FROM products') as Array<{ sku: string; name: string }>
  for (const p of products) productBySku.set(String(p.sku), String(p.name))

  const items: FailedAsset[] = []
  for (const msg of latestErrors) {
    const parsed = parseFailedAssetMessage(msg)
    if (!parsed) continue
    if (fixed.has(parsed.fileName)) continue
    const sku = skuOf(parsed.fileName)

    // 从最近往前数，连着失败几次（遇到某一轮没出现这个文件就停）
    let streak = 0
    for (const run of runs) {
      const names = parseDetailErrors(run.detail)
        .map(m => parseFailedAssetMessage(m)?.fileName)
        .filter(Boolean) as string[]
      if (names.includes(parsed.fileName)) streak += 1
      else break
    }

    // 单独重推过、但没成的 → 用那次的原因（比上一轮同步的旧原因新）
    const lastRetry = retried.get(parsed.fileName)
    const reason = lastRetry && lastRetry.ok === 0 && lastRetry.reason
      ? `重推过还是不行：${lastRetry.reason}`
      : parsed.reason

    items.push({
      fileName: parsed.fileName,
      url: parsed.url,
      kind: kindOf(parsed.fileName),
      sku,
      productName: productBySku.get(sku) ?? null,
      reason: reason.length > 160 ? `${reason.slice(0, 160)}…` : reason,
      failStreak: streak || 1,
      stopped: (streak || 1) >= MEDIA_FAIL_STREAK_LIMIT,
      lastFailedAt: latest.finished_at,
    })
  }
  return items
}

export interface RetryResult {
  tried: number
  ok: number
  failed: number
  errors: string[]
}

/**
 * 「全部重试一次」/「重推这一个」—— **只去补这几个文件**，不重读整个供应商目录。
 *
 * 做法和全量同步的第 3、4 步一样：下载 → 相册主图 800×800 / 描述图原尺寸 webp / 视频原样 → 写进素材目录。
 * 文件一落盘，商品里那条 `/pic/xxx` `/vid/xxx` 地址就通了，不用改商品记录。
 *
 * @param onlyFileNames 只重推这几个文件（第 5 批 · G6-1 补：任务书问题 1 第 3 条要
 *   「让老板能点『重推这一个』」）。不传 = 全部。
 *
 * ⚠️ 手动点名重推时，**已经自动停掉的也照推**（`stopped` 只是「别再自动反复试」，
 *    老板点名了就说明他想试一次 —— 这是人的决定，不该被护栏拦）。
 */
export async function retryFailedAssets(onlyFileNames?: string[]): Promise<RetryResult> {
  const wanted = onlyFileNames && onlyFileNames.length > 0 ? new Set(onlyFileNames) : null
  const items = listFailedAssets().filter(item =>
    wanted ? wanted.has(item.fileName) : !item.stopped,
  )
  const errors: string[] = []
  let ok = 0
  let failed = 0

  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })

  /**
   * 🔴 2026-09-18 补：一个都不用推就**直接返回**，别去连素材服务器。
   *   实测：点「重推这一个」的时候如果那个文件已经好了（不在失败清单里了），
   *   下面那句 `openAssetUploadSession()` 还是会去连一次远端 FTP —— 白等十几秒，
   *   界面上看着像卡住了。空手就回，一句话的事。
   */
  if (items.length === 0) return { tried: 0, ok: 0, failed: 0, errors }

  // G6-4：重试也要**真传上去**。只写本机的话，站点上引用的那个地址还是 404 ——
  // 等于「重试成功了但客户还是看不到图」。开一条 FTP 长连接，整个循环复用。
  const uploadSession = await openAssetUploadSession()

  for (const item of items) {
    try {
      const raw = await downloadMedia(
        item.url,
        item.kind === 'video' ? RETRY_VIDEO_TIMEOUT_MS : RETRY_IMAGE_TIMEOUT_MS,
      )
      const output =
        item.kind === 'image'
          ? await processSupplierImage(
              raw,
              isGalleryImageFile(item.fileName, galleryCountForSku(item.sku)) ? 'gallery' : 'embedded',
            )
          : raw
      // 下载 + 加工都成功了才落盘，避免把已有的好文件覆盖成半个
      const target = path.join(MEDIA_DIR, item.fileName)
      fs.writeFileSync(target, output)

      const up = await uploadAssetToServer(target, item.fileName, {
        cfg: uploadSession.cfg,
        client: uploadSession.client ?? undefined,
      })
      if (!up.ok) {
        // 本机好了、传不上去 → 仍然算「没修好」，因为客户那边还是看不到
        failed++
        errors.push(`${item.fileName}：本机下载成功，但传到素材服务器失败 —— ${up.reason}`)
        console.warn(`[素材重试] 传不上去 ${item.fileName}：${up.reason}`)
        recordRetry(item.fileName, false, `传到素材服务器失败 —— ${up.reason}`)
        continue
      }

      ok++
      // 真好了才记「修好」—— 列表下一次就不列它了
      recordRetry(item.fileName, true, null)
      console.log(`[素材重试] 好了 ${item.fileName}${up.uploaded ? '（已传到素材服务器）' : '（远端已有，跳过上传）'}`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${item.fileName}：${msg}`)
      console.warn(`[素材重试] 还是不行 ${item.fileName}：${msg}`)
      recordRetry(item.fileName, false, msg)
    }
    await new Promise(r => setTimeout(r, 120))
  }

  uploadSession.close()
  return { tried: items.length, ok, failed, errors }
}
