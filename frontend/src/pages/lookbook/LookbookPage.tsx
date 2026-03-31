import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'
import { ApiError } from '../../services/api-client'
import { productApi } from '../../services/app-services'
import type { Product, Pagination } from '../../services/types'

const WHATSAPP_E164 =
  import.meta.env.VITE_WHATSAPP_E164 ?? '971501234567'

function parseFirstImage(p: Product): string {
  try {
    const imgs =
      typeof p.images === 'string' ? JSON.parse(p.images) : p.images
    if (Array.isArray(imgs) && imgs.length > 0 && typeof imgs[0] === 'string') {
      return imgs[0]
    }
  } catch {
    /* */
  }
  return ''
}

function getWhatsAppLink(sku?: string): string {
  const text = sku
    ? `Hi, I saw this in your catalog. Could you send me a video and more details for Item Code: ${sku}?`
    : `Hi, I'm interested in your products.`
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`
}

export function LookbookPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

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
    <div className="min-h-screen bg-white pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 pb-4 pt-6 backdrop-blur-md">
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Vaultcare
        </h1>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1">
            <Truck size={12} aria-hidden />
            Fast Ship
          </div>
          <div className="flex items-center gap-1">
            <Banknote size={12} aria-hidden />
            COD
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck size={12} aria-hidden />
            Private
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-slate-600">
          Explore our collection. Send the{' '}
          <strong className="text-slate-900">Item Code</strong> to our WhatsApp
          for videos and details.
        </p>
      </header>

      {loadError ? (
        <div
          className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      <main className="p-1">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-1">
          {products.map(p => {
            const img = parseFirstImage(p)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProduct(p)}
                className="group relative aspect-[4/5] w-full cursor-pointer overflow-hidden bg-slate-50 text-left"
              >
                {img ? (
                  <img
                    src={img}
                    alt={p.sku}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">
                    No Image
                  </div>
                )}
                <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-2 py-1 font-mono text-xs font-bold text-white shadow-sm backdrop-blur-sm sm:text-sm">
                  {p.sku}
                </div>
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex justify-center py-8" aria-live="polite">
            <Loader2 className="animate-spin text-slate-300" size={24} />
          </div>
        )}

        {!loading &&
          pagination &&
          pagination.page < pagination.total_pages && (
            <div className="mb-4 mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-slate-800"
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

function LookbookLightbox({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const src = parseFirstImage(product)
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookbook-lightbox-sku"
    >
      <div className="flex items-center justify-between p-4">
        <div
          id="lookbook-lightbox-sku"
          className="rounded bg-white/20 px-3 py-1 font-mono text-lg font-bold text-white"
        >
          {product.sku}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white/70 hover:text-white"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        {src ? (
          <img
            src={src}
            alt={product.sku}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <div className="text-white/50">No Image Available</div>
        )}
      </div>

      <div className="bg-gradient-to-t from-black to-transparent p-6">
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
