import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { orderApi, productApi, siteApi, distributorApi } from '../../services/app-services'
import { getSessionUser } from '../../app/store/auth-store'
import type { ExtendedOrder, OrderInput, Product, Site, Distributor } from '../../services/types'
import { ProductSelector } from './ProductSelector'

type LineItem = {
  local_product_id?: string | number
  sku: string
  name: string
  image_url: string
  quantity: number
  price: number
  qr_cost: number | null
  self_cost: number | null
}

export function OrderFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const copyFromId = searchParams.get('copy_from')
  const isEdit = !!id
  const user = getSessionUser()

  const [loading, setLoading] = useState(isEdit || !!copyFromId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showProductSelector, setShowProductSelector] = useState(false)

  const [orderNumber, setOrderNumber] = useState('')
  const [distributorId, setDistributorId] = useState<number | undefined>(
    user?.role === 'distributor' ? user.distributorId : undefined
  )
  const [siteId, setSiteId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')
  const [customerCity, setCustomerCity] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [orderStatus, setOrderStatus] = useState<'unconfirmed' | 'customer_confirmed'>('unconfirmed')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [expeditedFee, setExpeditedFee] = useState(0)
  const [note, setNote] = useState('')

  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [sites, setSites] = useState<Site[]>([])

  const loadOrder = (orderId: string, isCopy: boolean) => {
    orderApi.getById(orderId).then((order: ExtendedOrder) => {
      if (!isCopy) setOrderNumber(order.order_number || '')
      if (!isCopy) setOrderStatus(order.order_status || 'unconfirmed')
      setDistributorId(order.distributor_id)
      setSiteId(order.site_id || '')
      setCustomerName(order.customer_name || '')
      setCustomerPhone(order.customer_phone || '')
      setCustomerWhatsapp(order.customer_whatsapp || '')
      setCustomerCity((order as any).customer_city || '')
      setCustomerAddress((order as any).customer_address || '')
      setExpeditedFee(order.expedited_fee || 0)
      setNote(isCopy ? '' : (order.note || ''))
      try {
        const items = typeof order.line_items === 'string' ? JSON.parse(order.line_items || '[]') : (order.line_items || [])
        setLineItems(items.map((item: any) => ({
          local_product_id: item.local_product_id || item.product_id,
          sku: item.sku || '',
          name: item.name || '',
          image_url: item.image_url || item.image?.src || '',
          quantity: item.quantity || 1,
          price: Number(item.price) || 0,
          qr_cost: item.qr_cost ?? null,
          self_cost: item.self_cost ?? null,
        })))
      } catch { setLineItems([]) }
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }

  useEffect(() => {
    if (user?.role === 'operator') distributorApi.list().then(setDistributors).catch(() => {})
    siteApi.list().then(setSites).catch(() => {})
    if (isEdit) loadOrder(id!, false)
    else if (copyFromId) loadOrder(copyFromId, true)
    else setLoading(false)
  }, [id, copyFromId])

  const totalPrice = lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) + expeditedFee
  const itemSummary = lineItems.map(item => `${item.name} x${item.quantity}`).join(', ')

  const filteredSites = sites.filter((s: any) =>
    !distributorId || s.distributor_id == distributorId || !s.distributor_id
  )

  const handleProductsSelected = (products: Product[]) => {
    const newItems: LineItem[] = products.map(p => ({
      local_product_id: p.id,
      sku: p.sku,
      name: p.name,
      image_url: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '',
      quantity: 1,
      price: p.sale_price || p.regular_price || 0,
      qr_cost: null,
      self_cost: null,
    }))
    setLineItems(prev => [...prev, ...newItems])
    setShowProductSelector(false)
  }

  const removeLineItem = (index: number) => setLineItems(prev => prev.filter((_, i) => i !== index))
  const updateLineItem = (index: number, field: keyof LineItem, value: any) =>
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))

  const validate = (asDraft: boolean): string | null => {
    if (!distributorId) return '请选择分销商'
    if (!asDraft) {
      if (!customerName.trim()) return '请填写客户姓名'
      if (lineItems.length === 0) return '请至少添加一个商品'
    }
    return null
  }

  const handleSave = async (asDraft: boolean) => {
    setError(''); setSuccess('')
    const err = validate(asDraft)
    if (err) { setError(err); return }

    setSaving(true)
    try {
      const input: OrderInput = {
        distributor_id: distributorId,
        site_id: siteId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_whatsapp: customerWhatsapp,
        customer_city: customerCity,
        customer_address: customerAddress,
        line_items: lineItems,
        item_summary: itemSummary,
        expedited_fee: expeditedFee,
        note,
        order_status: asDraft ? 'unconfirmed' : 'customer_confirmed',
      }
      if (isEdit) {
        await orderApi.update(id!, input)
        if (!asDraft) await orderApi.updateOrderStatus(id!, 'customer_confirmed')
        setSuccess('保存成功')
        setTimeout(() => navigate('/orders'), 800)
      } else {
        await orderApi.create(input)
        setSuccess(asDraft ? '草稿已保存' : '订单已提交')
        setTimeout(() => navigate('/orders'), 800)
      }
    } catch (err: any) {
      const msg = err.message || '保存失败'
      try { setError(JSON.parse(msg)?.message || msg) } catch { setError(msg) }
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-slate-500">加载中...</div>

  const existingSkus = lineItems.map(i => i.sku).filter(Boolean)

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-lg font-semibold text-slate-900">
        {copyFromId ? '复制订单' : isEdit ? '编辑订单' : '新建订单'}
      </h2>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm">{success}</div>}

      {/* Basic Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">基本信息</span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">成员</label>
            {user?.role === 'operator' ? (
              <select value={distributorId || ''} onChange={e => setDistributorId(Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">选择分销商</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            ) : (
              <input value={user?.name || ''} disabled className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">成员代码</label>
            <input value={distributors.find(d => d.id === distributorId)?.code || user?.code || ''} disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Order number</label>
            <input value={isEdit ? orderNumber : '自动生成'} disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Customer information</span>
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">name <span className="text-red-500">*</span></label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${!customerName.trim() && error ? 'border-red-300' : 'border-slate-300'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">phone</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">whatsapp</label>
            <input value={customerWhatsapp} onChange={e => setCustomerWhatsapp(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">city</label>
            <input value={customerCity} onChange={e => setCustomerCity(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">address</label>
          <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">*Order status</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={orderStatus === 'unconfirmed'} onChange={() => setOrderStatus('unconfirmed')} className="accent-red-500" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">未确认</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={orderStatus === 'customer_confirmed'} onChange={() => setOrderStatus('customer_confirmed')} className="accent-orange-500" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">客户已确认</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">*出库状态</label>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 mt-1 inline-block">未提交</span>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">关联网站 (可选)</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm max-w-xs">
            <option value="">无 (WhatsApp等非网站渠道)</option>
            {filteredSites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Order Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Order details</span>
          {lineItems.length === 0 && error && <span className="text-red-500 text-xs ml-2">请至少添加一个商品</span>}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-8">#</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">选择商品</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">code</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-16">pic</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">quantity</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">price</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">QR拿货价</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">自营拿货价</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-900 max-w-48 truncate">{item.name || '-'}</td>
                  <td className="px-3 py-2 font-mono text-slate-600 text-xs">{item.sku}</td>
                  <td className="px-3 py-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded border border-slate-200"
                        onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).className = 'w-10 h-10 bg-slate-100 rounded' }} />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">N/A</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={1} value={item.quantity}
                      onChange={e => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={item.price}
                      onChange={e => updateLineItem(i, 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={item.qr_cost ?? ''}
                      onChange={e => updateLineItem(i, 'qr_cost', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm" placeholder="-" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={item.self_cost ?? ''}
                      onChange={e => updateLineItem(i, 'self_cost', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm" placeholder="-" />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeLineItem(i)} className="text-red-400 hover:text-red-600 text-sm">删除</button>
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">暂无商品，请点击"+ 添加"选择</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowProductSelector(true)} className="text-sm text-primary hover:text-primary-hover font-medium">+ 添加</button>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item Summary</label>
            <input value={itemSummary} disabled className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expedited Fee</label>
            <input type="number" step="0.01" value={expeditedFee}
              onChange={e => setExpeditedFee(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Price</label>
            <input value={totalPrice.toFixed(2)} disabled className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 font-medium" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">note</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="订单备注" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="rounded-md bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">
          {saving ? '保存中...' : '提交'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          className="rounded-md border border-slate-300 px-6 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          保存草稿
        </button>
        <button onClick={() => navigate('/orders')}
          className="rounded-md border border-slate-200 px-6 py-2 text-sm text-slate-500 hover:bg-slate-50">取消</button>
      </div>

      {showProductSelector && (
        <ProductSelector onSelect={handleProductsSelected} onClose={() => setShowProductSelector(false)} existingSkus={existingSkus} />
      )}
    </div>
  )
}
