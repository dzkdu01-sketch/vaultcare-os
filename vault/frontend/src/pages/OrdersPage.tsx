import { useEffect, useState, useCallback } from 'react'
import { ordersAPI, distributorsAPI, productsAPI } from '@/api/endpoints'
import type { Order, Distributor, MasterSKU } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ProductSearchSelect } from '@/components/ProductSearchSelect'
import { BulkEntryDialog } from '@/components/BulkEntryDialog'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Plus, Search, RefreshCw, Zap, ChevronRight, X } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待审核', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  reviewed: { label: '已审核', color: 'text-blue-700', bg: 'bg-blue-100' },
  pushed: { label: '已推单', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  shipped: { label: '派送中', color: 'text-purple-700', bg: 'bg-purple-100' },
  delivered: { label: '已签收', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: '已拒收', color: 'text-red-700', bg: 'bg-red-100' },
  returned: { label: '已退回', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const SOURCE_LABELS: Record<string, string> = {
  website: '网站',
  whatsapp: 'WhatsApp',
  manual: '手动',
}

interface QuickEntryItem {
  sku_id: string
  quantity: number
  unit_price: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)

  // Quick entry
  const [quickOpen, setQuickOpen] = useState(false)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [products, setProducts] = useState<MasterSKU[]>([])
  const [quickForm, setQuickForm] = useState({
    distributor_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    city: '',
    source: 'whatsapp',
    notes: '',
  })
  const [quickItems, setQuickItems] = useState<QuickEntryItem[]>([
    { sku_id: '', quantity: 1, unit_price: '' },
  ])
  const [quickSaving, setQuickSaving] = useState(false)

  // Order detail
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, search }
      if (filterStatus) params.status = filterStatus
      const res = await ordersAPI.list(params)
      setOrders(res.data.results ?? res.data)
      setCount(res.data.count ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus])

  useEffect(() => { load() }, [load])

  const openQuickEntry = async () => {
    if (distributors.length === 0) {
      const [dRes, pRes] = await Promise.all([
        distributorsAPI.list(),
        productsAPI.list({ page_size: 200, is_active: true }),
      ])
      setDistributors(dRes.data.results ?? dRes.data)
      setProducts(pRes.data.results ?? pRes.data)
    }
    setQuickOpen(true)
  }

  const handleQuickSubmit = async () => {
    setQuickSaving(true)
    try {
      const payload = {
        ...quickForm,
        distributor_id: parseInt(quickForm.distributor_id),
        items: quickItems.filter((i) => i.sku_id).map((i) => ({
          sku_id: parseInt(i.sku_id),
          quantity: i.quantity,
          unit_price: parseFloat(i.unit_price) || 0,
        })),
      }
      await ordersAPI.quickEntry(payload)
      setQuickOpen(false)
      setQuickItems([{ sku_id: '', quantity: 1, unit_price: '' }])
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setQuickSaving(false)
    }
  }

  const handleStatusChange = async (order: Order, newStatus: string) => {
    await ordersAPI.update(order.id, { status: newStatus })
    load()
    if (detailOrder?.id === order.id) {
      setDetailOrder({ ...detailOrder, status: newStatus as Order['status'] })
    }
  }

  const handleRoute = async (order: Order) => {
    await ordersAPI.route(order.id)
    load()
  }

  const totalPages = Math.ceil(count / 20)

  const addItem = () => setQuickItems([...quickItems, { sku_id: '', quantity: 1, unit_price: '' }])
  const removeItem = (i: number) => setQuickItems(quickItems.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">订单中心</h1>
          <p className="text-gray-500 text-sm mt-1">共 {count} 条订单</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={openQuickEntry}>
            <Zap className="h-4 w-4 mr-1" />
            快捷录单
          </Button>
          <Button onClick={openQuickEntry}>
            <Plus className="h-4 w-4 mr-1" />
            新建订单
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="搜索订单号、客户名、电话..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <select
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">订单号</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">客户</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">分销商</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">来源</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">金额</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">利润</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">时间</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
                )}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">暂无订单</td></tr>
                )}
                {!loading && orders.map((o) => {
                  const cfg = STATUS_CONFIG[o.status]
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{o.order_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.customer_name}</div>
                        <div className="text-xs text-gray-400">{o.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{o.distributor_name}</td>
                      <td className="px-4 py-3 text-gray-500">{SOURCE_LABELS[o.source] ?? o.source}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={parseFloat(o.profit) >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {formatCurrency(o.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', cfg?.bg, cfg?.color)}>
                          {cfg?.label ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDetailOrder(o)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Entry Dialog */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>快捷录单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>分销商 *</Label>
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={quickForm.distributor_id}
                  onChange={(e) => setQuickForm({ ...quickForm, distributor_id: e.target.value })}
                >
                  <option value="">选择分销商</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>客户姓名 *</Label>
                <Input value={quickForm.customer_name} onChange={(e) => setQuickForm({ ...quickForm, customer_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>电话 *</Label>
                <Input value={quickForm.customer_phone} onChange={(e) => setQuickForm({ ...quickForm, customer_phone: e.target.value })} placeholder="+971..." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>地址 *</Label>
                <Input value={quickForm.customer_address} onChange={(e) => setQuickForm({ ...quickForm, customer_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>城市 *</Label>
                <Input value={quickForm.city} onChange={(e) => setQuickForm({ ...quickForm, city: e.target.value })} placeholder="Dubai" />
              </div>
              <div className="space-y-1.5">
                <Label>来源</Label>
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={quickForm.source}
                  onChange={(e) => setQuickForm({ ...quickForm, source: e.target.value })}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">网站</option>
                  <option value="manual">手动</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>商品明细</Label>
                <div className="flex gap-2">
                  <BulkEntryDialog
                    products={products}
                    onAddItems={(newItems) => {
                      setQuickItems([...quickItems, ...newItems])
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    添加商品
                  </Button>
                </div>
              </div>
              {quickItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <ProductSearchSelect
                      products={products}
                      value={item.sku_id}
                      onChange={(skuId, product) => {
                        const newItems = [...quickItems]
                        newItems[idx] = {
                          ...newItems[idx],
                          sku_id: skuId,
                          unit_price: product?.selling_price?.toString() ?? ''
                        }
                        setQuickItems(newItems)
                      }}
                      placeholder="搜索商品..."
                      showStock
                    />
                  </div>
                  <div className="w-16">
                    <Input
                      type="number"
                      min="1"
                      placeholder="数量"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...quickItems]
                        newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 }
                        setQuickItems(newItems)
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="单价"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...quickItems]
                        newItems[idx] = { ...newItems[idx], unit_price: e.target.value }
                        setQuickItems(newItems)
                      }}
                    />
                  </div>
                  {quickItems.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => removeItem(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea
                value={quickForm.notes}
                onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                rows={2}
                placeholder="备注信息..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpen(false)}>取消</Button>
            <Button onClick={handleQuickSubmit} disabled={quickSaving}>
              {quickSaving ? '提交中...' : '提交订单'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Drawer */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailOrder(null)} />
          <div className="relative bg-white w-full max-w-md shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{detailOrder.order_number}</h2>
                <p className="text-sm text-gray-500">{detailOrder.customer_name} · {detailOrder.customer_phone}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDetailOrder(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              {/* Status change */}
              <div className="space-y-2">
                <Label>更新状态</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => handleStatusChange(detailOrder, k)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-all',
                        detailOrder.status === k
                          ? 'ring-2 ring-blue-500 ' + v.bg + ' ' + v.color
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-sm">配送信息</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p><span className="text-gray-500">地址：</span>{detailOrder.customer_address}</p>
                  <p><span className="text-gray-500">城市：</span>{detailOrder.city}</p>
                  <p><span className="text-gray-500">来源：</span>{SOURCE_LABELS[detailOrder.source]}</p>
                  <p><span className="text-gray-500">分销商：</span>{detailOrder.distributor_name}</p>
                  {detailOrder.supplier_name && (
                    <p><span className="text-gray-500">路由供应商：</span>{detailOrder.supplier_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-sm">商品明细</h3>
                <div className="space-y-2">
                  {detailOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-mono text-xs text-blue-700">{item.sku_code}</span>
                        <p className="text-gray-600">{item.sku_title}</p>
                        <p className="text-xs text-gray-400">× {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                        <p className="text-xs text-gray-400">成本 {formatCurrency(item.cost_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">总金额</span>
                  <span className="font-medium">{formatCurrency(detailOrder.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">配送费</span>
                  <span>{formatCurrency(detailOrder.delivery_fee)}</span>
                </div>
                {parseFloat(detailOrder.rejection_fee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">拒收费</span>
                    <span className="text-red-500">{formatCurrency(detailOrder.rejection_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-1">
                  <span>利润</span>
                  <span className={parseFloat(detailOrder.profit) >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {formatCurrency(detailOrder.profit)}
                  </span>
                </div>
              </div>

              {detailOrder.status === 'pending' && (
                <Button className="w-full" onClick={() => handleRoute(detailOrder)}>
                  <Zap className="h-4 w-4 mr-2" />
                  触发路由引擎
                </Button>
              )}

              {detailOrder.notes && (
                <div className="space-y-1">
                  <Label>备注</Label>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{detailOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
