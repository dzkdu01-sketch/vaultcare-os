import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas'

const FETCH_CONCURRENCY = 8
const DECODE_CONCURRENCY = 6

const WIDTH = 1500
/** 页面外边距：宽松留白（需求：版心统一、四周透气） */
const PAD = 48
/** 列间距（参考图：白卡之间透气） */
const GAP = 20
/** 参考图：四列展陈 */
const COLS = 4
/** 品牌承诺条：三行分条展示（醒目、无独立方框） */
const HEADER_PROMISE_LINES = [
  'Local Dubai Stock · Ships Fast',
  'Pay with Cash on Delivery',
  'Private & Discreet Shipping',
] as const

/** 页底：浅冷灰（白卡浮起，对标参考图） */
const PAGE_BG = '#F2F3F5'
const CARD_BG = '#FFFFFF'
const TEXT_PRIMARY = '#1D1D1F'
const TEXT_SECONDARY = '#6E6E73'
/** 参考电商主价强调色（与小米系主价橙一致） */
const PRICE_ACCENT = '#FF6700'
/** 顶栏/页内发丝线 */
const RULE_LIGHT = 'rgba(60, 60, 67, 0.18)'
const FONT_UI = '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Segoe UI", sans-serif'
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

/** 白卡内边距；①标题左对齐 ② 左 SKU / 右 价格（两端对齐） */
const CARD_PAD = 16
const CARD_RADIUS = 14
const IMG_TEXT_GAP = 16
/** 第一行：比 SKU（24px）小 2px，中性灰，单行截断 */
const TITLE_FONT_PX = 22
const TITLE_LINE_H = 28
const TITLE_COLOR = '#3D3D41'
const TITLE_TO_META_GAP = 12
/** 第二行：左 SKU + 右价；SKU/价数字 24px */
const META_LINE_H = 44
const SKU_META_PX = 24
const PRICE_NUM_PX = 24
const PRICE_CUR_PX = 24
/** 左侧信息与价格之间的最小间距 */
const META_GAP_SKU_PRICE = 14
const TEXT_BLOCK_H = IMG_TEXT_GAP + TITLE_LINE_H + TITLE_TO_META_GAP + META_LINE_H + 12
const ROW_GAP = 24
const IMG_BOX_RADIUS = 10
/** 图区略浅于白卡，托住产品图 */
const PRODUCT_IMAGE_BG = '#F5F5F7'
/** 顶栏：浅底 + 深字（避免厚重黑条） */
const PROMISE_BAR_BG = '#FAFAFA'
const PROMISE_TEXT = '#1D1D1F'
const PROMISE_LINE_H = 24
const PROMISE_PAD_Y = 18

export type CatalogProductRow = {
  sku: string
  name: string
  sale_price: number
  regular_price: number
  images: string | unknown[] | null
  category?: string | null
  /** 关联供应商编码（导出 PNG 不再绘制，保留字段供后台） */
  supplier_codes?: string | null
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

function formatPriceNum(n: number): string {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2).replace(/\.?0+$/, '')
}

function priceParts(p: { sale_price: number; regular_price: number }): { num: string; currency: string } {
  const s = Number(p.sale_price) || 0
  const r = Number(p.regular_price) || 0
  const v = s > 0 ? s : r
  return { num: formatPriceNum(v), currency: 'AED' }
}

/** 图册导出时刻（迪拜时区）；仅用 ASCII，避免无中文字体时 Canvas 出现方框 */
function catalogGeneratedDateLabel(): string {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })
  return `Generated · ${s}`
}

function measurePriceBlockWidth(ctx: SKRSContext2D, num: string, cur: string): number {
  ctx.font = `600 ${PRICE_NUM_PX}px ${FONT_UI}`
  let w = ctx.measureText(num).width
  ctx.font = `500 ${PRICE_CUR_PX}px ${FONT_UI}`
  w += ctx.measureText(` ${cur}`).width
  return w
}

function measureSkuWidth(ctx: SKRSContext2D, sku: string): number {
  ctx.font = `700 ${SKU_META_PX}px ${FONT_MONO}`
  return ctx.measureText(sku).width
}

/**
 * 第二行：左侧 SKU，右侧价格；不展示供应商编码。
 */
