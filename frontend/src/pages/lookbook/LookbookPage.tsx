import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, X } from 'lucide-react'
import { ApiError } from '../../services/api-client'
import { productApi } from '../../services/app-services'
import type { Product, Pagination } from '../../services/types'

/** 与 backend/src/services/catalogPng.ts 一致，便于网页图册与导出 PNG 视觉对齐 */
const HEADER_PROMISE_LINES = [
  'Local Dubai Stock · Ships Fast',
  'Pay with Cash on Delivery',
  'Private & Discreet Shipping',
] as const

const WHATSAPP_E164 = import.meta.env.VITE_WHATSAPP_E164 ?? '971501234567'

function catalogGeneratedDateLabel(): string {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })
  return `图册生成 · ${s}`
}

function parseFirstImage(p: Product): string {
  try {
    const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
    if (Array.isArray(imgs) && imgs.length > 0 && typeof imgs[0] === 'string') {
      return imgs[0]
    }
  } catch {
    /* */
  }
  return ''
}

function formatPriceNum(n: number): string {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2).replace(/\.?0+$/, '')
}

function priceParts(p: Product): { num: string; currency: string } {
  const s = Number(p.sale_price) || 0
  const r = Number(p.regular_price) || 0
  const v = s > 0 ? s : r
  return { num: formatPriceNum(v), currency: 'AED' }
}

