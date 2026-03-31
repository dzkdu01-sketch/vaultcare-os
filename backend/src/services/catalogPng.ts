import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas'

const FETCH_CONCURRENCY = 8
const DECODE_CONCURRENCY = 6

const WIDTH = 1500
const PAD = 32
const GAP = 16
const COLS = 3
const HEADER_BULLETS = [
  'Local Dubai Stock · Ships Fast',
  'Pay with Cash on Delivery',
  'Private & Discreet Shipping',
] as const

/** iOS 分组背景 / 标签色（Human Interface Guidelines 近似） */
const IOS_GROUPED_BG = '#F2F2F7'
const IOS_LABEL = '#1C1C1E'
const IOS_SECONDARY = '#8E8E93'
const IOS_SEPARATOR = 'rgba(60, 60, 67, 0.29)'
const FONT_UI = '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Segoe UI", sans-serif'
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

const CATEGORY_BAND_H = 50
const GAP_AFTER_CATEGORY = 16

/** 卡片：1:1 图区（白底 contain）+ 文案（SKU → 价格 → 标题） */
const CARD_PAD = 16
/** 图区为正方形：边长 = 列宽 − 左右内边距，运行时等于 imgMaxW */
/** 文案区固定行高，避免重叠；层级：SKU 最突出 → 价格 → 标题最弱 */
const IMG_TEXT_GAP = 16
const SKU_PILL_H = 36
const SKU_TO_PRICE_GAP = 10
const PRICE_LINE_H = 28
const PRICE_TO_TITLE_GAP = 10
const TITLE_FONT_PX = 13
const TITLE_LINE_GAP = 18
const TITLE_MAX_LINES = 2
const TEXT_BLOCK_H =
  IMG_TEXT_GAP +
  SKU_PILL_H +
  SKU_TO_PRICE_GAP +
  PRICE_LINE_H +
  PRICE_TO_TITLE_GAP +
  TITLE_LINE_GAP * TITLE_MAX_LINES +
  10
const ROW_GAP = 16
const CARD_RADIUS = 12
const IMG_BOX_RADIUS = 10
/** 产品图占位与 letterbox：纯白 */
const PRODUCT_IMAGE_BG = '#FFFFFF'

export type CatalogProductRow = {
  sku: string
  name: string
  sale_price: number
  regular_price: number
  images: string | unknown[] | null
  category?: string | null
}

function parseImages(raw: CatalogProductRow['images']): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw) as unknown
      return Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
    } catch {
      return []
    }
  }
  return []
}

function priceParts(p: { sale_price: number; regular_price: number }): { num: string; currency: string } {
  const s = Number(p.sale_price) || 0
  const r = Number(p.regular_price) || 0
  const v = s > 0 ? s : r
  const n = Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2).replace(/\.?0+$/, '')
  return { num: n, currency: 'AED' }
}

/** 与列表排序一致：同分类连续成块 */
function groupByCategory(products: CatalogProductRow[]): Array<{ label: string; indices: number[] }> {
  const blocks: Array<{ label: string; indices: number[] }> = []
  for (let i = 0; i < products.length; i++) {
    const raw = products[i].category && String(products[i].category).trim()
    const label = raw && raw.length > 0 ? raw : 'Other'
    const last = blocks[blocks.length - 1]
    if (!last || last.label !== label) {
      blocks.push({ label, indices: [i] })
    } else {
      last.indices.push(i)
    }
  }
  return blocks
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function mapPool<T, R>(items: T[], poolSize: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const n = items.length
  const results: R[] = new Array(n)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= n) return
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Math.min(Math.max(1, poolSize), n)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

export type CatalogBrochureImage = {
  buffer: Buffer
  mimeType: 'image/png'
  fileExt: 'png'
}

function truncateTextToWidth(ctx: { measureText: (s: string) => { width: number } }, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s
  const ell = '…'
  let t = s
  while (t.length > 0 && ctx.measureText(t + ell).width > maxW) {
    t = t.slice(0, -1)
  }
  return t + ell
}

function wrapLines(ctx: { measureText: (s: string) => { width: number } }, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  return lines
}

function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fillRoundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
}

function strokeRoundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.stroke()
}