function drawMetaSkuSupplierPrice(
  ctx: SKRSContext2D,
  textLeft: number,
  ty: number,
  p: CatalogProductRow,
  maxW: number,
): void {
  const { num, currency: cur } = priceParts(p)
  const priceW = measurePriceBlockWidth(ctx, num, cur)
  const leftBudget = Math.max(48, maxW - priceW - META_GAP_SKU_PRICE)

  const rawSku = (p.sku || '—').toUpperCase()
  let sku = rawSku
  ctx.font = `700 ${SKU_META_PX}px ${FONT_MONO}`
  if (measureSkuWidth(ctx, sku) > leftBudget) {
    sku = truncateTextToWidth(ctx, sku, leftBudget)
  }

  const cy = Math.round(ty + META_LINE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const x = Math.round(textLeft)
  ctx.fillStyle = TEXT_PRIMARY
  ctx.font = `700 ${SKU_META_PX}px ${FONT_MONO}`
  ctx.fillText(sku, x, cy)

  const priceX = Math.round(textLeft + maxW - priceW)
  ctx.fillStyle = PRICE_ACCENT
  ctx.font = `600 ${PRICE_NUM_PX}px ${FONT_UI}`
  const wNum = ctx.measureText(num).width
  ctx.fillText(num, priceX, cy)
  ctx.font = `500 ${PRICE_CUR_PX}px ${FONT_UI}`
  ctx.fillText(` ${cur}`, priceX + wNum, cy)

  ctx.textBaseline = 'alphabetic'
}

function drawImagePlaceholder(ctx: SKRSContext2D, imgX: number, imgY: number, imgSide: number) {
  ctx.fillStyle = '#E5E5EA'
  ctx.font = `500 13px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('No image', imgX + imgSide / 2, imgY + imgSide / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** 连续网格：不再插入分类分章，直接按传入顺序填充。 */
export function buildCatalogGridRows(
  products: CatalogProductRow[],
  cols = COLS,
): Array<Array<CatalogProductRow | null>> {
  const safeCols = Math.max(1, Math.floor(cols) || 1)
  const rows: Array<Array<CatalogProductRow | null>> = []
  for (let i = 0; i < products.length; i += safeCols) {
    const row: Array<CatalogProductRow | null> = products.slice(i, i + safeCols)
    while (row.length < safeCols) row.push(null)
    rows.push(row)
  }
  return rows
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

/** for him / for her 分册 PNG：浅灰底 + 白卡、四列栅格 */
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

  const PROMISE_BAR_H = PROMISE_PAD_Y * 2 + HEADER_PROMISE_LINES.length * PROMISE_LINE_H
  const TITLE_AFTER_PROMISE = 32
  const headerTop = PAD + PROMISE_BAR_H + TITLE_AFTER_PROMISE
  /** 主标题 + 日期 + 底部分割线（无白底方框） */
  const titleBarH = 100
  const GRID_AFTER_TITLE = 36
  const gridTop = headerTop + titleBarH + GRID_AFTER_TITLE

  const gridRows = buildCatalogGridRows(products, COLS)
  const bodyH = gridRows.length * rowH
  const height = gridTop + bodyH + PAD

  const canvas = createCanvas(WIDTH, height)
  const ctx = canvas.getContext('2d')
  const draw = ctx as unknown as { imageSmoothingEnabled?: boolean; imageSmoothingQuality?: string }
  draw.imageSmoothingEnabled = true
  draw.imageSmoothingQuality = 'high'

  ctx.fillStyle = PAGE_BG
  ctx.fillRect(0, 0, WIDTH, height)

  const promiseY = PAD
  ctx.fillStyle = PROMISE_BAR_BG
  ctx.fillRect(PAD, promiseY, innerW, PROMISE_BAR_H)
  ctx.fillStyle = PROMISE_TEXT
  ctx.font = `600 17px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxLineW = innerW - 56
  HEADER_PROMISE_LINES.forEach((raw, i) => {
    let show: string = raw
    if (ctx.measureText(show).width > maxLineW) {
      while (show.length > 1 && ctx.measureText(`${show}…`).width > maxLineW) {
        show = show.slice(0, -1)
      }
      show = `${show}…`
    }
    const lineY = promiseY + PROMISE_PAD_Y + PROMISE_LINE_H * i + PROMISE_LINE_H / 2
    ctx.fillText(show, WIDTH / 2, lineY)
  })
  ctx.strokeStyle = RULE_LIGHT
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, promiseY + PROMISE_BAR_H)
  ctx.lineTo(PAD + innerW, promiseY + PROMISE_BAR_H)
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const barY = headerTop
  ctx.fillStyle = TEXT_PRIMARY
  ctx.font = `700 36px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(titleText, WIDTH / 2, barY + 38)
  ctx.fillStyle = TEXT_SECONDARY
  ctx.font = `500 12px ${FONT_UI}`
  ctx.fillText(catalogGeneratedDateLabel(), WIDTH / 2, barY + 76)
  ctx.strokeStyle = RULE_LIGHT
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, barY + titleBarH - 1)
  ctx.lineTo(PAD + innerW, barY + titleBarH - 1)
  ctx.stroke()
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
  const imageByProduct = new Map(products.map((p, i) => [p, decoded[i]] as const))

  for (let r = 0; r < gridRows.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = gridRows[r][c]
      if (!p) continue
      const img = imageByProduct.get(p) ?? null
      const x0 = PAD + c * (colW + GAP)
      const y0 = gridTop + r * rowH

      const imgX = x0 + CARD_PAD
      const imgY = y0 + CARD_PAD
      /** 与第一行共用左边界；第二行为左 SKU / 右价格（两端对齐） */
      const textLeft = x0 + CARD_PAD
      const textMaxW = colW - CARD_PAD * 2

      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
      ctx.shadowBlur = 22
      ctx.shadowOffsetY = 8
      ctx.fillStyle = CARD_BG
      fillRoundRect(ctx, x0, y0, colW, cardH, CARD_RADIUS)
      ctx.restore()

      ctx.fillStyle = PRODUCT_IMAGE_BG
      fillRoundRect(ctx, imgX, imgY, imgSide, imgSide, IMG_BOX_RADIUS)

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
      } else {
        drawImagePlaceholder(ctx, imgX, imgY, imgSide)
      }

      let ty = imgY + imgSide + IMG_TEXT_GAP

      ctx.font = `500 ${TITLE_FONT_PX}px ${FONT_UI}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const titleShow = truncateTextToWidth(ctx, (p.name || '—').trim() || '—', textMaxW)
      ctx.fillStyle = TITLE_COLOR
      ctx.fillText(titleShow, textLeft, ty)
      ty += TITLE_LINE_H + TITLE_TO_META_GAP

      drawMetaSkuSupplierPrice(ctx, textLeft, ty, p, textMaxW)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
  }

  const buffer = canvas.toBuffer('image/png')
  return { buffer, mimeType: 'image/png', fileExt: 'png' }
}
