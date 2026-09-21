/**
 * 供应商素材加工：下载、转 webp、描述 HTML 重写
 *
 * 目标：把供应商的商品素材（图片/视频）搬到自己的素材地址上，
 * 并保证商品描述 HTML 里**不再残留任何指向供应商域名的地址**
 * （否则客户在商品详情页里能点到上游）。
 */

import { createCanvas, loadImage } from '@napi-rs/canvas'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36 VaultOS/2.0'

const SUPPLIER_ORIGIN = 'https://vaultcaredubai.com'
const SUPPLIER_HOST_RE = /vaultcaredubai\.com/i

const TIMEOUT_MS = 60_000

const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|gif|avif|bmp)(?:[?#]|$)/i
const VIDEO_EXT_RE = /\.(?:mp4|mov|webm|m4v)(?:[?#]|$)/i

export class SupplierMediaError extends Error {
  readonly url: string | null
  readonly status: number | null
  readonly cause: unknown

  constructor(
    message: string,
    options: { url?: string | null; status?: number | null; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'SupplierMediaError'
    this.url = options.url ?? null
    this.status = options.status ?? null
    this.cause = options.cause
  }
}

function detailOf(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err)
}

/** 扫描 HTML 里的全部绝对 URL（新建正则，避免 /g 的 lastIndex 状态被复用污染） */
function scanUrls(html: string): string[] {
  return [...html.matchAll(/https?:\/\/[^\s"'<>()\\]+/gi)].map((m) => m[0])
}

/** 判断一个地址属于图片还是视频；两者都不是则返回 null */
function classifyAssetKind(url: string): 'image' | 'video' | null {
  if (VIDEO_EXT_RE.test(url)) return 'video'
  if (IMAGE_EXT_RE.test(url)) return 'image'
  return null
}

/**
 * 下载素材。带 UA、超时 60 秒，失败抛 {@link SupplierMediaError}。
 *
 * 注意超时是**整个请求**（响应头 + 响应体收完）的总预算，不是空闲超时。
 * 实测供应商站视频只有约 320KB/s，单个视频 14.4MB / 19.2MB 需要 44s / 56s，
 * 正好压在 60s 线上，网络稍有波动就会失败。批量拉视频时请显式传更大的 timeoutMs。
 *
 * @param timeoutMs 总超时预算，默认 60000（按需求约定）
 */
export async function downloadMedia(url: string, timeoutMs: number = TIMEOUT_MS): Promise<Buffer> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/avif,image/webp,image/*,video/*,*/*;q=0.8',
        // 供应商站对素材做了防盗链时，缺 Referer 会 403
        Referer: SUPPLIER_ORIGIN + '/',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new SupplierMediaError(
      `下载失败（网络不通或超时 ${timeoutMs / 1000}s）：${url} —— ${detailOf(err)}`,
      { url, cause: err },
    )
  }

  if (!response.ok) {
    throw new SupplierMediaError(`下载失败：HTTP ${response.status} ${response.statusText} —— ${url}`, {
      url,
      status: response.status,
    })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    // 响应头已经回来了，但响应体没收完。实测供应商站存在这种情况：
    // 大文件（视频）在 60s 内收不完，或文件损坏时返回 200 但 0 字节且连接挂住。
    throw new SupplierMediaError(
      `下载失败：响应体读取中断或超时（${timeoutMs / 1000}s 内未收完，服务端可能返回了空响应或链路过慢）：${url} —— ${detailOf(err)}`,
      { url, status: response.status, cause: err },
    )
  }

  if (buffer.length === 0) {
    throw new SupplierMediaError(`下载失败：响应体为 0 字节（HTTP ${response.status}）—— ${url}`, {
      url,
      status: response.status,
    })
  }
  return buffer
}

/** 相册主图输出边长（正方形，白底 contain） */
export const GALLERY_IMAGE_SIZE = 800
/** 主体四周内边距，避免贴边 */
export const GALLERY_IMAGE_INSET = 24
/** 锐化强度：原图像素 + amount × 拉普拉斯。0.28 是轻度补偿缩放发糊。 */
const SHARPEN_AMOUNT = 0.28

export type SupplierImageRole = 'gallery' | 'embedded'

/**
 * 把 png/jpg（含 webp/gif）转成 webp。
 *
 * 走 `loadImage` → `createCanvas` → `drawImage` → `toBuffer('image/webp')`。
 * 已实测 `@napi-rs/canvas` 支持 webp 编码，无需额外依赖。
 * 描述内嵌图走这条（原尺寸）；相册主图走 {@link optimizeGalleryImage}。
 */
export async function toWebp(input: Buffer): Promise<Buffer> {
  if (input.length === 0) {
    throw new SupplierMediaError('toWebp 收到 0 字节的输入')
  }

  let image: Awaited<ReturnType<typeof loadImage>>
  try {
    image = await loadImage(input)
  } catch (err) {
    throw new SupplierMediaError(`图片解码失败（可能不是图片，或格式不受支持）：${detailOf(err)}`, {
      cause: err,
    })
  }

  const canvas = createCanvas(image.width, image.height)
  canvas.getContext('2d').drawImage(image, 0, 0)

  try {
    return canvas.toBuffer('image/webp')
  } catch (err) {
    throw new SupplierMediaError(`webp 编码失败：${detailOf(err)}`, { cause: err })
  }
}

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}

/** 3×3 拉普拉斯轻度锐化。只动 RGB，边上一圈不动。 */
function sharpenImageData(imageData: { data: Uint8ClampedArray; width: number; height: number }, amount: number): void {
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = src[i + c]
        const laplacian =
          -src[((y - 1) * width + x) * 4 + c] -
          src[(y * width + (x - 1)) * 4 + c] +
          4 * center -
          src[(y * width + (x + 1)) * 4 + c] -
          src[((y + 1) * width + x) * 4 + c]
        data[i + c] = clampByte(center + amount * laplacian)
      }
    }
  }
}

async function renderGallerySquare(input: Buffer): Promise<Buffer> {
  if (input.length === 0) {
    throw new SupplierMediaError('optimizeGalleryImage 收到 0 字节的输入')
  }

  const image = await loadImage(input)
  const canvas = createCanvas(GALLERY_IMAGE_SIZE, GALLERY_IMAGE_SIZE)
  const ctx = canvas.getContext('2d')
  const draw = ctx as unknown as { imageSmoothingEnabled?: boolean; imageSmoothingQuality?: string }
  draw.imageSmoothingEnabled = true
  draw.imageSmoothingQuality = 'high'

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, GALLERY_IMAGE_SIZE, GALLERY_IMAGE_SIZE)

  const box = GALLERY_IMAGE_SIZE - GALLERY_IMAGE_INSET * 2
  const scale = Math.min(box / image.width, box / image.height)
  const dw = Math.max(1, Math.round(image.width * scale))
  const dh = Math.max(1, Math.round(image.height * scale))
  const dx = Math.round((GALLERY_IMAGE_SIZE - dw) / 2)
  const dy = Math.round((GALLERY_IMAGE_SIZE - dh) / 2)
  ctx.drawImage(image, dx, dy, dw, dh)

  const pixels = ctx.getImageData(0, 0, GALLERY_IMAGE_SIZE, GALLERY_IMAGE_SIZE)
  sharpenImageData(pixels, SHARPEN_AMOUNT)
  ctx.putImageData(pixels, 0, 0)

  return canvas.toBuffer('image/webp')
}