function drawCategoryBand(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  _audience: 'him' | 'her',
) {
  const r = 12
  ctx.fillStyle = '#FFFFFF'
  fillRoundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = IOS_SEPARATOR
  ctx.lineWidth = 1
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 1)
  const show = label.length > 72 ? `${label.slice(0, 70)}…` : label
  ctx.fillStyle = IOS_LABEL
  ctx.font = `600 17px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(show, x + w / 2, y + h / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** 最高优先级：深色药丸 + 白字大写 SKU（宽度不超过 maxOuterW） */
function drawSkuPrimaryProminent(
  ctx: SKRSContext2D,
  cx: number,
  yTop: number,
  sku: string,
  maxOuterW: number,
): number {
  const pillH = SKU_PILL_H
  const padX = 14
  ctx.font = `700 19px ${FONT_MONO}`
  let s = (sku || '—').toUpperCase()
  const maxInner = Math.max(24, maxOuterW - padX * 2)
  s = truncateTextToWidth(ctx, s, maxInner)
  const tw = ctx.measureText(s).width
  const pillW = Math.min(maxOuterW, tw + padX * 2)
  const px = cx - pillW / 2
  ctx.fillStyle = '#1C1C1E'
  fillRoundRect(ctx, px, yTop, pillW, pillH, 10)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  strokeRoundRect(ctx, px + 0.5, yTop + 0.5, pillW - 1, pillH - 1, 9)
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s, cx, yTop + pillH / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  return pillH
}

/** for him / for her 分册 PNG：按分类分节、三列栅格 */
export async function buildCatalogBrochureImage(
  products: CatalogProductRow[],
  audience: 'him' | 'her',
): Promise<CatalogBrochureImage> {
  const titleText = audience === 'him' ? 'For Him' : 'For Her'

  const innerW = WIDTH - PAD * 2
  const colW = (innerW - GAP * (COLS - 1)) / COLS
  /** 1:1 产品图边长（与列内宽一致） */
  const imgSide = colW - CARD_PAD * 2

  const cardH = CARD_PAD + imgSide + TEXT_BLOCK_H + CARD_PAD
  const rowH = cardH + ROW_GAP

  /** iOS「分组」风格：三条卖点各占白卡片，易读 Callout 15pt */
  const TRUST_CELL_H = 72
  const TRUST_CELL_GAP = 8
  const trustStripH = TRUST_CELL_H
  const trustToTitleGap = 16
  const headerTop = PAD + trustStripH + trustToTitleGap
  /** Large Title 约 34pt + 上下留白 */
  const titleBarH = 88
  const gridTop = headerTop + titleBarH + 20

  const blocks = groupByCategory(products)
  let bodyH = 0
  for (const block of blocks) {
    bodyH += CATEGORY_BAND_H + GAP_AFTER_CATEGORY
    const rowsInBlock = Math.ceil(block.indices.length / COLS) || 1
    bodyH += rowsInBlock * rowH
  }
  const height = gridTop + bodyH + PAD

  const canvas = createCanvas(WIDTH, height)
  const ctx = canvas.getContext('2d')
  const draw = ctx as unknown as { imageSmoothingEnabled?: boolean; imageSmoothingQuality?: string }
  draw.imageSmoothingEnabled = true
  draw.imageSmoothingQuality = 'high'

  ctx.fillStyle = IOS_GROUPED_BG
  ctx.fillRect(0, 0, WIDTH, height)

  const trustY = PAD
  const trustCellR = 10
  const cellW = (innerW - TRUST_CELL_GAP * 2) / 3
  HEADER_BULLETS.forEach((raw, i) => {
    const x = PAD + i * (cellW + TRUST_CELL_GAP)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 2
    ctx.fillStyle = '#FFFFFF'
    fillRoundRect(ctx, x, trustY, cellW, trustStripH, trustCellR)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = IOS_SEPARATOR
    ctx.lineWidth = 1
    strokeRoundRect(ctx, x + 0.5, trustY + 0.5, cellW - 1, trustStripH - 1, trustCellR - 1)
    const cx = x + cellW / 2
    ctx.fillStyle = IOS_LABEL
    ctx.font = `600 15px ${FONT_UI}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxW = cellW - 20
    let show: string = raw
    if (ctx.measureText(show).width > maxW) {
      while (show.length > 1 && ctx.measureText(`${show}…`).width > maxW) {
        show = show.slice(0, -1)
      }
      show = `${show}…`
    }
    ctx.fillText(show, cx, trustY + trustStripH / 2)
  })
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const barY = headerTop
  const barR = 12
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#FFFFFF'
  fillRoundRect(ctx, PAD, barY, innerW, titleBarH, barR)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.strokeStyle = IOS_SEPARATOR
  ctx.lineWidth = 1
  strokeRoundRect(ctx, PAD + 0.5, barY + 0.5, innerW - 1, titleBarH - 1, barR - 1)
  ctx.strokeStyle = IOS_SEPARATOR
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(PAD + barR, barY + titleBarH - 0.5)
  ctx.lineTo(PAD + innerW - barR, barY + titleBarH - 0.5)
  ctx.stroke()

  ctx.fillStyle = IOS_LABEL
  ctx.font = `700 34px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(titleText, WIDTH / 2, barY + titleBarH / 2 - 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const firstUrls = products.map(p => parseImages(p.images)[0] ?? null)
  const rawBuffers = await mapPool(firstUrls, FETCH_CONCURRENCY, (url) => (url ? fetchImageBuffer(url) : Promise.resolve(null)))
  const decoded = await mapPool(rawBuffers, DECODE_CONCURRENCY, async (buf) => {
    if (!buf) return null
    try {
      return await loadImage(buf)
    } catch {
      return null
    }
  })

  let yCursor = gridTop
  for (const block of blocks) {
    drawCategoryBand(ctx, PAD, yCursor, innerW, CATEGORY_BAND_H, block.label, audience)
    yCursor += CATEGORY_BAND_H + GAP_AFTER_CATEGORY

    const n = block.indices.length
    const rowsInBlock = Math.ceil(n / COLS) || 1
    for (let r = 0; r < rowsInBlock; r++) {
      for (let c = 0; c < COLS; c++) {
        const slot = r * COLS + c
        if (slot >= n) break
        const pi = block.indices[slot]
        const p = products[pi]
        const img = decoded[pi]
        const x0 = PAD + c * (colW + GAP)
        const y0 = yCursor + r * rowH

        const imgX = x0 + CARD_PAD
        const imgY = y0 + CARD_PAD

        ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
        ctx.shadowBlur = 12
        ctx.shadowOffsetY = 3
        ctx.fillStyle = '#FFFFFF'
        fillRoundRect(ctx, x0, y0, colW, cardH, CARD_RADIUS)
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
        ctx.strokeStyle = IOS_SEPARATOR
        ctx.lineWidth = 1
        strokeRoundRect(ctx, x0 + 0.5, y0 + 0.5, colW - 1, cardH - 1, CARD_RADIUS - 1)

        ctx.fillStyle = PRODUCT_IMAGE_BG
        fillRoundRect(ctx, imgX, imgY, imgSide, imgSide, IMG_BOX_RADIUS)
        ctx.strokeStyle = 'rgba(60, 60, 67, 0.12)'
        ctx.lineWidth = 1
        strokeRoundRect(ctx, imgX + 0.5, imgY + 0.5, imgSide - 1, imgSide - 1, IMG_BOX_RADIUS - 1)

        if (img) {
          const iw = img.width
          const ih = img.height
          const scale = Math.min(imgSide / iw, imgSide / ih)
          const dw = iw * scale
          const dh = ih * scale
          const dx = imgX + (imgSide - dw) / 2
          const dy = imgY + (imgSide - dh) / 2
          ctx.save()
          roundRectPath(ctx, imgX, imgY, imgSide, imgSide, IMG_BOX_RADIUS)
          ctx.clip()
          ctx.drawImage(img, dx, dy, dw, dh)
          ctx.restore()
        }

        const cx = x0 + colW / 2
        const textMaxW = imgSide - 8
        let ty = imgY + imgSide + IMG_TEXT_GAP
        drawSkuPrimaryProminent(ctx, cx, ty, p.sku || '—', textMaxW)
        ty += SKU_PILL_H + SKU_TO_PRICE_GAP

        const { num, currency } = priceParts(p)
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.font = `600 22px ${FONT_UI}`
        const wNum = ctx.measureText(num).width
        ctx.font = `400 17px ${FONT_UI}`
        const wCur = ctx.measureText(` ${currency}`).width
        const totalW = wNum + wCur
        const priceLeft = cx - totalW / 2
        ctx.fillStyle = IOS_LABEL
        ctx.font = `600 22px ${FONT_UI}`
        ctx.fillText(num, priceLeft, ty)
        ctx.fillStyle = IOS_SECONDARY
        ctx.font = `400 17px ${FONT_UI}`
        ctx.fillText(` ${currency}`, priceLeft + wNum, ty)
        ty += PRICE_LINE_H + PRICE_TO_TITLE_GAP

        ctx.font = `400 ${TITLE_FONT_PX}px ${FONT_UI}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const nameLines = wrapLines(ctx, p.name || '—', textMaxW, TITLE_MAX_LINES)
        nameLines.forEach((ln, li) => {
          ctx.fillStyle = IOS_SECONDARY
          ctx.fillText(ln, cx, ty + li * TITLE_LINE_GAP)
        })
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }
    yCursor += rowsInBlock * rowH
  }

  const buffer = canvas.toBuffer('image/png')
  return { buffer, mimeType: 'image/png', fileExt: 'png' }
}
