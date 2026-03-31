# WhatsApp Lookbook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a minimalist, mobile-optimized digital product lookbook optimized for WhatsApp conversions, focusing purely on product images and item codes.

**Architecture:** We will create a new frontend route `/lookbook` that operates independently from the main administrative `AppShell`. This allows the lookbook to serve as a public-facing, mobile-first catalog. It will use the existing `/api/v1/product/items` backend endpoint but present the data in a 3-column masonry/grid layout without any e-commerce distractions.

**Tech Stack:** React 19, Tailwind CSS, React Router DOM, Lucide React (for icons)

---

### Task 1: Create the Lookbook Route

**Files:**
- Create: `D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx`
- Modify: `D:\cursor\vault-os1.1\frontend\src\app\router\index.tsx`

**Step 1: Write the minimal component and route**

Create a skeleton component for the lookbook in `LookbookPage.tsx` and wire it up in the router so it can be accessed without the admin `AppShell` wrapping it.

In `frontend/src/pages/lookbook/LookbookPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { productApi } from '../../services/app-services'
import type { Product } from '../../services/types'

export function LookbookPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="text-center py-10">Lookbook Loading...</div>
    </div>
  )
}
```

In `frontend/src/app/router/index.tsx`:
Add the import:
```tsx
import { LookbookPage } from '../../pages/lookbook/LookbookPage'
```

Add the route **before** the `*` wildcard, and **without** the `<AppShell>` wrapper:
```tsx
      <Route path="/lookbook" element={<LookbookPage />} />
```

**Step 2: Run test to verify it passes**

Run: `powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx D:\cursor\vault-os1.1\frontend\src\app\router\index.tsx
git commit -m "feat: add skeleton for lookbook route"
```

---

### Task 2: Build the Trust Header

**Files:**
- Modify: `D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx`

**Step 1: Implement the Header UI**

Update `LookbookPage.tsx` to include the Logo, the 3 core selling points (Stock, COD, Private Shipping) using Lucide icons, and the hero instruction text.

```tsx
import { useEffect, useState } from 'react'
import { Truck, Banknote, ShieldCheck } from 'lucide-react'

export function LookbookPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="pt-6 pb-4 px-4 sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-center text-slate-900 tracking-tight">Vaultcare</h1>

        {/* Trust Signals */}
        <div className="flex justify-center items-center gap-4 mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          <div className="flex items-center gap-1"><Truck size={12} /> Fast Ship</div>
          <div className="flex items-center gap-1"><Banknote size={12} /> COD</div>
          <div className="flex items-center gap-1"><ShieldCheck size={12} /> Private</div>
        </div>

        {/* Hero Instruction */}
        <p className="text-center text-sm text-slate-600 mt-4 leading-relaxed max-w-md mx-auto">
          Explore our collection. Send the <strong className="text-slate-900">Item Code</strong> to our WhatsApp for videos and details.
        </p>
      </header>

      {/* Placeholder for Grid */}
      <main className="p-1">
         <div className="text-center text-slate-400 py-10 text-sm">Products will load here...</div>
      </main>
    </div>
  )
}
```

**Step 2: Run test to verify it passes**

Run: `powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx
git commit -m "feat: add trust header and hero instruction to lookbook"
```

---

### Task 3: Implement the 3-Column Image Grid & Data Fetching

**Files:**
- Modify: `D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx`

**Step 1: Implement data fetching and grid layout**

Load products using `productApi.list({ page: 1, page_size: 50, status: '1', catalog_in: '1' })`. We only want active items that are flagged for the catalog.
Implement a strict 3-column CSS grid. The images should have `aspect-square` or `aspect-[4/5]` to ensure uniformity. The Item Code (SKU) must be overlaid on the bottom-left of each image.