/**
 * 相册主图：等比放入 800×800 白底（不裁切），轻度锐化后出 webp。
 * 加工失败则退回 {@link toWebp} 原尺寸，避免一张图加工挂了变成缺图。
 */
export async function optimizeGalleryImage(input: Buffer): Promise<Buffer> {
  try {
    return await renderGallerySquare(input)
  } catch (err) {
    try {
      return await toWebp(input)
    } catch {
      throw err instanceof SupplierMediaError
        ? err
        : new SupplierMediaError(`相册主图加工失败：${detailOf(err)}`, { cause: err })
    }
  }
}

/** 下载循环 / 重试用：相册走 800×800，描述内嵌图只转 webp。 */
export async function processSupplierImage(input: Buffer, role: SupplierImageRole): Promise<Buffer> {
  return role === 'gallery' ? optimizeGalleryImage(input) : toWebp(input)
}

/**
 * 从 `{SKU}-{n}.webp` 拆出编号和序号。SKU 里可以有连字符（取最后一个 `-数字`）。
 */
export function parseImageAssetFileName(fileName: string): { sku: string; index: number } | null {
  const m = /^(.+)-(\d+)\.webp$/i.exec(String(fileName || '').trim())
  if (!m) return null
  const index = Number(m[2])
  if (!Number.isInteger(index) || index < 1) return null
  return { sku: m[1], index }
}

