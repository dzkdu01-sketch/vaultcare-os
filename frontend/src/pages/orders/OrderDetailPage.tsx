import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { orderApi } from '../../services/app-services'
import type { Order } from '../../services/types'

const STATUS_LABELS: Record<string, string> = {
  'pending': 'Pending Payment',
  'processing': 'Processing',
  'on-hold': 'On Hold',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'failed': 'Failed',
}

export function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setOrder(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    orderApi
      .getById(id)
      .then(data => {
        if (cancelled) return
        setOrder(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setOrder(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>
  if (!order) return <div className="p-6 text-slate-500">Order not found</div>

  const lineItems = typeof order.line_items === 'string' ? JSON.parse(order.line_items || '[]') : (order.line_items || [])
  const shipping = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address || '{}') : (order.shipping_address || {})
  const billing = typeof order.billing_address === 'string' ? JSON.parse(order.billing_address || '{}') : (order.billing_address || {})

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/orders" className="text-sm text-violet-600 hover:text-violet-800">&larr; Back to Orders</Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-lg font-semibold text-slate-900">Order #{order.order_number}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            order.status === 'completed' ? 'bg-green-100 text-green-700' :
            order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
            order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-100 text-red-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          From {order.site_name} | {order.date_created ? new Date(order.date_created).toLocaleString() : '-'}
          {order.payment_method && <span> | {order.payment_method}</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="font-medium text-slate-900 mb-3">Items</h3>
          {lineItems.length === 0 ? (
            <p className="text-sm text-slate-400">No items</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-slate-500 font-medium">Item</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Price</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Qty</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 text-slate-900">
                      <div className="flex items-center gap-3">
                        {item.image?.src && (
                          <img src={item.image.src} alt="" className="w-10 h-10 object-cover rounded border border-slate-200 flex-shrink-0" />
                        )}
                        <div>
                          <p>{item.name}</p>
                          {item.sku && <p className="text-slate-400 font-mono text-xs">SKU: {item.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-right text-slate-600">{order.currency} {item.price}</td>
                    <td className="py-2 text-right text-slate-600">&times; {item.quantity}</td>
                    <td className="py-2 text-right text-slate-700">{order.currency} {item.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="py-2 font-medium text-slate-900 text-right">Order Total</td>
                  <td className="py-2 text-right font-medium text-slate-900">{order.currency} {order.total}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-medium text-slate-900 mb-3">Customer</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex"><dt className="w-24 text-slate-500">Name</dt><dd className="text-slate-900">{order.customer_name || '-'}</dd></div>
              <div className="flex"><dt className="w-24 text-slate-500">Email</dt><dd className="text-slate-900">{order.customer_email || '-'}</dd></div>
              <div className="flex"><dt className="w-24 text-slate-500">Phone</dt><dd className="text-slate-900">{order.customer_phone || '-'}</dd></div>
              <div className="flex"><dt className="w-24 text-slate-500">WhatsApp</dt><dd className="text-slate-900">{order.customer_whatsapp || order.customer_phone || '-'}</dd></div>
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-medium text-slate-900 mb-3">Billing</h3>
            <div className="text-sm text-slate-700 space-y-1">
              {billing.first_name && <p>{billing.first_name} {billing.last_name}</p>}
              {billing.address_1 && <p>{billing.address_1}</p>}
              {billing.address_2 && <p>{billing.address_2}</p>}
              {billing.city && <p>{billing.city}{billing.state ? `, ${billing.state}` : ''} {billing.postcode}</p>}
              {billing.country && <p>{billing.country}</p>}
              {billing.email && <p className="mt-2">Email: {billing.email}</p>}
              {billing.phone && <p>Phone: {billing.phone}</p>}
            </div>
          </div>

          {(shipping.address_1 || shipping.city) && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="font-medium text-slate-900 mb-3">Shipping</h3>
              <div className="text-sm text-slate-700 space-y-1">
                {shipping.first_name && <p>{shipping.first_name} {shipping.last_name}</p>}
                {shipping.address_1 && <p>{shipping.address_1}</p>}
                {shipping.address_2 && <p>{shipping.address_2}</p>}
                {shipping.city && <p>{shipping.city}{shipping.state ? `, ${shipping.state}` : ''} {shipping.postcode}</p>}
                {shipping.country && <p>{shipping.country}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