```tsx
import { useEffect, useState } from 'react'
import { Truck, Banknote, ShieldCheck, Loader2 } from 'lucide-react'
import { productApi } from '../../services/app-services'
import type { Product, Pagination } from '../../services/types'

export function LookbookPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)

  const loadMore = async (pageNum: number) => {
    setLoading(true)
    try {
      const data = await productApi.list({ page: pageNum, page_size: 50, status: '1', catalog_in: '1' })
      setProducts(prev => pageNum === 1 ? data.items : [...prev, ...data.items])
      setPagination(data.pagination)
    } catch (e) {
      console.error('Failed to load lookbook', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMore(1)
  }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadMore(nextPage)
  }

  const parseImage = (p: Product) => {
    try {
      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
      if (Array.isArray(imgs) && imgs.length > 0) return imgs[0]
    } catch { /* empty */ }
    return ''
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="pt-6 pb-4 px-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-center text-slate-900 tracking-tight">Vaultcare</h1>
        <div className="flex justify-center items-center gap-4 mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          <div className="flex items-center gap-1"><Truck size={12} /> Fast Ship</div>
          <div className="flex items-center gap-1"><Banknote size={12} /> COD</div>
          <div className="flex items-center gap-1"><ShieldCheck size={12} /> Private</div>
        </div>
        <p className="text-center text-sm text-slate-600 mt-4 leading-relaxed max-w-md mx-auto">
          Explore our collection. Send the <strong className="text-slate-900">Item Code</strong> to our WhatsApp for videos and details.
        </p>
      </header>

      <main className="p-1">
        <div className="grid grid-cols-3 gap-1 max-w-4xl mx-auto">
          {products.map((p) => {
            const img = parseImage(p)
            return (
              <div key={p.id} className="relative aspect-[4/5] bg-slate-50 overflow-hidden group cursor-pointer">
                {img ? (
                  <img src={img} alt={p.sku} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No Image</div>
                )}
                {/* Item Code Overlay */}
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white font-mono text-xs sm:text-sm font-bold shadow-sm">
                  {p.sku}
                </div>
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-300" size={24} />
          </div>
        )}

        {!loading && pagination && pagination.page < pagination.total_pages && (
          <div className="flex justify-center mt-8 mb-4">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-full shadow-md hover:bg-slate-800 transition-colors"
            >
              Load More Products
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 2: Run test to verify it passes**

Run: `powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx
git commit -m "feat: implement 3-column product grid with item code overlays"
```

---

### Task 4: Add Lightbox and WhatsApp Integration

**Files:**
- Modify: `D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx`

**Step 1: Implement Lightbox state and WhatsApp redirection**

When a user clicks a product image, open a full-screen Lightbox overlay. Inside the Lightbox, place a massive "Ask for Video on WhatsApp" button that deep-links to WhatsApp with a pre-filled message containing the SKU. Also add a global floating WhatsApp icon.

*Note: For the WhatsApp link, you will use a placeholder number like `+971501234567` which the user can configure later via settings or environment variables, or hardcode for now.*

```tsx
import { useEffect, useState } from 'react'
import { Truck, Banknote, ShieldCheck, Loader2, X, MessageCircle } from 'lucide-react'
import { productApi } from '../../services/app-services'
import type { Product, Pagination } from '../../services/types'

// Add your support number here
const WHATSAPP_NUMBER = '971501234567'

export function LookbookPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)

  // Lightbox state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const loadMore = async (pageNum: number) => {
    setLoading(true)
    try {
      const data = await productApi.list({ page: pageNum, page_size: 50, status: '1', catalog_in: '1' })
      setProducts(prev => pageNum === 1 ? data.items : [...prev, ...data.items])
      setPagination(data.pagination)
    } catch (e) {
      console.error('Failed to load lookbook', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMore(1) }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadMore(nextPage)
  }

  const parseImage = (p: Product) => {
    try {
      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
      if (Array.isArray(imgs) && imgs.length > 0) return imgs[0]
    } catch { /* empty */ }
    return ''
  }

  const getWhatsAppLink = (sku?: string) => {
    const text = sku
      ? `Hi, I saw this in your catalog. Could you send me a video and more details for Item Code: ${sku}?`
      : `Hi, I'm interested in your products.`
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="pt-6 pb-4 px-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-center text-slate-900 tracking-tight">Vaultcare</h1>
        <div className="flex justify-center items-center gap-4 mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          <div className="flex items-center gap-1"><Truck size={12} /> Fast Ship</div>
          <div className="flex items-center gap-1"><Banknote size={12} /> COD</div>
          <div className="flex items-center gap-1"><ShieldCheck size={12} /> Private</div>
        </div>
        <p className="text-center text-sm text-slate-600 mt-4 leading-relaxed max-w-md mx-auto">
          Explore our collection. Send the <strong className="text-slate-900">Item Code</strong> to our WhatsApp for videos and details.
        </p>
      </header>

      <main className="p-1">
        <div className="grid grid-cols-3 gap-1 max-w-4xl mx-auto">
          {products.map((p) => {
            const img = parseImage(p)
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className="relative aspect-[4/5] bg-slate-50 overflow-hidden group cursor-pointer"
              >
                {img ? (
                  <img src={img} alt={p.sku} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No Image</div>
                )}
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white font-mono text-xs sm:text-sm font-bold shadow-sm">
                  {p.sku}
                </div>
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-300" size={24} />
          </div>
        )}

        {!loading && pagination && pagination.page < pagination.total_pages && (
          <div className="flex justify-center mt-8 mb-4">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-full shadow-md hover:bg-slate-800 transition-colors"
            >
              Load More Products
            </button>
          </div>
        )}
      </main>

      {/* Global Floating Action Button */}
      <a
        href={getWhatsAppLink()}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform z-20"
      >
        <MessageCircle size={28} />
      </a>

      {/* Lightbox Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex justify-between items-center p-4">
            <div className="text-white font-mono font-bold text-lg px-3 py-1 bg-white/20 rounded">
              {selectedProduct.sku}
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="p-2 text-white/70 hover:text-white bg-white/10 rounded-full"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
             {parseImage(selectedProduct) ? (
               <img
                 src={parseImage(selectedProduct)}
                 alt={selectedProduct.sku}
                 className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
               />
             ) : (
               <div className="text-white/50">No Image Available</div>
             )}
          </div>

          <div className="p-6 bg-gradient-to-t from-black to-transparent">
            <a
              href={getWhatsAppLink(selectedProduct.sku)}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#20bd5a] transition-colors text-lg"
            >
              <MessageCircle size={24} />
              Ask for Video & Details
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run test to verify it passes**

Run: `powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add D:\cursor\vault-os1.1\frontend\src\pages\lookbook\LookbookPage.tsx
git commit -m "feat: add lightbox preview and whatsapp deep linking to lookbook"
```
