import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATALOG_TAG_HER, CATALOG_TAG_HIM, hasGenderCatalogTag, normalizeCatalogTagNames } from '../../lib/catalogTags'
import { DEFAULT_PRODUCT_CATEGORIES, parseTaxonomyJson } from '../../lib/productTaxonomy'
import { ApiError } from '../../services/api-client'
import { productApi, settingsApi, siteApi } from '../../services/app-services'
import type { Product, Pagination, Site, SyncResult } from '../../services/types'

type EditingCell = { id: string; field: string } | null

const GATEWAY_TIMEOUT_HINT =
  '网关超时（504）。可尝试：减少一次勾选数量或分批同步；仍频繁出现请联系管理员调大 Nginx proxy_read_timeout。'

function summarizeSyncFailures(
  details: Array<{ sku: string; results: SyncResult['results'] }>,
  maxLines = 18,
): string {
  const lines: string[] = []
  for (const d of details) {
    for (const r of d.results) {
      if (!r.success) {
        const err = (r.error || '未知错误').trim().slice(0, 100)
        lines.push(`· ${d.sku} @ ${r.site_name}：${err}`)
      }
    }
  }
  if (lines.length === 0) return ''
  const shown = lines.slice(0, maxLines)
  const more =
    lines.length > maxLines
      ? `\n… 另有 ${lines.length - maxLines} 条失败未展开，可缩小批量后重试或查看服务端日志。`
      : ''
  return `\n\n失败明细（共 ${lines.length} 条，显示前 ${shown.length} 条）：\n${shown.join('\n')}${more}`
}

function formatSiteNamesForUi(names: string[], maxShow = 3): string {
  if (names.length === 0) return '—'
  if (names.length <= maxShow) return names.join('、')
  return `${names.slice(0, maxShow).join('、')} 等 ${names.length} 个站点`
}

const LIST_PAGE_SIZE_OPTIONS = [30, 70, 150] as const
type ListPageSize = (typeof LIST_PAGE_SIZE_OPTIONS)[number]

