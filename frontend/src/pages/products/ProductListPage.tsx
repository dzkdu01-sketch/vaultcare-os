import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATALOG_TAG_HER, CATALOG_TAG_HIM, hasGenderCatalogTag, normalizeCatalogTagNames } from '../../lib/catalogTags'
import { DEFAULT_PRODUCT_CATEGORIES, parseTaxonomyJson } from '../../lib/productTaxonomy'
import { ApiError } from '../../services/api-client'
import { productApi, settingsApi, siteApi } from '../../services/app-services'
import type { Product, Pagination, Site } from '../../services/types'

type EditingCell = { id: string; field: string } | null

export function ProductListPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: 150, total: 0, total_pages: 0 })
  const [totalSites, setTotalSites] = useState(0)
  /** 本地库商品总数（与列表筛选无关）；全量同步会推送全部 db 件 */
  const [dbProductCount, setDbProductCount] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  /** 默认上架（出售中），避免首屏混入草稿 */
  const [filterStatus, setFilterStatus] = useState('1')
  const [filterTag, setFilterTag] = useState('')
  const [filterCatalogIn, setFilterCatalogIn] = useState<'0' | '1' | ''>('')
  const [loading, setLoading] = useState(true)
  const [syncingAll, setSyncingAll] = useState(false)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const [selectedSyncSites, setSelectedSyncSites] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [showImport, setShowImport] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [categories, setCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES)
  const [loadError, setLoadError] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const syncMenuRef = useRef<HTMLDivElement>(null)
  const importMenuRef = useRef<HTMLDivElement>(null)

  const parseProductTags = (p: Product): string[] => {
    try {
      const t = p.tags
      if (Array.isArray(t)) return normalizeCatalogTagNames(t)
      if (typeof t === 'string') return normalizeCatalogTagNames(JSON.parse(t || '[]'))
    } catch { /* */ }
    return []
  }

  const loadProducts = async (page = 1, overrides?: { category?: string; status?: string; tag?: string; catalog_in?: '0' | '1' | '' }) => {
    setLoading(true)
    setLoadError('')
    try {
      const cat = overrides?.category !== undefined ? overrides.category : filterCategory
      const st = overrides?.status !== undefined ? overrides.status : filterStatus
      const tg = overrides?.tag !== undefined ? overrides.tag : filterTag
      const fc = overrides?.catalog_in !== undefined ? overrides.catalog_in : filterCatalogIn
      const data = await productApi.list({
        keyword: keyword || undefined,
        page,
        page_size: 150,
        category: cat || undefined,
        status: st !== '' ? st : undefined,
        tag: tg || undefined,
        catalog_in: fc === '0' || fc === '1' ? fc : undefined,
      })
      setProducts(data.items)
      setPagination(data.pagination)
      setTotalSites(data.total_sites || 0)
      setDbProductCount(typeof data.db_product_count === 'number' ? data.db_product_count : data.pagination?.total ?? 0)
    } catch (e: unknown) {
      setProducts([])
      setPagination({ page: 1, page_size: 150, total: 0, total_pages: 0 })
      setTotalSites(0)
      setDbProductCount(0)
      const isNetwork =
        e instanceof TypeError ||
        (e instanceof Error && /failed to fetch|network|load failed/i.test(e.message))
      if (isNetwork) {
        setLoadError(
          '无法连接后端 API（开发环境 Vite 会将 /api 代理到 http://localhost:3002）。请在 vault-os1.1/backend 执行 npm run dev 启动本仓库后端；若仍无数据，可能是新的空库，需从备份恢复 backend/data/vaultcare.db 或从站点导入。',
        )
      } else if (e instanceof ApiError) {
        setLoadError(`加载失败（HTTP ${e.status}）：${e.message.slice(0, 280)}${e.message.length > 280 ? '…' : ''}`)
      } else if (e instanceof Error) {
        setLoadError(`加载失败：${e.message}`)
      } else {
        setLoadError('加载失败，请稍后重试。')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts(); siteApi.list().then(setSites) }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await settingsApi.get()
        if (!cancelled) {
          setCategories(parseTaxonomyJson(s.product_categories_json, DEFAULT_PRODUCT_CATEGORIES))
        }
      } catch {
        if (!cancelled) setCategories(DEFAULT_PRODUCT_CATEGORIES)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus()
  }, [editingCell])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (syncMenuRef.current && !syncMenuRef.current.contains(e.target as Node)) setShowSyncMenu(false)
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setShowImport(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSelectedIds(new Set()); loadProducts(1) }

  const handleSyncAll = async () => {
    if (selectedSyncSites.length === 0) return
    const totalInDb = dbProductCount > 0 ? dbProductCount : pagination.total
    const msg = `将同步本地数据库中的全部 ${totalInDb} 件商品到已选的 ${selectedSyncSites.length} 个站点。\n\n此操作与当前列表的搜索/筛选无关；编辑页「同步至网站」才是只推一件商品。\n\n确定继续？`
    if (!confirm(msg)) return
    setShowSyncMenu(false)
    setSyncingAll(true)
    try {
      const result = await productApi.syncAll(selectedSyncSites)
      const withSkips = result.details?.filter(d => (d.skipped_images?.length ?? 0) > 0) ?? []
      const skipHint =
        withSkips.length > 0
          ? `\n\n${withSkips.length} 件商品有图片因远程不可访问被跳过（其余内容已同步），SKU 示例：${withSkips
              .slice(0, 8)
              .map(d => d.sku)
              .join(', ')}${withSkips.length > 8 ? '…' : ''}`
          : ''
      alert(
        `全量同步完成：共 ${result.products} 件商品参与；按站点计成功 ${result.synced} 次、失败 ${result.failed} 次。${skipHint}`,
      )
      loadProducts(pagination.page)
    } catch (err: any) {
      alert(`同步失败: ${err.message}`)
    } finally {
      setSyncingAll(false)
    }
  }

  const toggleSyncSite = (id: string) => {
    setSelectedSyncSites(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handlePullFromSite = async (siteId: string) => {
    setShowImport(false)
    setPulling(true)
    try {
      const result = await productApi.pullFromSite(siteId)
      alert(`导入完成：共 ${result.total} 个产品，新建 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`)
      loadProducts(1)
    } catch (err: any) {
      alert(`导入失败: ${err.message}`)
    } finally {
      setPulling(false)
    }
  }

  const startCellEdit = (p: Product, field: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCell({ id: p.id, field })
    if (field === 'sale_price') setEditValue(p.sale_price || 0)
    else if (field === 'category') setEditValue(p.category || '')
    else if (field === 'status') setEditValue(p.status ?? 1)
    else if (field === 'name') setEditValue(p.name)
  }

  const saveCell = async (overrideValue?: any) => {
    if (!editingCell) return
    const { id, field } = editingCell
    const val = overrideValue !== undefined ? overrideValue : editValue
    const update: Record<string, any> = {}
    if (field === 'sale_price') update.sale_price = parseFloat(val) || 0
    else if (field === 'category') update.category = val || undefined
    else if (field === 'name') update.name = val
    setEditingCell(null)
    try {
      await productApi.update(id, update)
    } catch (err: any) {
      alert(`保存失败: ${err.message}`)
    }
    loadProducts(pagination.page)
  }

  const cancelCell = () => { setEditingCell(null) }

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveCell()
    else if (e.key === 'Escape') cancelCell()
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除该产品？此操作不可恢复。')) return
    try {
      await productApi.remove(id)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await loadProducts(pagination.page)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '删除失败'
      alert(`删除失败：${msg}`)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    const n = selectedIds.size
    if (!confirm(`确定删除选中的 ${n} 个产品？此操作不可恢复。`)) return
    setBatchUpdating(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map(id => productApi.remove(id)))
      setSelectedIds(new Set())
      await loadProducts(pagination.page)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '批量删除失败'
      alert(`批量删除失败：${msg}`)
    } finally {
      setBatchUpdating(false)
    }
  }

  const getFirstImage = (p: Product) => {
    try {
      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || [])
      return imgs[0] || null
    } catch { return null }
  }

  const isEditing = (id: string, field: string) => editingCell?.id === id && editingCell?.field === field

  const renderSyncBadge = (p: Product) => {
    const synced = p.synced_count || 0
    const failed = p.failed_count || 0
    const tooltip = p.synced_site_names
      ? `已同步站点: ${p.synced_site_names}`
      : `已同步 ${synced}/${totalSites} 站点`
    if (totalSites === 0) return <span className="text-xs text-slate-300">-</span>
    if (failed > 0) return <span title={tooltip} className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600 cursor-default">{synced}/{totalSites} (failed)</span>
    if (synced === 0) return <span title={tooltip} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400 cursor-default">未同步</span>
    if (synced === totalSites) return <span title={tooltip} className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 cursor-default">{synced}/{totalSites}</span>
    return <span title={tooltip} className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 cursor-default">{synced}/{totalSites}</span>
  }

  // Batch selection
  const allSelected = products.length > 0 && products.every(p => selectedIds.has(p.id))
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map(p => p.id)))
    }
  }
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchStatus = async (status: number) => {
    if (selectedIds.size === 0) return
    setBatchUpdating(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id => productApi.update(id, { status })))
      setSelectedIds(new Set())
      loadProducts(pagination.page)
    } catch (err: any) {
      alert(`批量更新失败: ${err.message}`)
    } finally {
      setBatchUpdating(false)
    }
  }

  const toggleRowCatalogIn = async (p: Product, next: 0 | 1) => {
    const tags = parseProductTags(p)
    if (next === 1 && !hasGenderCatalogTag(tags)) return
    try {
      await productApi.update(p.id, { catalog_in: next })
      loadProducts(pagination.page)
    } catch (err: any) {
      alert(err?.message || '保存失败')
    }
  }

  const handleBatchCatalog = async (catalog_in: 0 | 1) => {
    if (selectedIds.size === 0) return
    setBatchUpdating(true)
    try {
      const r = await productApi.patchCatalogBatch(Array.from(selectedIds), catalog_in)
      if (r.failed?.length) {
        alert(`部分未更新：${r.failed.map(f => `${f.id}(${f.reason})`).join('；')}`)
      }
      setSelectedIds(new Set())
      loadProducts(pagination.page)
    } catch (err: any) {
      alert(`批量更新失败: ${err.message}`)
    } finally {
      setBatchUpdating(false)
    }
  }

  const cellClass = 'cursor-pointer hover:bg-violet-50/50 rounded px-1 -mx-1 transition-colors'
  const colSpanCount = 11

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 items-center">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索 SKU / 名称 / 分类"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-64"
          />
          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); loadProducts(1, { category: e.target.value }) }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">全部分类</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); loadProducts(1, { status: e.target.value }) }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">全部状态</option>
            <option value="1">上架（出售中）</option>
            <option value="0">草稿</option>
          </select>
          <select
            value={filterTag}
            onChange={e => { setFilterTag(e.target.value); loadProducts(1, { tag: e.target.value }) }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm min-w-[8rem]"
            title="图册标签"
          >
            <option value="">全部标签</option>
            <option value={CATALOG_TAG_HIM}>{CATALOG_TAG_HIM}</option>
            <option value={CATALOG_TAG_HER}>{CATALOG_TAG_HER}</option>
          </select>
          <select
            value={filterCatalogIn}
            onChange={e => {
              const v = e.target.value as '' | '0' | '1'
              setFilterCatalogIn(v)
              loadProducts(1, { catalog_in: v })
            }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm min-w-[7rem]"
            title="进图册筛选"
          >
            <option value="">全部（进图册）</option>
            <option value="1">仅进图册</option>
            <option value="0">未进图册</option>
          </select>
          <button type="submit" className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">搜索</button>
        </form>
        <div className="flex gap-2">
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setShowImport(!showImport)}
              disabled={pulling || sites.length === 0}
              className="px-4 py-2 text-sm border border-emerald-200 text-emerald-600 rounded-md hover:bg-emerald-50 disabled:opacity-50"
            >
              {pulling ? '导入中...' : '从源站导入'}
            </button>
            {showImport && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[200px]">
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">选择源站点</p>
                {sites.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handlePullFromSite(s.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative" ref={syncMenuRef}>
            <button
              onClick={() => { setShowSyncMenu(!showSyncMenu); setShowImport(false) }}
              disabled={syncingAll || dbProductCount === 0}
              title={dbProductCount > 0 ? `将同步本地全部 ${dbProductCount} 件商品（与筛选无关）` : '本地无商品可同步'}
              className="px-4 py-2 text-sm border border-violet-200 text-violet-600 rounded-md hover:bg-violet-50 disabled:opacity-50"
            >
              {syncingAll ? '同步中...' : '同步全部到站点'}
            </button>
            {showSyncMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[220px]">
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">
                  全量同步（本地约 {dbProductCount || '—'} 件，与筛选无关）
                </p>
                {sites.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedSyncSites.includes(s.id)}
                      onChange={() => toggleSyncSite(s.id)}
                      className="rounded border-slate-300"
                    />
                    {s.name}
                  </label>
                ))}
                <div className="px-3 py-2 border-t border-slate-100">
                  <button
                    onClick={handleSyncAll}
                    disabled={selectedSyncSites.length === 0}
                    className="w-full px-3 py-1.5 bg-violet-600 text-white text-sm rounded hover:bg-violet-700 disabled:opacity-50"
                  >
                    确认同步全部商品 ({selectedSyncSites.length} 个站点)
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/products/catalog')}
            className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700"
          >
            客户图册
          </button>
          <button
            onClick={() => navigate('/products/new')}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700"
          >
            新建产品
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleSelectAll()}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-14">图片</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">名称</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 w-24">售价</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-44">分类</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">状态</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600 w-20" title="需有 for him / for her 标签才可进图册">进图册</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">同步</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-32">供应商编码</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpanCount} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={colSpanCount} className="px-4 py-8 text-center text-slate-500">未能加载列表，请查看上方提示后重试。</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={colSpanCount} className="px-4 py-8 text-center text-slate-400">暂无产品</td></tr>
            ) : products.map(p => {
              const img = getFirstImage(p)
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {img ? <img src={img} alt="" className="w-8 h-8 object-cover rounded border border-slate-200" />
                      : <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-300 text-[10px]">N/A</div>}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 text-xs">{p.sku}</td>

                  {/* 名称 - clickable to edit */}
                  <td className="px-4 py-2 max-w-[280px]">
                    {isEditing(p.id, 'name') ? (
                      <input
                        ref={inputRef as any}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => void saveCell()}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-violet-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    ) : (
                      <span
                        onClick={e => startCellEdit(p, 'name', e)}
                        title={p.name}
                        className={`${cellClass} text-slate-900 block truncate`}
                      >{p.name}</span>
                    )}
                  </td>

                  {/* 售价 - clickable to edit */}
                  <td className="px-4 py-2 text-right">
                    {isEditing(p.id, 'sale_price') ? (
                      <input
                        ref={inputRef as any}
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => void saveCell()}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-violet-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    ) : (
                      <span onClick={e => startCellEdit(p, 'sale_price', e)} className={`${cellClass} text-slate-700`}>
                        {p.sale_price > 0 ? `AED ${p.sale_price}` : '-'}
                      </span>
                    )}
                  </td>

                  {/* 分类 - clickable to edit (dropdown) */}
                  <td className="px-4 py-2">
                    {isEditing(p.id, 'category') ? (
                      <select
                        ref={inputRef as any}
                        value={editValue}
                        onChange={e => { const v = e.target.value; setEditValue(v); saveCell(v) }}
                        onBlur={() => void saveCell()}
                        className="w-full px-2 py-1 border border-violet-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="">--</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span onClick={e => startCellEdit(p, 'category', e)} className={`${cellClass} text-slate-600`}>{p.category || '-'}</span>
                    )}
                  </td>

                  {/* 状态 - display only */}
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.status === 1 ? 'Active' : 'Draft'}
                    </span>
                  </td>

                  {/* 进图册 */}
                  <td className="px-4 py-2 text-center">
                    {(() => {
                      const tags = parseProductTags(p)
                      const canCatalog = hasGenderCatalogTag(tags)
                      const inCatalog = Number(p.catalog_in) === 1
                      const disabled = !canCatalog && !inCatalog
                      return (
                        <input
                          type="checkbox"
                          checked={inCatalog}
                          disabled={disabled}
                          title={disabled ? '需先在编辑页为该产品选择 for him 或 for her 标签' : (inCatalog ? '已加入客户图册' : '加入客户图册')}
                          onChange={e => { e.stopPropagation(); void toggleRowCatalogIn(p, e.target.checked ? 1 : 0) }}
                          className="rounded border-slate-300"
                        />
                      )
                    })()}
                  </td>

                  {/* 同步 */}
                  <td className="px-4 py-2">{renderSyncBadge(p)}</td>

                  {/* 供应商编码 */}
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{p.supplier_codes || '-'}</td>

                  {/* 操作 */}
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={e => { e.stopPropagation(); navigate(`/products/${p.id}/edit`) }} className="text-violet-600 hover:text-violet-800 mr-2">编辑</button>
                    <button onClick={e => handleDelete(p.id, e)} className="text-red-500 hover:text-red-700">删除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>共 {pagination.total} 条</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => loadProducts(pagination.page - 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">上一页</button>
            <span className="px-3 py-1">{pagination.page} / {pagination.total_pages}</span>
            <button disabled={pagination.page >= pagination.total_pages} onClick={() => loadProducts(pagination.page + 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">下一页</button>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm text-slate-600">已选 {selectedIds.size} 项</span>
          <button
            onClick={() => handleBatchStatus(1)}
            disabled={batchUpdating}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            设为 Active
          </button>
          <button
            onClick={() => handleBatchStatus(0)}
            disabled={batchUpdating}
            className="px-4 py-1.5 text-sm bg-slate-500 text-white rounded hover:bg-slate-600 disabled:opacity-50"
          >
            设为 Draft
          </button>
          <button
            onClick={() => handleBatchCatalog(1)}
            disabled={batchUpdating}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            title="需有 for him / for her 标签；无标签的行会失败并提示"
          >
            加入进图册
          </button>
          <button
            onClick={() => handleBatchCatalog(0)}
            disabled={batchUpdating}
            className="px-4 py-1.5 text-sm border border-amber-200 text-amber-800 rounded hover:bg-amber-50 disabled:opacity-50"
          >
            移出进图册
          </button>
          <button
            type="button"
            onClick={() => void handleBatchDelete()}
            disabled={batchUpdating}
            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            批量删除
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
