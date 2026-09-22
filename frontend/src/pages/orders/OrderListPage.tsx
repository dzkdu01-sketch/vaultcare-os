import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderApi, siteApi, distributorApi } from '../../services/app-services'
import { getSessionUser } from '../../app/store/auth-store'
import type { ExtendedOrder, Pagination, Site, Distributor } from '../../services/types'

const DELIVERY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_submitted: { label: '待处理', color: 'bg-red-100 text-red-700' },
  submitted: { label: '已录入', color: 'bg-orange-100 text-orange-700' },
  delivery_exception: { label: '派送异常', color: 'bg-yellow-100 text-yellow-700' },
  settled: { label: '已发货', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-teal-100 text-teal-700' },
}

function parseSkus(lineItemsRaw: any): string {
  try {
    const items = typeof lineItemsRaw === 'string' ? JSON.parse(lineItemsRaw || '[]') : (lineItemsRaw || [])
    const skus = items.map((i: any) => i.sku).filter(Boolean)
    return skus.length > 0 ? skus.join(', ') : '-'
  } catch { return '-' }
}

function formatDate(d: string | undefined): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  const h = String(dt.getHours()).padStart(2, '0')
  const min = String(dt.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${day} ${h}:${min}`
}

function sourceLabel(source: string | undefined): string {
  if (source === 'manual') return '手动'
  if (source === 'woo_webhook') return 'Woo · Webhook'
  if (source === 'woo_api') return 'Woo · 同步'
  if (source && source.startsWith('woo')) return 'Woo'
  return '-'
}

function sourceBadgeClass(source: string | undefined): string {
  if (source === 'manual') return 'bg-blue-100 text-blue-700'
  if (source === 'woo_webhook') return 'bg-violet-100 text-violet-700'
  if (source === 'woo_api') return 'bg-purple-100 text-purple-700'
  return 'bg-purple-100 text-purple-700'
}

/** 列表「分销商」列：优先名称，并与 code 区分展示，避免空名称时整列像「只有号码」 */
function formatDistributorCell(o: ExtendedOrder): string {
  const name = (o.distributor_name || '').trim()
  const code = (o.distributor_code || '').trim()
  if (!name && !code) return '—'
  if (name && code && name !== code) return `${name} (${code})`
  return name || code
}

export function OrderListPage() {
  const navigate = useNavigate()
  const user = getSessionUser()
  const isOp = user?.role === 'operator'
  /** 仅通过「拉取订单」按钮拉 Woo，进页不自动 pull */
  const canManualPull = user?.role === 'operator' || user?.role === 'distributor'

  const [orders, setOrders] = useState<ExtendedOrder[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: 50, total: 0, total_pages: 0 })
  const [orderStatusCounts, setOrderStatusCounts] = useState<Record<string, number>>({})
  const [deliveryStatusCounts, setDeliveryStatusCounts] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState({
    site_id: '', keyword: '', order_status: '', delivery_status: '', distributor_id: '',
  })
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  const loadOrders = async (page = 1) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const data = await orderApi.list({
        site_id: filters.site_id || undefined,
        keyword: filters.keyword || undefined,
        page,
        page_size: 50,
        order_status: filters.order_status || undefined,
        delivery_status: filters.delivery_status || undefined,
        distributor_id: filters.distributor_id || undefined,
      })
      setOrders(data.items)
      setPagination(data.pagination)
      setOrderStatusCounts(data.order_status_counts || {})
      setDeliveryStatusCounts(data.delivery_status_counts || {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    siteApi.list().then(setSites).catch(() => {})
    if (isOp) distributorApi.list().then(setDistributors).catch(() => {})
    void loadOrders(1)
  }, [])

  const handlePull = async () => {
    setPulling(true)
    try {
      const result = await orderApi.pull()
      const summary = result.results.map(r =>
        r.error
          ? `${r.site_name}: 失败 (${r.error})`
          : `${r.site_name}: 新增 ${r.pulled}，更新 ${r.updated ?? 0}`
      ).join('\n')
      alert(summary)
      void loadOrders(pagination.page)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`拉取失败: ${msg}`)
    } finally {
      setPulling(false)
    }
  }

  const handleFilter = () => loadOrders(1)

  const confirmableOrders = orders.filter(o => o.order_status === 'unconfirmed' && o.delivery_status === 'not_submitted')
  const showCheckboxCol = confirmableOrders.length > 0
  const selectedConfirmable = orders.filter(
    o => selected.has(o.id) && o.order_status === 'unconfirmed' && o.delivery_status === 'not_submitted',
  )

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === confirmableOrders.length) setSelected(new Set())
    else setSelected(new Set(confirmableOrders.map(o => o.id)))
  }
  const handleBatchConfirm = async () => {
    if (selectedConfirmable.length === 0) return
    if (!confirm(`确认将 ${selectedConfirmable.length} 个订单标记为"客户已确认"？`)) return
    setBatchLoading(true)
    let ok = 0, fail = 0
    for (const o of selectedConfirmable) {
      try { await orderApi.updateOrderStatus(o.id, 'customer_confirmed'); ok++ }
      catch { fail++ }
    }
    setBatchLoading(false)
    alert(`成功确认 ${ok} 个${fail > 0 ? `，失败 ${fail} 个` : ''}`)
    loadOrders(pagination.page)
  }

  const handleExport = () => {
    const header = isOp
      ? ['Order number', '分销商', '网站名称', 'WhatsApp', '商品编号', '状态', 'Total', '来源', '日期']
      : ['Order number', 'WhatsApp', '商品编号', '状态', 'Total', '网站名称', '来源', '日期']
    const rows = orders.map(o =>
      isOp
        ? [
            o.website_order_number || o.order_number,
            formatDistributorCell(o),
            o.site_name || '-',
            o.customer_whatsapp || '',
            parseSkus(o.line_items),
            DELIVERY_STATUS_LABELS[o.delivery_status || '']?.label || '',
            `${o.currency || 'AED'} ${o.total}`,
            sourceLabel(o.source),
            formatDate(o.date_created),
          ]
        : [
            o.website_order_number || o.order_number,
            o.customer_whatsapp || '',
            parseSkus(o.line_items),
            DELIVERY_STATUS_LABELS[o.delivery_status || '']?.label || '',
            `${o.currency || 'AED'} ${o.total}`,
            o.site_name || '-',
            sourceLabel(o.source),
            formatDate(o.date_created),
          ],
    )
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const dataColCount = 8 + (isOp ? 1 : 0)
  const tableColSpan = dataColCount + (showCheckboxCol ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            {isOp && distributors.length > 0 && (
              <select value={filters.distributor_id} onChange={e => setFilters(f => ({ ...f, distributor_id: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">全部分销商</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            )}
            <select value={filters.delivery_status} onChange={e => setFilters(f => ({ ...f, delivery_status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="">全部状态</option>
              {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input value={filters.keyword} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleFilter()}
              placeholder="订单号、客户、WhatsApp、SKU、商品名"
              title="支持：订单号、客户姓名/电话、WhatsApp、行内商品 SKU 与名称关键词"
              className="px-3 py-2 border border-slate-300 rounded-md text-sm w-72 max-w-[min(18rem,100%)]" />
            <button onClick={handleFilter} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">筛选</button>
          </div>
          <div className="flex gap-2">
            {selectedConfirmable.length > 0 && (
              <button type="button" onClick={handleBatchConfirm} disabled={batchLoading}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50">
                {batchLoading ? '处理中...' : `批量确认 (${selectedConfirmable.length})`}
              </button>
            )}
            <button onClick={handleExport} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">导出</button>
            {canManualPull && (
              <button type="button" onClick={handlePull} disabled={pulling}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">
                {pulling ? '拉取中...' : '拉取订单'}
              </button>
            )}
            <button onClick={() => navigate('/orders/new')}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">+ 新建订单</button>
          </div>
        </div>
      </div>

      {/* Status counts */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-slate-500">全部 {orderStatusCounts.all || 0}</span>
        <span className="text-slate-300">|</span>
        {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) =>
          deliveryStatusCounts[k] ? <span key={k} className="text-slate-500">{v.label} {deliveryStatusCounts[k]}</span> : null
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {showCheckboxCol && (
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={selected.size > 0 && selected.size === confirmableOrders.length}
                    onChange={toggleAll} className="accent-primary" />
                </th>
              )}
              <th className="text-left px-4 py-3 font-medium text-slate-600">Order number</th>
              {isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">分销商</th>}
              {isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">网站名称</th>}
              <th className="text-left px-4 py-3 font-medium text-slate-600">WhatsApp</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">商品编号</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">状态</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              {!isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">网站名称</th>}
              <th className="text-left px-4 py-3 font-medium text-slate-600">来源</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">日期</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tableColSpan} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={tableColSpan} className="px-4 py-12 text-center">
                <div className="text-slate-400 mb-3">暂无订单</div>
              </td></tr>
            ) : orders.map(o => {
              const isConfirmable = o.order_status === 'unconfirmed' && o.delivery_status === 'not_submitted'
              const rowSelectable = isOp || isConfirmable
              return (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  {showCheckboxCol && (
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      {rowSelectable && (
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="accent-primary" />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-slate-700">{o.website_order_number || o.order_number}</td>
                  {isOp && <td className="px-4 py-3 text-slate-500">{formatDistributorCell(o)}</td>}
                  {isOp && (
                    <td className="px-4 py-3 text-slate-500 max-w-[10rem] truncate" title={o.site_name || ''}>
                      {o.site_name || (o.source === 'manual' ? '—' : '-')}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500" onClick={e => e.stopPropagation()}>
                    {o.customer_whatsapp ? (
                      <span className="inline-flex items-center gap-2">
                        <span>{o.customer_whatsapp}</span>
                        <button type="button" className="text-xs text-primary" onClick={() => void navigator.clipboard.writeText(o.customer_whatsapp)}>复制</button>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-40 truncate" title={parseSkus(o.line_items)}>
                    {parseSkus(o.line_items)}
                  </td>
                  <td className="px-4 py-3">
                    {o.delivery_status && DELIVERY_STATUS_LABELS[o.delivery_status] ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DELIVERY_STATUS_LABELS[o.delivery_status].color}`}>
                        {DELIVERY_STATUS_LABELS[o.delivery_status].label}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{o.currency || 'AED'} {o.total}</td>
                  {!isOp && (
                    <td className="px-4 py-3 text-slate-500 max-w-[10rem] truncate" title={o.site_name || ''}>
                      {o.site_name || (o.source === 'manual' ? '—' : '-')}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${sourceBadgeClass(o.source)}`}>
                      {sourceLabel(o.source)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(o.date_created)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{pagination.total} 个订单</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => loadOrders(pagination.page - 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">上一页</button>
            <span className="px-3 py-1">{pagination.page} / {pagination.total_pages}</span>
            <button disabled={pagination.page >= pagination.total_pages} onClick={() => loadOrders(pagination.page + 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