export function ProductListPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: 150, total: 0, total_pages: 0 })
  const [listPageSize, setListPageSize] = useState<ListPageSize>(150)
  const [totalSites, setTotalSites] = useState(0)
  /** 本地库商品总数（与列表筛选无关）；全量同步会推送全部 db 件 */
  const [dbProductCount, setDbProductCount] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  /** 默认全部状态 */
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterCatalogIn, setFilterCatalogIn] = useState<'0' | '1' | ''>('')
  const [loading, setLoading] = useState(true)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingSelected, setSyncingSelected] = useState(false)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const [selectedSyncSites, setSelectedSyncSites] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [showImport, setShowImport] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [syncProgress, setSyncProgress] = useState<null | { processed: number; total: number; batchIndex: number; batchTotal: number }>(null)
  const [categories, setCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES)
  const [loadError, setLoadError] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const syncMenuRef = useRef<HTMLDivElement>(null)
  const importMenuRef = useRef<HTMLDivElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvWorking, setCsvWorking] = useState(false)
  const [csvValidateOnly, setCsvValidateOnly] = useState(true)

  const parseProductTags = (p: Product): string[] => {
    try {
      const t = p.tags
      if (Array.isArray(t)) return normalizeCatalogTagNames(t)
      if (typeof t === 'string') return normalizeCatalogTagNames(JSON.parse(t || '[]'))
    } catch { /* */ }
    return []
  }

  const loadProducts = async (
    page = 1,
    overrides?: { category?: string; status?: string; tag?: string; catalog_in?: '0' | '1' | ''; page_size?: number },
  ) => {
    setLoading(true)
    setLoadError('')
    const pageSize = (overrides?.page_size !== undefined ? overrides.page_size : listPageSize) as ListPageSize
    try {
      const cat = overrides?.category !== undefined ? overrides.category : filterCategory
      const st = overrides?.status !== undefined ? overrides.status : filterStatus
      const tg = overrides?.tag !== undefined ? overrides.tag : filterTag
      const fc = overrides?.catalog_in !== undefined ? overrides.catalog_in : filterCatalogIn
      const data = await productApi.list({
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
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
      setPagination({ page: 1, page_size: pageSize, total: 0, total_pages: 0 })
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
    const siteNames = selectedSyncSites.map(id => sites.find(s => s.id === id)?.name).filter(Boolean) as string[]
    const siteListStr = formatSiteNamesForUi(siteNames, 4)
    const msg = `将同步本地数据库中的全部 ${totalInDb} 件商品到已选的 ${selectedSyncSites.length} 个站点。\n目标站点：${siteListStr}\n\n此操作与当前列表的搜索/筛选、左侧勾选无关。\n\n若只需推送部分商品，请先取消，改用列表底部「同步选中到站点」（站点范围与此处勾选一致）。单件也可用编辑页「同步至网站」。\n\n确定继续全量同步？`
    if (!confirm(msg)) return
    setShowSyncMenu(false)
    setSyncingAll(true)
    setSyncProgress(null)
    /** 每批件数略小于 Nginx 常见 60s 上限，避免单请求 504（服务端仍支持一次 sync-all） */
    const BATCH_SIZE = 6
    try {
      const { ids } = await productApi.listIds()
      if (ids.length === 0) {
        alert('本地无商品可同步')
        return
      }
      const batchTotal = Math.max(1, Math.ceil(ids.length / BATCH_SIZE))
      let synced = 0
      let failed = 0
      const detailsAccum: Array<{
        product_id: string
        sku: string
        results: SyncResult['results']
        skipped_images?: string[]
      }> = []
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE)
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1
        const processed = Math.min(i + chunk.length, ids.length)
        setSyncProgress({ processed, total: ids.length, batchIndex, batchTotal })
        const result = await productApi.syncBatch(chunk, selectedSyncSites)
        synced += result.synced
        failed += result.failed
        if (result.details?.length) detailsAccum.push(...result.details)
      }
      const withSkips = detailsAccum.filter(d => (d.skipped_images?.length ?? 0) > 0)
      const skipHint =
        withSkips.length > 0
          ? `\n\n${withSkips.length} 件商品有图片因远程不可访问被跳过（其余内容已同步），SKU 示例：${withSkips
              .slice(0, 8)
              .map(d => d.sku)
              .join(', ')}${withSkips.length > 8 ? '…' : ''}`
          : ''
      const failLines = failed > 0 ? summarizeSyncFailures(detailsAccum) : ''
      const outcomeHint =
        failed === 0 ? '全部成功。' : synced === 0 ? '全部失败，请根据下方明细排查。' : '部分成功，请根据下方明细排查失败项。'
      alert(
        `全量同步完成：共 ${ids.length} 件商品参与；按站点计成功 ${synced} 次、失败 ${failed} 次。${outcomeHint}${skipHint}${failLines}`,
      )
      loadProducts(pagination.page)
    } catch (err: any) {
      const raw = err?.message ?? String(err)
      const short =
        raw.includes('504') || raw.includes('Gateway Time-out') || raw.includes('timeout')
          ? GATEWAY_TIMEOUT_HINT
          : raw
      alert(`同步失败：${short}`)
    } finally {
      setSyncingAll(false)
      setSyncProgress(null)
    }
  }

  /** 仅同步列表勾选的 id；站点优先用顶部「同步全部」菜单里已勾的站点，否则推送到全部已配置站点 */
  const handleSyncSelected = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const siteIdsForSync =
      selectedSyncSites.length > 0 ? selectedSyncSites : sites.map(s => s.id)
    if (siteIdsForSync.length === 0) {
      alert('请先在「站点设置」中添加至少一个 WooCommerce 站点。')
      return
    }
    const siteNames =
      selectedSyncSites.length > 0
        ? (selectedSyncSites.map(id => sites.find(s => s.id === id)?.name).filter(Boolean) as string[])
        : sites.map(s => s.name)
    const siteListStr = formatSiteNamesForUi(siteNames, 4)
    const siteNote =
      selectedSyncSites.length > 0
        ? `目标站点（与右上角同步菜单勾选一致）：${siteListStr}`
        : `未在右上角勾选站点，将推送到全部已配置站点：${siteListStr}`
    const msg = `将同步列表中勾选的 ${ids.length} 件商品到 Woo。\n${siteNote}\n\n全量同步与列表勾选无关；仅本次勾选的商品会被推送。\n\n确定继续？`
    if (!confirm(msg)) return
    setSyncingSelected(true)
    setSyncProgress(null)
    const BATCH_SIZE = 6
    try {
      const batchTotal = Math.max(1, Math.ceil(ids.length / BATCH_SIZE))
      let synced = 0
      let failed = 0
      const detailsAccum: Array<{
        product_id: string
        sku: string
        results: SyncResult['results']
        skipped_images?: string[]
      }> = []
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE)
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1
        const processed = Math.min(i + chunk.length, ids.length)
        setSyncProgress({ processed, total: ids.length, batchIndex, batchTotal })
        const result = await productApi.syncBatch(chunk, siteIdsForSync)
        synced += result.synced
        failed += result.failed
        if (result.details?.length) detailsAccum.push(...result.details)
      }
      const withSkips = detailsAccum.filter(d => (d.skipped_images?.length ?? 0) > 0)
      const skipHint =
        withSkips.length > 0
          ? `\n\n${withSkips.length} 件商品有图片因远程不可访问被跳过（其余内容已同步），SKU 示例：${withSkips
              .slice(0, 8)
              .map(d => d.sku)
              .join(', ')}${withSkips.length > 8 ? '…' : ''}`
          : ''
      const failLines = failed > 0 ? summarizeSyncFailures(detailsAccum) : ''
      const outcomeHint =
        failed === 0 ? '全部成功。' : synced === 0 ? '全部失败，请根据下方明细排查。' : '部分成功，请根据下方明细排查失败项。'
      alert(
        `选中商品同步完成：共 ${ids.length} 件参与；按站点计成功 ${synced} 次、失败 ${failed} 次。${outcomeHint}${skipHint}${failLines}`,
      )
      setSelectedIds(new Set())
      loadProducts(pagination.page)
    } catch (err: any) {
      const raw = err?.message ?? String(err)
      const short =
        raw.includes('504') || raw.includes('Gateway Time-out') || raw.includes('timeout')
          ? GATEWAY_TIMEOUT_HINT
          : raw
      alert(`同步失败：${short}`)
    } finally {
      setSyncingSelected(false)
      setSyncProgress(null)
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

  const handleDownloadCsvTemplate = async () => {
    try {
      const blob = await productApi.downloadCsvTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'products-import-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '下载失败'
      alert(msg)
    }
  }

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setCsvWorking(true)
    try {
      const r = await productApi.importCsv(f, csvValidateOnly)
      const head = csvValidateOnly ? '[仅校验]' : '[已写入]'
      let msg = `${head} 数据行 ${r.total_data_rows}：将新建/已新建 ${r.created}，将更新/已更新 ${r.updated}，失败 ${r.failed.length}`
      if (r.failed.length > 0) {
        const lines = r.failed.slice(0, 20).map(x => `第 ${x.row} 行 ${x.sku || '(无SKU)'}：${x.error}`)
        msg += `\n\n${lines.join('\n')}`
        if (r.failed.length > 20) msg += `\n… 另有 ${r.failed.length - 20} 条`
      }
      alert(msg)
      if (!csvValidateOnly && (r.created > 0 || r.updated > 0)) {
        loadProducts(pagination.page)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '导入失败')
    } finally {
      setCsvWorking(false)
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

  const cellClass = 'cursor-pointer hover:bg-primary-muted/50 rounded px-1 -mx-1 transition-colors'
  const colSpanCount = 11
  const selectionBusy = syncingAll || syncingSelected || batchUpdating
  const selectedOnPage = useMemo(
    () => products.filter(p => selectedIds.has(p.id)).length,
    [products, selectedIds],
  )
  const selectedOnOtherPages = Math.max(0, selectedIds.size - selectedOnPage)
  const syncBarSiteLine = useMemo(() => {
    const names =
      selectedSyncSites.length > 0
        ? (selectedSyncSites.map(id => sites.find(s => s.id === id)?.name).filter(Boolean) as string[])
        : sites.map(s => s.name)
    return formatSiteNamesForUi(names, 3)
  }, [selectedSyncSites, sites])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center">
          <textarea
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            rows={2}
            title="多个 SKU：用英文逗号、分号或换行分隔，仅按本地 SKU 与供应商编码匹配。仅一段时：可按名称、分类、SKU、供应商编码模糊搜。"
            placeholder="VC279, LY888 或每行一个；单段可搜名称/分类/SKU"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-64 min-w-[12rem] min-h-[2.75rem] resize-y font-mono align-top"
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
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">每页显示</span>
            <select
              value={listPageSize}
              disabled={selectionBusy || loading}
              title="每页条数"
              onChange={e => {
                const n = Number(e.target.value) as ListPageSize
                setListPageSize(n)
                void loadProducts(1, { page_size: n })
              }}
              className="min-w-[5.5rem] rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {LIST_PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}条</option>
              ))}
            </select>
          </label>
          <button type="submit" className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">搜索</button>
        </form>
        <div className="flex gap-2">
          <div className="relative" ref={importMenuRef}>
            <button
              type="button"
              onClick={() => setShowImport(!showImport)}
              disabled={pulling || sites.length === 0 || selectionBusy}
              title={selectionBusy ? '同步或批量操作中，请稍候' : undefined}
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
              disabled={selectionBusy || dbProductCount === 0}
              title={dbProductCount > 0 ? `全量同步：本地全部 ${dbProductCount} 件（与搜索/筛选/列表勾选无关）。列表底部「同步选中」使用此处勾选的站点；未勾选任何站点时，选中同步会推到全部站点。` : '本地无商品可同步'}
              className="rounded-md border border-primary-border px-4 py-2 text-sm text-primary hover:bg-primary-muted disabled:opacity-50"
            >
              {syncingAll
                ? (syncProgress ? `同步中 ${syncProgress.processed}/${syncProgress.total} 件` : '同步中...')
                : '同步全部到站点'}
            </button>
            {showSyncMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[240px] max-w-[min(100vw-1rem,20rem)]">
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">
                  全量同步（本地约 {dbProductCount || '—'} 件，与筛选/勾选无关）
                </p>
                <p className="px-3 py-2 text-[11px] leading-snug text-slate-500 border-b border-slate-100 bg-slate-50/80">
                  此处勾选的站点同样用于列表底部「同步选中到站点」。若此处未勾选任何站点，选中同步将推送到全部已配置站点。
                </p>
                {sites.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedSyncSites.includes(s.id)}
                      onChange={() => toggleSyncSite(s.id)}
                      disabled={selectionBusy}
                      className="rounded border-slate-300"
                    />
                    {s.name}
                  </label>
                ))}
                <div className="px-3 py-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => void handleSyncAll()}
                    disabled={selectedSyncSites.length === 0 || selectionBusy}
                    className="w-full rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    确认全量同步（{selectedSyncSites.length} 个站点）
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50/80">
            <span className="text-xs text-slate-500 px-1">CSV</span>
            <button
              type="button"
              onClick={() => void handleDownloadCsvTemplate()}
              disabled={csvWorking || selectionBusy}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
              title="下载 UTF-8 模板（含全部列）"
            >
              下载模板
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={csvValidateOnly}
                onChange={e => setCsvValidateOnly(e.target.checked)}
                disabled={csvWorking}
                className="rounded border-slate-300"
              />
              仅校验
            </label>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => void handleCsvFileChange(e)}
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={csvWorking || selectionBusy}
              className="px-3 py-1.5 text-sm border border-primary-border text-primary rounded-md hover:bg-primary-muted disabled:opacity-50"
              title="以 SKU 匹配：无则新建，有则更新（不修改 SKU）；空单元格表示不修改该字段（新建除外 name 必填）"
            >
              {csvWorking ? '处理中…' : '上传 CSV'}
            </button>
          </div>
          <button
            onClick={() => navigate('/products/new')}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
          >
            新建产品
          </button>
        </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {loadError}
        </div>
      ) : null}

      {(syncingAll || syncingSelected) && syncProgress ? (
        <div
          className="rounded-lg border border-primary-border/60 bg-primary-muted/25 px-4 py-2.5 text-sm text-slate-800"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-primary">同步进行中</span>
          <span className="text-slate-600">
            {' '}
            — 第 {syncProgress.batchIndex}/{syncProgress.batchTotal} 批，已处理商品 {syncProgress.processed}/{syncProgress.total} 件（关闭页面可能中断请求）
          </span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleSelectAll()}
                  disabled={selectionBusy}
                  title={selectionBusy ? '同步或批量操作中，请稍候' : '全选本页'}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="w-14 px-4 py-3 text-left text-xs font-semibold text-slate-600">图片</th>
              <th className="w-20 px-4 py-3 text-left text-xs font-semibold text-slate-600">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">名称</th>
              <th className="w-24 px-4 py-3 text-right text-xs font-semibold text-slate-600">售价</th>
              <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-slate-600">分类</th>
              <th className="w-20 px-4 py-3 text-left text-xs font-semibold text-slate-600">状态</th>
              <th
                className="w-20 px-4 py-3 text-center text-xs font-semibold text-slate-600"
                title="需有 for him / for her 标签才可进图册"
              >
                进图册
              </th>
              <th className="w-20 px-4 py-3 text-left text-xs font-semibold text-slate-600">同步</th>
              <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600">供应商编码</th>
              <th className="w-24 px-4 py-3 text-right text-xs font-semibold text-slate-600">操作</th>
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
                      disabled={selectionBusy}
                      title={selectionBusy ? '同步或批量操作中，请稍候' : undefined}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {img ? <img src={img} alt="" className="w-8 h-8 object-cover rounded border border-slate-200" />
                      : <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-300 text-[10px]">N/A</div>}
                  </td>
                  <td className="px-4 py-2 font-sku text-slate-500 text-xs">{p.sku}</td>

                  {/* 名称 - clickable to edit */}
                  <td className="px-4 py-2 max-w-[280px]">
                    {isEditing(p.id, 'name') ? (
                      <input
                        ref={inputRef as any}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => void saveCell()}
                        onKeyDown={handleCellKeyDown}
                        className="w-full rounded border border-primary-border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                        className="w-full rounded border border-primary-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                        className="w-full rounded border border-primary-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <button onClick={e => { e.stopPropagation(); navigate(`/products/${p.id}/edit`) }} className="mr-2 text-primary hover:text-primary-hover">编辑</button>
                    <button onClick={e => handleDelete(p.id, e)} className="text-red-500 hover:text-red-700">删除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
          <span>
            共 {pagination.total} 条
            {selectedIds.size > 0 && selectedOnOtherPages > 0 ? (
              <span className="text-slate-600"> · 当前勾选含其他页 {selectedOnOtherPages} 项，翻页不会清空勾选</span>
            ) : null}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || selectionBusy}
              title={selectionBusy ? '同步或批量操作中，请稍候' : undefined}
              onClick={() => loadProducts(pagination.page - 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-3 py-1">{pagination.page} / {pagination.total_pages}</span>
            <button
              type="button"
              disabled={pagination.page >= pagination.total_pages || selectionBusy}
              title={selectionBusy ? '同步或批量操作中，请稍候' : undefined}
              onClick={() => loadProducts(pagination.page + 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-lg px-6 py-3 flex flex-wrap items-center gap-3 z-50 max-w-[min(100vw-2rem,56rem)]">
          <div className="flex flex-col gap-0.5 min-w-0 basis-full sm:basis-auto sm:max-w-[14rem] md:max-w-xs">
            <span className="text-sm text-slate-700">
              已选 {selectedIds.size} 项
              {selectedOnOtherPages > 0 ? (
                <span className="text-slate-500 font-normal">（本页 {selectedOnPage}，其他页 {selectedOnOtherPages}）</span>
              ) : null}
            </span>
            <span
              className="text-xs text-slate-500 leading-snug line-clamp-2"
              title={`目标站点：${syncBarSiteLine}`}
            >
              目标站点：{syncBarSiteLine}
              <span className="text-slate-400">
                {selectedSyncSites.length > 0 ? ' · 与右上角菜单一致' : ' · 菜单未勾选时推全部'}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSyncSelected()}
            disabled={batchUpdating || selectionBusy || sites.length === 0}
            title={
              selectedSyncSites.length > 0
                ? `推送到已勾选的 ${selectedSyncSites.length} 个站点（与右上角同步菜单一致）`
                : '未在右上角勾选站点时，将推送到全部已配置站点'
            }
            className="px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {syncingSelected
              ? (syncProgress ? `同步中 ${syncProgress.processed}/${syncProgress.total} 件` : '同步中...')
              : '同步选中到站点'}
          </button>
          <button
            onClick={() => handleBatchStatus(1)}
            disabled={batchUpdating || selectionBusy}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            设为 Active
          </button>
          <button
            onClick={() => handleBatchStatus(0)}
            disabled={batchUpdating || selectionBusy}
            className="px-4 py-1.5 text-sm bg-slate-500 text-white rounded hover:bg-slate-600 disabled:opacity-50"
          >
            设为 Draft
          </button>
          <button
            onClick={() => handleBatchCatalog(1)}
            disabled={batchUpdating || selectionBusy}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            title="需有 for him / for her 标签；无标签的行会失败并提示"
          >
            加入进图册
          </button>
          <button
            onClick={() => handleBatchCatalog(0)}
            disabled={batchUpdating || selectionBusy}
            className="px-4 py-1.5 text-sm border border-amber-200 text-amber-800 rounded hover:bg-amber-50 disabled:opacity-50"
          >
            移出进图册
          </button>
          <button
            type="button"
            onClick={() => void handleBatchDelete()}
            disabled={batchUpdating || selectionBusy}
            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            批量删除
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectionBusy}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
