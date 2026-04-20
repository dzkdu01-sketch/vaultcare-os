import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { orderApi } from '../../services/app-services'
import { getSessionUser } from '../../app/store/auth-store'
import type { ExtendedOrder } from '../../services/types'

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

const ALL_STATUS: Record<string, string> = {
  unconfirmed: '未确认', customer_confirmed: '客户已确认',
  not_submitted: '未提交', submitted: '已提交',
  delivery_exception: '派送异常', settled: '结算', cancelled: '取消',
}

function translateStatus(val: string | null): string {
  if (!val) return '-'
  return ALL_STATUS[val] || val
}

function translateChangedBy(val: string): string {
  const [role, id] = val.split(':')
  const roleName = role === 'operator' ? '操作员' : role === 'distributor' ? '分销商' : '系统'
  return id ? `${roleName}#${id}` : roleName
}

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = getSessionUser()
  const isOp = user?.role === 'operator'

  const [order, setOrder] = useState<ExtendedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const loadOrder = () => {
    if (!id) { setOrder(null); setLoading(false); return }
    setLoading(true)
    orderApi.getById(id)
      .then(data => { setOrder(data); setLoading(false) })
      .catch(() => { setOrder(null); setLoading(false) })
  }

  useEffect(() => { loadOrder() }, [id])

  const handleConfirmOrder = async () => {
    if (!order) return
    setActionLoading(true)
    try { await orderApi.updateOrderStatus(order.id, 'customer_confirmed'); loadOrder() }
    catch (err: any) { alert(err.message) }
    finally { setActionLoading(false) }
  }

  const handleDeliveryStatusChange = async (newStatus: string) => {
    if (!order) return
    if (newStatus === 'cancelled') {
      const reason = prompt('确定要取消此订单吗？请输入取消原因（可选）：')
      if (reason === null) return
      setActionLoading(true)
      try { await orderApi.updateDeliveryStatus(order.id, newStatus, reason || undefined); loadOrder() }
      catch (err: any) { alert(err.message) }
      finally { setActionLoading(false) }
      return
    }
    setActionLoading(true)
    try { await orderApi.updateDeliveryStatus(order.id, newStatus); loadOrder() }
    catch (err: any) { alert(err.message) }
    finally { setActionLoading(false) }
  }

  if (loading) return <div className="p-6 text-slate-500">加载中...</div>
  if (!order) return <div className="p-6 text-slate-500">订单不存在</div>

  const lineItems = typeof order.line_items === 'string' ? JSON.parse(order.line_items || '[]') : (order.line_items || [])
  const isLocked = order.delivery_status && order.delivery_status !== 'not_submitted'
  const canEdit = !isLocked
  const canConfirm = order.order_status === 'unconfirmed' && !isLocked
  const canSubmit = isOp && order.order_status === 'customer_confirmed' && order.delivery_status === 'not_submitted'

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link to="/orders" className="text-sm text-primary hover:text-primary-hover">&larr; 返回订单列表</Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-lg font-semibold text-slate-900">订单 {order.order_number}</h2>
          {order.order_status && ORDER_STATUS_LABELS[order.order_status] && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_LABELS[order.order_status].color}`}>
              {ORDER_STATUS_LABELS[order.order_status].label}
            </span>
          )}
          {order.delivery_status && DELIVERY_STATUS_LABELS[order.delivery_status] && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${DELIVERY_STATUS_LABELS[order.delivery_status].color}`}>
              {DELIVERY_STATUS_LABELS[order.delivery_status].label}
            </span>
          )}
          {order.source && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${order.source === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {order.source === 'manual' ? '手动录入' : 'WooCommerce'}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {order.distributor_name && `分销商: ${order.distributor_name} (${order.distributor_code})`}
          {(order as any).site_name && ` | 站点: ${(order as any).site_name}`}
          {order.date_created && ` | ${new Date(order.date_created).toLocaleString()}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canEdit && <button onClick={() => navigate(`/orders/${order.id}/edit`)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">编辑订单</button>}
        <button onClick={() => navigate(`/orders/new?copy_from=${order.id}`)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">复制订单</button>
        {canConfirm && <button onClick={handleConfirmOrder} disabled={actionLoading}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50">确认订单 (客户已确认)</button>}
        {canSubmit && <button onClick={() => handleDeliveryStatusChange('submitted')} disabled={actionLoading}
          className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">提交订单</button>}
        {isOp && order.delivery_status === 'submitted' && (
          <>
            <button onClick={() => handleDeliveryStatusChange('settled')} disabled={actionLoading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">标记结算</button>
            <button onClick={() => handleDeliveryStatusChange('delivery_exception')} disabled={actionLoading}
              className="rounded-md bg-yellow-500 px-4 py-2 text-sm text-white hover:bg-yellow-600 disabled:opacity-50">派送异常</button>
          </>
        )}
        {isOp && order.delivery_status && ['not_submitted', 'submitted', 'delivery_exception'].includes(order.delivery_status) && order.delivery_status !== 'cancelled' && (
          <button onClick={() => handleDeliveryStatusChange('cancelled')} disabled={actionLoading}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">取消订单</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Customer information</span>
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex"><dt className="w-24 text-slate-500">name</dt><dd className="text-slate-900">{order.customer_name || '-'}</dd></div>
            <div className="flex"><dt className="w-24 text-slate-500">phone</dt><dd className="text-slate-900">{order.customer_phone || '-'}</dd></div>
            <div className="flex"><dt className="w-24 text-slate-500">whatsapp</dt><dd className="text-slate-900">{order.customer_whatsapp || '-'}</dd></div>
            <div className="flex"><dt className="w-24 text-slate-500">city</dt><dd className="text-slate-900">{(order as any).customer_city || '-'}</dd></div>
            <div className="flex"><dt className="w-24 text-slate-500">address</dt><dd className="text-slate-900">{(order as any).customer_address || '-'}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Order summary</span>
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex"><dt className="w-28 text-slate-500">items</dt><dd className="text-slate-900">{order.item_summary || '-'}</dd></div>
            <div className="flex"><dt className="w-28 text-slate-500">expedited fee</dt><dd className="text-slate-900">{order.expedited_fee || 0} AED</dd></div>
            <div className="flex"><dt className="w-28 text-slate-500">total price</dt><dd className="text-slate-900 font-medium">{order.total || 0} AED</dd></div>
            <div className="flex"><dt className="w-28 text-slate-500">note</dt><dd className="text-slate-900">{order.note || '-'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Order details</span>
        </h3>
        {lineItems.length === 0 ? <p className="text-sm text-slate-400">暂无商品</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">商品</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">SKU</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">图片</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Price</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Qty</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.sku || '-'}</td>
                  <td className="px-3 py-2">
                    {(item.image_url || item.image?.src) ? (
                      <img src={item.image_url || item.image?.src} alt="" className="w-10 h-10 object-cover rounded border border-slate-200"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : <div className="w-10 h-10 bg-slate-100 rounded" />}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.price} AED</td>
                  <td className="px-3 py-2 text-right text-slate-600">&times;{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-700 font-medium">{(Number(item.price) * Number(item.quantity)).toFixed(2)} AED</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {order.status_log && order.status_log.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4">状态变更记录</h3>
          <div className="space-y-2">
            {order.status_log.map(log => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <span className="text-slate-400 text-xs whitespace-nowrap mt-0.5">{new Date(log.changed_at).toLocaleString()}</span>
                <span className="text-slate-600">
                  [{log.field === 'order_status' ? '确认状态' : '出库状态'}]
                  {log.from_value ? ` ${translateStatus(log.from_value)} → ` : ' '}{translateStatus(log.to_value)}
                </span>
                <span className="text-slate-400 text-xs">{translateChangedBy(log.changed_by)}</span>
                {log.note && <span className="text-slate-500 text-xs">({log.note})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