/** 序号落在该商品相册张数以内 → 这是主图，不是描述内嵌图。 */
export function isGalleryImageFile(fileName: string, galleryCount: number): boolean {
  const parsed = parseImageAssetFileName(fileName)
  return !!parsed && parsed.index <= galleryCount
}

/**
 * 素材文件命名规则。
 * 图片 `VC459-1.webp`，视频 `VC459-s1.mp4`。
 *
 * ⚠️ **视频序号用小写 `s`，不是大写 `S`。**
 *
 * 依据（2026-09-17 实测作者的素材服务器 `vault-me.site`，该站开着目录列表）：
 *   - `vid/` 目录里 **176 个 mp4**，其中 **148 个是 `LY01-s1.mp4` 这种小写形态**，
 *     **大写 `-S1` 一个都没有**；
 *   - 服务器是 Linux，**区分大小写** —— 实测 `LY01-S1.mp4` → **404**、`LY01-s1.mp4` → **200**；
 *   - 图片没这个问题（`LY01-1.webp` 本来就不含字母，实测 200）。
 *
 * 原来拼的是大写 `S`，会让**所有视频地址 404** —— 客户看到的是空白框。
 */
export function mediaFileName(sku: string, index: number, kind: 'image' | 'video'): string {
  const safeSku = sku.trim()
  if (!safeSku) {
    throw new SupplierMediaError('mediaFileName 需要非空 sku')
  }
  if (!Number.isInteger(index) || index < 1) {
    throw new SupplierMediaError(`mediaFileName 需要 >= 1 的整数 index，收到：${index}`)
  }
  return kind === 'image' ? `${safeSku}-${index}.webp` : `${safeSku}-s${index}.mp4`
}

/**
 * 重写描述 HTML：把里面所有指向供应商域名的图片/视频地址，换成自己的素材地址。
 *
 * - 只替换供应商域名下、扩展名为图片/视频的地址；其他地址原样保留
 * - 替换后把全部 `http://` 提升为 `https://`（视频原始地址是 http，手机上会被拦）
 * - 替换后若仍残留 `vaultcaredubai.com`，直接抛错而不是静默放过
 *
 * @param assetUrlFor 由调用方决定「原始地址 → 自己的素材地址」的映射
 */
export function rewriteDescription(
  html: string,
  assetUrlFor: (origUrl: string, kind: 'image' | 'video') => string,
): string {
  if (!html) return html

  const replaced: string[] = []
  const nonMedia: string[] = []

  const rewritten = html.replace(/https?:\/\/[^\s"'<>()\\]+/gi, (url) => {
    if (!SUPPLIER_HOST_RE.test(url)) return url

    const kind = classifyAssetKind(url)
    if (!kind) {
      nonMedia.push(url)
      return url
    }

    replaced.push(url)
    return assetUrlFor(url, kind)
  })

  // 需求：视频等素材地址若是 http，手机上会被拦，统一提升为 https
  const secured = rewritten.replace(/http:\/\//gi, 'https://')

  const residual = secured.match(/vaultcaredubai\.com/gi)
  if (residual && residual.length > 0) {
    const sample = nonMedia.slice(0, 3).join(', ')
    throw new SupplierMediaError(
      `重写后仍残留 ${residual.length} 处 vaultcaredubai.com，拒绝输出` +
        (sample ? `；非图片/视频、无法映射的供应商地址：${sample}` : ''),
    )
  }

  return secured
}

/**
 * 统计描述 HTML 里指向供应商域名的图片/视频地址（去重）。
 * 供调用方在重写前建映射表用。
 */
export function listSupplierAssetUrls(html: string): Array<{ url: string; kind: 'image' | 'video' }> {
  const seen = new Set<string>()
  const out: Array<{ url: string; kind: 'image' | 'video' }> = []
  for (const url of scanUrls(html)) {
    if (!SUPPLIER_HOST_RE.test(url)) continue
    const kind = classifyAssetKind(url)
    if (!kind || seen.has(url)) continue
    seen.add(url)
    out.push({ url, kind })
  }
  return out
}