function getWhatsAppLink(sku?: string): string {
  const text = sku
    ? `Hi, I saw this in your catalog. Could you send me a video and more details for Item Code: ${sku}?`
    : `Hi, I'm interested in your products.`
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`
}

/** 与 catalogPng groupByCategory 一致：同分类连续成块 */
function groupByCategory(products: Product[]): Array<{ label: string; indices: number[] }> {
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

export function LookbookPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const categoryBlocks = useMemo(() => groupByCategory(products), [products])

  const loadMore = useCallback(async (pageNum: number) => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await productApi.list({
        page: pageNum,
        page_size: 50,
        status: '1',
        catalog_in: '1',
      })
      setProducts(prev => (pageNum === 1 ? data.items : [...prev, ...data.items]))
      setPagination(data.pagination)
    } catch (e: unknown) {
      setProducts([])
      setPagination(null)
      const isNetwork =
        e instanceof TypeError ||
        (e instanceof Error && /failed to fetch|network|load failed/i.test(e.message))
      if (isNetwork) {
        setLoadError(
          'Cannot reach the API. Start the backend (default port 3002) and ensure Vite proxies /api to it.',
        )
      } else if (e instanceof ApiError) {
        setLoadError(`Failed to load (${e.status}). ${e.message.slice(0, 200)}`)
      } else if (e instanceof Error) {
        setLoadError(e.message)
      } else {
        setLoadError('Failed to load products.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMore(1)
  }, [loadMore])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    void loadMore(nextPage)
  }

  useEffect(() => {
    if (!selectedProduct) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSelectedProduct(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedProduct])

  return (
    <div className="min-h-screen bg-[#F2F3F5] pb-24 text-[#1D1D1F] antialiased">
      {/* 顶栏承诺区：对齐 catalogPng PROMISE_BAR */}
      <header className="sticky top-0 z-10 border-b border-[rgba(60,60,67,0.18)] bg-[#FAFAFA]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1500px] px-6 py-[18px] md:px-12">
          <div className="space-y-0 text-center">
            {HEADER_PROMISE_LINES.map(line => (
              <p
                key={line}
                className="text-[17px] font-semibold leading-6 text-[#1D1D1F] tracking-tight"
              >
                {line}
              </p>
            ))}
          </div>
          <div className="mt-8 border-b border-[rgba(60,60,67,0.18)] pb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Vaultcare</h1>
            <p className="mt-2 text-xs font-medium text-[#6E6E73]">{catalogGeneratedDateLabel()}</p>
          </div>
          <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-relaxed text-[#6E6E73]">
            Explore our collection. Send the{' '}
            <strong className="font-semibold text-[#1D1D1F]">Item Code</strong> to our WhatsApp for
            videos and details.
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:mx-auto md:max-w-[1500px]"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      <main className="mx-auto max-w-[1500px] px-6 pb-8 pt-10 md:px-12">
        {categoryBlocks.map(block => (
          <section key={block.label} className="mb-10 last:mb-0">
            <div className="mb-9">
              <h2 className="text-left text-[28px] font-semibold leading-tight tracking-tight text-[#1D1D1F]">
                {block.label}
              </h2>
              <div
                className="mt-3 h-px w-40 bg-[rgba(60,60,67,0.18)]"
                aria-hidden
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {block.indices.map(idx => {
                const p = products[idx]
                return (
                  <LookbookProductCard
                    key={p.id}
                    product={p}
                    onOpen={() => setSelectedProduct(p)}
                  />
                )
              })}
            </div>
          </section>
        ))}

        {loading && (
          <div className="flex justify-center py-8" aria-live="polite">
            <Loader2 className="animate-spin text-[#AEAEB2]" size={24} />
          </div>
        )}

        {!loading &&
          pagination &&
          pagination.page < pagination.total_pages && (
            <div className="mb-4 mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="rounded-full bg-[#FF6700] px-8 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#e85f00]"
              >
                Load More Products
              </button>
            </div>
          )}
      </main>

      <a
        href={getWhatsAppLink()}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-105"
        aria-label="Open WhatsApp"
      >
        <MessageCircle size={28} aria-hidden />
      </a>

      {selectedProduct ? (
        <LookbookLightbox
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}
    </div>
  )
}

function LookbookProductCard({
  product,
  onOpen,
}: {
  product: Product
  onOpen: () => void
}) {
  const img = parseFirstImage(product)
  const { num, currency } = priceParts(product)
  const supFull = (product.supplier_codes || '').trim().replace(/\s+/g, ' ')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full cursor-pointer rounded-[14px] border border-transparent bg-white text-left shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
    >
      <div className="p-4">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-[#F5F5F7]"
        >
          {img ? (
            <img
              src={img}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] font-medium text-[#AEAEB2]">
              暂无图片
            </div>
          )}
        </div>
        <div className="mt-4 min-w-0">
          <p className="line-clamp-2 text-[13px] font-medium leading-[21px] text-[#3D3D41]">
            {(product.name || '—').trim() || '—'}
          </p>
          <div className="mt-3 flex min-w-0 items-baseline justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-mono font-bold text-[#1D1D1F]">
                {(product.sku || '—').toUpperCase()}
              </span>
              {supFull ? (
                <>
                  <span className="font-sans text-[13px] font-normal text-[#6E6E73]"> · </span>
                  <span className="font-mono text-xs font-normal text-[#AEAEB2]">{supFull}</span>
                </>
              ) : null}
            </p>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              <span className="text-2xl font-semibold text-[#FF6700]">{num}</span>
              <span className="text-2xl font-medium text-[#FF6700]"> {currency}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function LookbookLightbox({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const src = parseFirstImage(product)
  const { num, currency } = priceParts(product)
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookbook-lightbox-title"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p
            id="lookbook-lightbox-title"
            className="font-mono text-lg font-bold text-white"
          >
            {(product.sku || '—').toUpperCase()}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-white/75">{product.name}</p>
          <p className="mt-2 font-mono text-xl font-semibold text-[#FF6700]">
            {num} {currency}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-white/10 p-2 text-white/80 hover:text-white"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        <div className="flex h-full max-h-full w-full max-w-4xl items-center justify-center rounded-[10px] bg-[#F5F5F7]">
          {src ? (
            <img
              src={src}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-[#AEAEB2]">No Image Available</div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/40 p-6">
        <a
          href={getWhatsAppLink(product.sku)}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-4 text-lg font-bold text-white shadow-lg transition-colors hover:bg-[#20bd5a]"
        >
          <MessageCircle size={24} aria-hidden />
          Ask for Video & Details
        </a>
      </div>
    </div>
  )
}
