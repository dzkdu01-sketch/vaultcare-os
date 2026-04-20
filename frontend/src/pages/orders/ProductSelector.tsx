import { useEffect, useState } from 'react'
import { productApi, favoriteApi } from '../../services/app-services'
import type { Product } from '../../services/types'

type Props = {
  onSelect: (products: Product[]) => void
  onClose: () => void
  existingSkus?: string[]
}

export function ProductSelector({ onSelect, onClose, existingSkus = [] }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [tab, setTab] = useState<'all' | 'favorites'>('all')

  const existingSet = new Set(existingSkus)

  const loadProducts = async (p = 1) => {
    setLoading(true)
    try {
      const data = await productApi.list({ keyword: keyword || undefined, page: p, page_size: 100, status: '1' })
      setProducts(data.items)
      setTotalPages(data.pagination.total_pages)
      setTotal(data.pagination.total)
      setPage(p)
    } finally { setLoading(false) }
  }

  const loadFavorites = async () => {
    try {
      const data = await favoriteApi.list()
      setFavorites(data)
      setFavoriteIds(new Set(data.map((f: any) => f.product_id)))
    } catch { }
  }

  useEffect(() => {
    loadProducts()
    loadFavorites()
  }, [])

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const toggleFavorite = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (favoriteIds.has(productId)) {
      await favoriteApi.remove(productId)
      setFavoriteIds(prev => { const next = new Set(prev); next.delete(productId); return next })
      setFavorites(prev => prev.filter(f => f.product_id !== productId))
    } else {
      await favoriteApi.add(productId)
      setFavoriteIds(prev => new Set(prev).add(productId))
      loadFavorites()
    }
  }

  const displayProducts = tab === 'favorites' ? favorites.map((f: any) => ({
    id: f.product_id, sku: f.sku, name: f.name, images: f.images,
    sale_price: f.sale_price, status: f.status, supplier_codes: '',
  } as any)) : products

  const toggleAll = () => {
    if (selected.size === displayProducts.length) setSelected(new Set())
    else setSelected(new Set(displayProducts.map((p: any) => p.id || p.product_id)))
  }

  const handleConfirm = () => {
    const allProds = tab === 'favorites' ? displayProducts : products
    const sel = allProds.filter((p: any) => selected.has(p.id || p.product_id))
    const dupes = sel.filter((p: any) => existingSet.has(p.sku))
    if (dupes.length > 0) {
      if (!confirm(`以下商品已在订单中：${dupes.map((d: any) => d.sku).join(', ')}。确定要重复添加吗？`)) return
    }
    onSelect(sel as Product[])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-[960px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-slate-900">选择商品</h3>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => { setTab('all'); setSelected(new Set()) }}
                className={`px-3 py-1 text-sm rounded-md transition ${tab === 'all' ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
                全部
              </button>
              <button onClick={() => { setTab('favorites'); setSelected(new Set()) }}
                className={`px-3 py-1 text-sm rounded-md transition ${tab === 'favorites' ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
                常用 {favorites.length > 0 && `(${favorites.length})`}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        {tab === 'all' && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="flex-1 relative">
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadProducts(1)}
                placeholder="搜索 SKU / 名称" className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-md text-sm" />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button onClick={() => loadProducts(1)} className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">搜索</button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === displayProducts.length}
                    onChange={toggleAll} className="accent-primary" />
                </th>
                <th className="text-left px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">商品编号</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">商品名称</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-16">图片</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">售价 (AED)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">状态</th>
              </tr>
            </thead>
            <tbody>
              {loading && tab === 'all' ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
              ) : displayProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {tab === 'favorites' ? '暂无常用商品，在"全部"标签中点击星标添加' : '暂无数据'}
                </td></tr>
              ) : displayProducts.map((p: any) => {
                const pid = p.id || p.product_id
                const isDupe = existingSet.has(p.sku)
                const isFav = favoriteIds.has(pid)
                const imgs = Array.isArray(p.images) ? p.images : (() => { try { return JSON.parse(p.images || '[]') } catch { return [] } })()
                return (
                  <tr key={pid} className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${isDupe ? 'bg-yellow-50' : ''}`}
                    onClick={() => toggleSelect(pid)}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(pid)} onChange={() => toggleSelect(pid)}
                        className="accent-primary" onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={(e) => toggleFavorite(pid, e)}
                        className={`text-lg transition ${isFav ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}
                        title={isFav ? '取消收藏' : '收藏'}>
                        {isFav ? '★' : '☆'}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {p.sku}
                      {isDupe && <span className="ml-1 text-xs text-yellow-600">(已添加)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-900 max-w-48 truncate" title={p.name}>{p.name}</td>
                    <td className="px-4 py-3">
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt="" className="w-10 h-10 object-cover rounded border border-slate-200"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
                      ) : null}
                      <div className={`w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-[10px] ${imgs.length > 0 ? 'hidden' : ''}`}>N/A</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.sale_price || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 1 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.status === 1 ? '销售中' : '已下架'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {tab === 'all' ? (
              <>
                <span>共 {total} 条</span>
                {totalPages > 1 && (
                  <div className="flex gap-1">
                    <button disabled={page <= 1} onClick={() => loadProducts(page - 1)}
                      className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">&lt;</button>
                    <span className="px-2 py-1">第 {page} 页</span>
                    <button disabled={page >= totalPages} onClick={() => loadProducts(page + 1)}
                      className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">&gt;</button>
                  </div>
                )}
              </>
            ) : (
              <span>常用商品 {favorites.length} 个</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">取消</button>
            <button onClick={handleConfirm} disabled={selected.size === 0}
              className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50">
              确定 {selected.size > 0 && `(${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
