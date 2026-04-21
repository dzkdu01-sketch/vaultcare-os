import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderApi, siteApi, distributorApi } from '../../services/app-services'
import { getSessionUser } from '../../app/store/auth-store'
import type { ExtendedOrder, Pagination, Site, Distributor } from '../../services/types'

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unconfirmed: { label: '未确认', color: 'bg-red-100 text-red-700' },
  customer_confirmed: { label: '客户已确认', color: 'bg-orange-100 text-orange-700' },
}

const DELIVERY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_submitted: { label: '未提交', color: 'bg-red-100 text-red-700' },
  submitted: { label: '已提交', color: 'bg-orange-100 text-orange-700' },
  delivery_exception: { label: '派送异常', color: 'bg-yellow-100 text-yellow-700' },
  settled: { label: '结算', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '取消', color: 'bg-teal-100 text-teal-700' },
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
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
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
  const [batchDeleting, setBatchDeleting] = useState(false)

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
    loadOrders()
  }, [])

  const handlePull = async () => {
    setPulling(true)
    try {
      const result = await orderApi.pull()
      const summary = result.results.map(r =>
        r.error ? `${r.site_name}: 失败 (${r.error})` : `${r.site_name}: 拉取 ${r.pulled} 个订单`
      ).join('\n')
      alert(summary)
      loadOrders()
    } catch (err: any) {
      alert(`拉取失败: ${err.message}`)
    } finally {
      setPulling(false)
    }
  }

  const handleFilter = () => loadOrders(1)

  const confirmableOrders = orders.filter(o => o.order_status === 'unconfirmed' && o.delivery_status === 'not_submitted')
  const pageOrderIds = orders.map(o => o.id)
  /** 操作员：整页可勾选（批量删除）；分销商：仅可确认单 */
  const showCheckboxCol = isOp || confirmableOrders.length > 0
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
    if (isOp) {
      if (pageOrderIds.length > 0 && pageOrderIds.every(i => selected.has(i))) setSelected(new Set())
      else setSelected(new Set(pageOrderIds))
      return
    }
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

  const handleBatchDelete = async () => {
    if (!isOp || selected.size === 0) return
    if (!confirm(`确定删除已选中的 ${selected.size} 个订单？此操作不可恢复。`)) return
    setBatchDeleting(true)
    try {
      const { deleted } = await orderApi.batchDelete([...selected])
      alert(`已删除 ${deleted} 个订单`)
      loadOrders(pagination.page)
    } catch (e: any) {
      alert(e?.message || '删除失败')
    } finally {
      setBatchDeleting(false)
    }
  }

  const handleRowDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定删除该订单？不可恢复。')) return
    try {
      await orderApi.remove(id)
      loadOrders(pagination.page)
    } catch (err: any) {
      alert(err?.message || '删除失败')
    }
  }

  const handleExport = () => {
    const header = isOp
      ? ['Order number', '分销商', '网站名称', 'WhatsApp', '商品编号', 'Order status', '出库状态', 'Total', '来源', '日期']
      : ['Order number', 'WhatsApp', '商品编号', 'Order status', '出库状态', 'Total', '网站名称', '来源', '日期']
    const rows = orders.map(o =>
      isOp
        ? [
            o.order_number,
            formatDistributorCell(o),
            o.site_name || '-',
            o.customer_whatsapp || '',
            parseSkus(o.line_items),
            ORDER_STATUS_LABELS[o.order_status || '']?.label || '',
            DELIVERY_STATUS_LABELS[o.delivery_status || '']?.label || '',
            `${o.currency || 'AED'} ${o.total}`,
            sourceLabel(o.source),
            o.date_created ? new Date(o.date_created).toLocaleDateString() : '',
          ]
        : [
            o.order_number,
            o.customer_whatsapp || '',
            parseSkus(o.line_items),
            ORDER_STATUS_LABELS[o.order_status || '']?.label || '',
            DELIVERY_STATUS_LABELS[o.delivery_status || '']?.label || '',
            `${o.currency || 'AED'} ${o.total}`,
            o.site_name || '-',
            sourceLabel(o.source),
            o.date_created ? new Date(o.date_created).toLocaleDateString() : '',
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

  const dataColCount = 9 + (isOp ? 1 : 0)
  const tableColSpan = dataColCount + (showCheckboxCol ? 1 : 0) + (isOp ? 1 : 0)

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
            <select value={filters.order_status} onChange={e => setFilters(f => ({ ...f, order_status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="">全部确认状态</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filters.delivery_status} onChange={e => setFilters(f => ({ ...f, delivery_status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="">全部出库状态</option>
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
            {isOp && selected.size > 0 && (
              <button type="button" onClick={handleBatchDelete} disabled={batchDeleting}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
                {batchDeleting ? '删除中...' : `批量删除 (${selected.size})`}
              </button>
            )}
            {selectedConfirmable.length > 0 && (
              <button type="button" onClick={handleBatchConfirm} disabled={batchLoading}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50">
                {batchLoading ? '处理中...' : `批量确认 (${selectedConfirmable.length})`}
              </button>
            )}
            <button onClick={handleExport} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">导出</button>
            <button onClick={() => navigate('/orders/new')}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">+ 新建订单</button>
            {isOp && (
              <button onClick={handlePull} disabled={pulling}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">
                {pulling ? '拉取中...' : '拉取订单'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status counts */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-slate-500">全部 {orderStatusCounts.all || 0}</span>
        {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) =>
          orderStatusCounts[k] ? <span key={k} className="text-slate-500">{v.label} {orderStatusCounts[k]}</span> : null
        )}
        <span className="text-slate-300">|</span>
        {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) =>
          deliveryStatusCounts[k] ? <span key={k} className="text-slate-500">{v.label} {deliveryStatusCounts[k]}</span> : null
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {showCheckboxCol && (
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={isOp
                      ? pageOrderIds.length > 0 && pageOrderIds.every(id => selected.has(id))
                      : selected.size > 0 && selected.size === confirmableOrders.length}
                    onChange={toggleAll} className="accent-primary" />
                </th>
              )}
              <th className="text-left px-4 py-3 font-medium text-slate-600">Order number</th>
              {isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">分销商</th>}
              {isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">网站名称</th>}
              <th className="text-left px-4 py-3 font-medium text-slate-600">WhatsApp</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">商品编号</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Order status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">出库状态</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              {!isOp && <th className="text-left px-4 py-3 font-medium text-slate-600">网站名称</th>}
              <th className="text-left px-4 py-3 font-medium text-slate-600">来源</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">日期</th>
              {isOp && <th className="text-right px-4 py-3 font-medium text-slate-600 w-24">操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tableColSpan} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={tableColSpan} className="px-4 py-12 text-center">
                <div className="text-slate-400 mb-3">暂无订单</div>
                <button onClick={() => navigate('/orders/new')}
                  className="text-primary hover:text-primary-hover text-sm font-medium">点击这里创建第一个订单 →</button>
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
                  <td className="px-4 py-3 font-mono text-slate-700">{o.order_number}</td>
                  {isOp && <td className="px-4 py-3 text-slate-500">{formatDistributorCell(o)}</td>}
                  {isOp && (
                    <td className="px-4 py-3 text-slate-500 max-w-[10rem] truncate" title={o.site_name || ''}>
                      {o.site_name || (o.source === 'manual' ? '—' : '-')}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{o.customer_whatsapp || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-40 truncate" title={parseSkus(o.line_items)}>
                    {parseSkus(o.line_items)}
                  </td>
                  <td className="px-4 py-3">
                    {o.order_status && ORDER_STATUS_LABELS[o.order_status] ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_LABELS[o.order_status].color}`}>
                        {ORDER_STATUS_LABELS[o.order_status].label}
                      </span>
                    ) : '-'}
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
                  {isOp && (
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button type="button"
                        className="text-xs text-red-600 hover:text-red-800 underline-offset-2 hover:underline"
                        onClick={e => handleRowDelete(e, o.id)}>
                        删除
                      </button>
                    </td>
                  )}
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
