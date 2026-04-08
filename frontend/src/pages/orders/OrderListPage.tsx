import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderApi, siteApi } from '../../services/app-services'
import type { Order, Pagination, Site } from '../../services/types'

const STATUS_LABELS: Record<string, string> = {
  'pending': 'Pending',
  'processing': 'Processing',
  'on-hold': 'On Hold',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'failed': 'Failed',
}

export function OrderListPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: 20, total: 0, total_pages: 0 })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState({ site_id: '', status: '', keyword: '' })
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)

  const loadOrders = async (page = 1) => {
    setLoading(true)
    try {
      const data = await orderApi.list({
        site_id: filters.site_id || undefined,
        status: filters.status || undefined,
        keyword: filters.keyword || undefined,
        page,
        page_size: 20,
      })
      setOrders(data.items)
      setPagination(data.pagination)
      setStatusCounts(data.status_counts || {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    siteApi.list().then(setSites)
    loadOrders()
  }, [])

  const handlePull = async () => {
    setPulling(true)
    try {
      const result = await orderApi.pull()
      const summary = result.results.map(r =>
        r.error ? `${r.site_name}: Failed (${r.error})` : `${r.site_name}: Pulled ${r.pulled} orders`
      ).join('\n')
      alert(summary)
      loadOrders()
    } catch (err: any) {
      alert(`Pull failed: ${err.message}`)
    } finally {
      setPulling(false)
    }
  }

  const handleFilter = () => loadOrders(1)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filters.site_id}
            onChange={e => setFilters(f => ({ ...f, site_id: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            value={filters.keyword}
            onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
            placeholder="Search order # / customer"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-52"
          />
          <button onClick={handleFilter} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">
            Filter
          </button>
        </div>
        <button
          onClick={handlePull}
          disabled={pulling}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pulling ? 'Pulling...' : 'Pull Orders'}
        </button>
        </div>
      </div>

      {statusCounts.all > 0 && (
        <div className="flex gap-3 text-sm">
          <span className="text-slate-500">All {statusCounts.all || 0}</span>
          {Object.entries(STATUS_LABELS).map(([k, v]) =>
            statusCounts[k] ? <span key={k} className="text-slate-500">{v} {statusCounts[k]}</span> : null
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Order #</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Site</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No orders yet. Click "Pull Orders" to sync from your sites.</td></tr>
            ) : (
              orders.map(o => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-slate-700">#{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-500">{o.site_name}</td>
                  <td className="px-4 py-3 text-slate-900">{o.customer_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.status === 'completed' ? 'bg-green-100 text-green-700' :
                      o.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      o.status === 'cancelled' || o.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{o.currency} {o.total}</td>
                  <td className="px-4 py-3 text-slate-400">{o.date_created ? new Date(o.date_created).toLocaleDateString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{pagination.total} orders</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => loadOrders(pagination.page - 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1">{pagination.page} / {pagination.total_pages}</span>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => loadOrders(pagination.page + 1)}
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
