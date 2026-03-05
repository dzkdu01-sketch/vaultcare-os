import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { productsAPI, categoriesAPI, suppliersAPI, supplierSKUsAPI, wpSitesAPI } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import type { MasterSKU, Category, Supplier, SupplierSKU } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Edit2,
  Check,
  X,
  Star,
  MessageSquare,
  Copy,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Plus,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Clock,
  Package,
  Globe,
  Truck,
  Loader2,
} from 'lucide-react'

// ──────────────────────────────────────────────
// 常量
// ──────────────────────────────────────────────
const REGION_LABELS: Record<string, string> = { u: 'UAE', t: 'Thailand', a: 'All' }
const AVAIL_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  low_stock: 'bg-yellow-400',
  unavailable: 'bg-red-400',
}
const AVAIL_LABELS: Record<string, string> = {
  available: '可售',
  low_stock: '低库存',
  unavailable: '缺货',
}
const REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  publishable: '可发布',
  inactive_delisted: '已下架',
}
const REVIEW_STATUS_BADGE: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary',
  pending_review: 'warning',
  publishable: 'success',
  inactive_delisted: 'destructive',
}
const AUDIENCE_TAGS = [
  { key: 'for_her', label: '她用' },
  { key: 'for_him', label: '他用' },
  { key: 'best_seller', label: '畅销' },
  { key: 'new_arrival', label: '新品' },
  { key: 'couples', label: '情侣' },
  { key: 'wellness', label: '健康' },
]

// ──────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────
function formatPrice(val: string | null | undefined) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : `${n.toFixed(0)} AED`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildWASimple(p: MasterSKU) {
  const price = formatPrice(p.selling_price)
  const was = p.regular_price ? ` (was ${formatPrice(p.regular_price)})` : ''
  const img = p.image_urls?.[0] ?? ''
  return `${p.master_code} - ${p.title_en}\n${price}${was}\n${img}`.trim()
}

function buildWAFull(p: MasterSKU) {
  const price = formatPrice(p.selling_price)
  const was = p.regular_price ? ` (was ${formatPrice(p.regular_price)})` : ''
  const desc = p.short_description ? `${p.short_description}\n` : ''
  const imgs = (p.image_urls ?? []).join('\n')
  return `${p.master_code} - ${p.title_en}\n${price}${was}\n${desc}${imgs}`.trim()
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

// ──────────────────────────────────────────────
// 图片画廊
// ──────────────────────────────────────────────
function ImageGallery({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0)
  if (!urls.length) {
    return (
      <div className="aspect-square bg-neutral-100 rounded-2xl flex items-center justify-center">
        <ImageOff className="h-12 w-12 text-neutral-300" />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="relative aspect-square bg-neutral-100 rounded-2xl overflow-hidden">
        <img
          src={urls[idx]}
          alt={`图片 ${idx + 1}`}
          className="w-full h-full object-contain"
        />
        {urls.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % urls.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
              {idx + 1} / {urls.length}
            </div>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                'flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all',
                i === idx ? 'border-violet-500' : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img src={url} alt={`缩略 ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 图片 URL 编辑器
// ──────────────────────────────────────────────
function ImageUrlEditor({
  urls,
  onChange,
}: {
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const [newUrl, setNewUrl] = useState('')

  const add = () => {
    const trimmed = newUrl.trim()
    if (trimmed && !urls.includes(trimmed)) {
      onChange([...urls, trimmed])
      setNewUrl('')
    }
  }

  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {urls.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 flex-shrink-0 rounded-md overflow-hidden bg-neutral-100 border">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="flex-1 text-xs text-neutral-600 truncate font-mono">{url}</span>
            <button onClick={() => remove(i)} className="text-neutral-400 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="粘贴图片 URL..."
          className="text-xs h-8"
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// WP 映射 Tab
// ──────────────────────────────────────────────
interface WPMapping {
  id: number
  site_url: string
  distributor_name: string
  wp_product_id: number | null
  wp_sku: string
  sync_status: string
  sync_status_display: string
  last_synced_at: string | null
  sync_error: string
}

const SYNC_STATUS_COLORS: Record<string, string> = {
  synced:  'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  syncing: 'bg-blue-100 text-blue-700',
  failed:  'bg-red-100 text-red-700',
  draft:   'bg-neutral-100 text-neutral-500',
}

function WPMappingsTab({ productId }: { productId: number }) {
  const [mappings, setMappings] = useState<WPMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    productsAPI.wpMappings(productId)
      .then((res) => setMappings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      await wpSitesAPI.pushSku(productId)
      setSyncMsg('同步请求已发送')
      setTimeout(() => load(), 1500)
    } catch {
      setSyncMsg('同步失败，请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-neutral-400 text-sm">加载中...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{mappings.length} 个映射</span>
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          重新同步
        </Button>
      </div>

      {syncMsg && (
        <p className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2">{syncMsg}</p>
      )}

      {!mappings.length ? (
        <div className="py-8 text-center text-neutral-400 text-sm">
          <Globe className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
          <p>该商品尚未推送到任何 WP 站点</p>
          <p className="text-xs mt-1">在分销商选品后会自动创建映射记录</p>
        </div>
      ) : (
        mappings.map((m) => (
          <div key={m.id} className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm text-neutral-900 truncate">{m.distributor_name}</div>
                <a
                  href={m.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline truncate block"
                >
                  {m.site_url}
                </a>
              </div>
              <span className={cn(
                'flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
                SYNC_STATUS_COLORS[m.sync_status] ?? 'bg-neutral-100 text-neutral-600'
              )}>
                {m.sync_status_display}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-500">
              <div>WP商品ID：<span className="text-neutral-900 font-medium">{m.wp_product_id ?? '—'}</span></div>
              <div>WP SKU：<span className="text-neutral-900 font-medium font-mono">{m.wp_sku || '—'}</span></div>
              <div>上次同步：<span className="text-neutral-900">{m.last_synced_at ? formatDate(m.last_synced_at) : '从未'}</span></div>
            </div>
            {m.sync_error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                错误：{m.sync_error}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 价格日志 Tab
// ──────────────────────────────────────────────
interface PriceLog {
  id: number
  changed_by_name: string
  field_name: string
  old_value: string
  new_value: string
  changed_at: string
}

function PriceLogsTab({ productId, refreshKey = 0 }: { productId: number; refreshKey?: number }) {
  const [logs, setLogs] = useState<PriceLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productsAPI.priceLogs(productId)
      .then((res) => setLogs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [productId, refreshKey])

  if (loading) return <div className="py-8 text-center text-neutral-400 text-sm">加载中...</div>
  if (!logs.length) return <div className="py-8 text-center text-neutral-400 text-sm">暂无价格变更记录</div>

  const FIELD_LABELS: Record<string, string> = {
    selling_price: '售价',
    regular_price: '原价',
    best_cost_price: '成本价',
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-neutral-900">
              {FIELD_LABELS[log.field_name] ?? log.field_name} 变更
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              <span className="line-through text-red-400">{log.old_value}</span>
              <span className="mx-1.5">→</span>
              <span className="text-green-600 font-medium">{log.new_value}</span>
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {log.changed_by_name} · {formatDate(log.changed_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// 供应商映射 Tab
// ──────────────────────────────────────────────
interface SupplierSkuForm {
  supplier: string
  supplier_code: string
  cost_price: string
  stock_status: 'in_stock' | 'out_of_stock'
}

const EMPTY_SUPPLIER_SKU_FORM: SupplierSkuForm = {
  supplier: '',
  supplier_code: '',
  cost_price: '',
  stock_status: 'in_stock',
}

function SupplierSkusTab({ product, onRefresh }: { product: MasterSKU; onRefresh: () => void }) {
  const skus = product.supplier_skus ?? []
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SupplierSkuForm>(EMPTY_SUPPLIER_SKU_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    suppliersAPI.list().then((res) => {
      setSuppliers(res.data.results ?? res.data)
    }).catch(console.error)
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_SUPPLIER_SKU_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s: SupplierSKU) => {
    setEditingId(s.id)
    setForm({
      supplier: String(s.supplier),
      supplier_code: s.supplier_code,
      cost_price: s.cost_price,
      stock_status: s.stock_status,
    })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.supplier || !form.supplier_code || !form.cost_price) {
      setError('供应商、供应商编码和成本价均不能为空')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        supplier: parseInt(form.supplier),
        supplier_code: form.supplier_code,
        cost_price: form.cost_price,
        stock_status: form.stock_status,
        master_sku: product.id,
      }
      if (editingId) {
        await supplierSKUsAPI.update(editingId, payload)
      } else {
        await supplierSKUsAPI.create(payload)
      }
      setModalOpen(false)
      onRefresh()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      setError(typeof data === 'string' ? data : JSON.stringify(data) || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此供应商映射？')) return
    try {
      await supplierSKUsAPI.delete(id)
      onRefresh()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> 添加供应商 SKU
        </Button>
      </div>

      {!skus.length ? (
        <div className="py-8 text-center text-neutral-400 text-sm">暂无供应商映射</div>
      ) : (
        <div className="space-y-2">
          {skus.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
              <div>
                <div className="text-sm font-medium text-neutral-900">{s.supplier_name}</div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5">{s.supplier_code}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-900">{s.cost_price} AED</div>
                  <Badge variant={s.stock_status === 'in_stock' ? 'success' : 'destructive'} className="text-xs mt-0.5">
                    {s.stock_status === 'in_stock' ? '有货' : '缺货'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-neutral-400 hover:text-violet-600"
                    onClick={() => openEdit(s)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-neutral-400 hover:text-red-500"
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-base font-semibold text-neutral-900">
              {editingId ? '编辑供应商 SKU' : '添加供应商 SKU'}
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">供应商</label>
                <select
                  value={form.supplier}
                  onChange={(e) => setForm(p => ({ ...p, supplier: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">-- 选择供应商 --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">供应商编码</label>
                <Input
                  value={form.supplier_code}
                  onChange={(e) => setForm(p => ({ ...p, supplier_code: e.target.value }))}
                  placeholder="供应商内部编码"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">成本价（AED）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">AED</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(e) => setForm(p => ({ ...p, cost_price: e.target.value }))}
                    className="pl-12"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">库存状态</label>
                <div className="flex gap-3">
                  {[
                    { value: 'in_stock', label: '有货' },
                    { value: 'out_of_stock', label: '缺货' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors',
                        form.stock_status === opt.value
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="stock_status"
                        value={opt.value}
                        checked={form.stock_status === opt.value}
                        onChange={() => setForm(p => ({ ...p, stock_status: opt.value as 'in_stock' | 'out_of_stock' }))}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 保存中…</> : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 主页面
// ──────────────────────────────────────────────
type TabKey = 'info' | 'suppliers' | 'wp' | 'price_logs'

interface EditForm {
  title_en: string
  title_ar: string
  title_th: string
  short_description: string
  description: string
  primary_category: string
  region: 'u' | 't' | 'a'
  audience_tags: string[]
  regular_price: string
  selling_price: string
  image_urls: string[]
  video_urls: string[]
  is_featured: boolean
  is_active: boolean
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const productId = Number(id)
  const { isStaff, isSuperuser } = useAuth()

  const [product, setProduct] = useState<MasterSKU | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('info')
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [priceLogKey, setPriceLogKey] = useState(0)
  const [draftToastShown, setDraftToastShown] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (draftToastShown) return
    const created = searchParams.get('created')
    if (created === 'draft') {
      showToast('草稿已保存')
      setDraftToastShown(true)
    }
    if (created === 'manual-draft') {
      showToast('手动新增已保存为草稿')
      setDraftToastShown(true)
    }
  }, [searchParams, draftToastShown])

  const loadProduct = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsAPI.get(productId)
      setProduct(res.data)
    } catch {
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }, [productId, navigate])

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesAPI.list()
      setCategories(res.data.results ?? res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadProduct()
    loadCategories()
  }, [loadProduct, loadCategories])

  // 关键修复：从 URL param ?edit=1 进入时，product 加载完后自动填充 form
  useEffect(() => {
    if (product && editMode && form === null) {
      setForm({
        title_en: product.title_en,
        title_ar: product.title_ar,
        title_th: product.title_th ?? '',
        short_description: product.short_description,
        description: product.description,
        primary_category: product.primary_category ? String(product.primary_category) : '',
        region: product.region,
        audience_tags: product.audience_tags ?? [],
        regular_price: product.regular_price ?? '',
        selling_price: product.selling_price,
        image_urls: product.image_urls ?? [],
        video_urls: (product.video_urls ?? []).map((v) => v.url),
        is_featured: product.is_featured,
        is_active: product.is_active,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, editMode])

  const enterEdit = () => {
    if (!product) return
    setForm({
      title_en: product.title_en,
      title_ar: product.title_ar,
      title_th: product.title_th ?? '',
      short_description: product.short_description,
      description: product.description,
      primary_category: product.primary_category ? String(product.primary_category) : '',
      region: product.region,
      audience_tags: product.audience_tags ?? [],
      regular_price: product.regular_price ?? '',
      selling_price: product.selling_price,
      image_urls: product.image_urls ?? [],
      video_urls: (product.video_urls ?? []).map((v) => v.url),
      is_featured: product.is_featured,
      is_active: product.is_active,
    })
    setEditMode(true)
  }

  const cancelEdit = () => {
    setForm(null)
    setEditMode(false)
  }

  const handleSave = async () => {
    if (!form || !product) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title_en: form.title_en,
        title_ar: form.title_ar,
        title_th: form.title_th,
        short_description: form.short_description,
        description: form.description,
        region: form.region,
        audience_tags: form.audience_tags,
        selling_price: parseFloat(form.selling_price) || 0,
        regular_price: form.regular_price ? parseFloat(form.regular_price) : null,
        image_urls: form.image_urls,
        video_urls: form.video_urls.map((url) => ({ url, width: 0, height: 0 })),
        is_featured: form.is_featured,
        is_active: form.is_active,
        primary_category: form.primary_category ? parseInt(form.primary_category) : null,
      }
      await productsAPI.update(product.id, payload)
      showToast('保存成功')
      setEditMode(false)
      setForm(null)
      setPriceLogKey((k) => k + 1)
      loadProduct()
    } catch (e) {
      console.error(e)
      showToast('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!product) return
    await productsAPI.update(product.id, { is_active: !product.is_active })
    showToast(product.is_active ? '已下架' : '已上架')
    loadProduct()
  }

  const handleToggleFeatured = async () => {
    if (!product) return
    await productsAPI.update(product.id, { is_featured: !product.is_featured })
    showToast(product.is_featured ? '已取消精选' : '已设为精选')
    loadProduct()
  }

  const handleSubmitReview = async () => {
    if (!product) return
    try {
      await productsAPI.submitReview(product.id)
      showToast('已提交审核')
      loadProduct()
    } catch {
      showToast('提交审核失败')
    }
  }

  const handleApproveReview = async () => {
    if (!product) return
    try {
      await productsAPI.approveReview(product.id)
      showToast('审核已通过，可上架')
      loadProduct()
    } catch {
      showToast('审核通过失败（仅审核员可操作）')
    }
  }

  const handleRejectReview = async () => {
    if (!product) return
    const note = window.prompt('请输入驳回原因（可选）：') ?? ''
    try {
      await productsAPI.rejectReview(product.id, note)
      showToast('已驳回至草稿')
      loadProduct()
    } catch {
      showToast('驳回失败（仅审核员可操作）')
    }
  }

  const handleEmergencyPublish = async () => {
    if (!product) return
    const reason = window.prompt('请输入紧急放行原因（必填）：') ?? ''
    if (!reason.trim()) {
      showToast('紧急放行原因不能为空')
      return
    }
    try {
      await productsAPI.emergencyPublish(product.id, reason.trim())
      showToast('已紧急放行并上架')
      loadProduct()
    } catch {
      showToast('紧急放行失败（仅老板可操作）')
    }
  }

  const handleDelist = async () => {
    if (!product) return
    if (!confirm('确定要下架此商品吗？下架后将清除所有分销商选品并同步 WP 站点为草稿状态。')) {
      return
    }
    try {
      await productsAPI.delist(product.id)
      showToast('已下架')
      loadProduct()
    } catch {
      showToast('下架失败')
    }
  }

  const toggleAudienceTag = (tag: string) => {
    if (!form) return
    const tags = form.audience_tags.includes(tag)
      ? form.audience_tags.filter((t) => t !== tag)
      : [...form.audience_tags, tag]
    setForm({ ...form, audience_tags: tags })
  }

  const setF = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev)

  // Tabs config
  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: '基本信息', icon: <Package className="h-3.5 w-3.5" /> },
    { key: 'suppliers', label: '供应商', icon: <Truck className="h-3.5 w-3.5" /> },
    { key: 'wp', label: 'WP映射', icon: <Globe className="h-3.5 w-3.5" /> },
    { key: 'price_logs', label: '价格日志', icon: <Clock className="h-3.5 w-3.5" /> },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/products')} className="gap-1.5 text-neutral-600">
          <ArrowLeft className="h-4 w-4" />
          商品管理
        </Button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium text-neutral-900 font-mono">{product.master_code}</span>
      </div>

      {/* Main layout: left + right */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ── Left: Gallery + Quick Actions ── */}
        <div className="space-y-4">
          <ImageGallery urls={product.image_urls ?? []} />

          {/* Quick action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleToggleActive}
            >
              {product.is_active ? (
                <><ToggleRight className="h-4 w-4 text-green-600" /> 下架</>
              ) : (
                <><ToggleLeft className="h-4 w-4 text-neutral-400" /> 上架</>
              )}
            </Button>
            <Button
              variant="outline"
              className={cn('gap-1.5', product.is_featured && 'border-amber-300 text-amber-600')}
              onClick={handleToggleFeatured}
            >
              <Star className={cn('h-4 w-4', product.is_featured && 'fill-amber-400 text-amber-400')} />
              {product.is_featured ? '取消精选' : '设为精选'}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => { copyText(buildWASimple(product)); showToast('WA素材已复制') }}
            >
              <MessageSquare className="h-4 w-4" /> WA简版
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => { copyText(buildWAFull(product)); showToast('WA素材已复制') }}
            >
              <Copy className="h-4 w-4" /> WA完整
            </Button>
          </div>

          {/* Basic stats card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">状态</span>
                <div className="flex items-center gap-2">
                  <Badge variant={product.is_active ? 'success' : 'secondary'}>
                    {product.is_active ? '上架' : '下架'}
                  </Badge>
                  <Badge variant={REVIEW_STATUS_BADGE[product.review_status] ?? 'secondary'}>
                    {REVIEW_STATUS_LABELS[product.review_status] ?? product.review_status}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <span className={cn('w-1.5 h-1.5 rounded-full', AVAIL_COLORS[product.availability])} />
                    <span className="text-xs text-neutral-500">{AVAIL_LABELS[product.availability]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">区域</span>
                <span className="text-sm font-medium">{REGION_LABELS[product.region] ?? product.region}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">售价</span>
                <span className="text-sm font-bold text-neutral-900">{formatPrice(product.selling_price)}</span>
              </div>
              {product.regular_price && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">原价</span>
                  <span className="text-sm text-neutral-400 line-through">{formatPrice(product.regular_price)}</span>
                </div>
              )}
              {product.best_cost_price && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">最低成本</span>
                  <span className="text-sm text-neutral-600">{formatPrice(product.best_cost_price)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">更新时间</span>
                <span className="text-xs text-neutral-400">{formatDate(product.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Tabs ── */}
        <div className="space-y-4">
          {/* Product title header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-violet-700">{product.master_code}</span>
                {product.legacy_code && (
                  <span className="font-mono text-xs text-neutral-400">{product.legacy_code}</span>
                )}
                {product.primary_category_name && (
                  <Badge variant="secondary" className="text-xs">{product.primary_category_name}</Badge>
                )}
              </div>
              <h1 className="text-xl font-bold text-neutral-900 mt-1">{product.title_en}</h1>
              {product.title_ar && (
                <p className="text-sm text-neutral-500 mt-0.5" dir="rtl">{product.title_ar}</p>
              )}
              {(product.audience_tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {product.audience_tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium border border-violet-100">
                      {AUDIENCE_TAGS.find((t) => t.key === tag)?.label ?? tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {editMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1.5">
                    <X className="h-3.5 w-3.5" /> 取消
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Check className="h-3.5 w-3.5" /> {saving ? '保存中...' : '保存'}
                  </Button>
                </>
              ) : (
                <>
                  {/* 提交审核：所有用户可见（draft 和 inactive_delisted） */}
                  {(product.review_status === 'draft' || (product.review_status as string) === 'inactive_delisted') && (
                    <Button variant="outline" size="sm" onClick={handleSubmitReview} className="gap-1.5">
                      {(product.review_status as string) === 'inactive_delisted' ? '重新提交审核' : '提交审核'}
                    </Button>
                  )}
                  {/* 审核操作：仅审核员 (is_staff) 可见 */}
                  {product.review_status === 'pending_review' && isStaff && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleRejectReview} className="gap-1.5">
                        驳回
                      </Button>
                      <Button size="sm" onClick={handleApproveReview} className="gap-1.5">
                        审核通过
                      </Button>
                    </>
                  )}
                  {/* 下架操作：仅审核员可执行，仅 publishable 状态可下架 */}
                  {product.review_status === 'publishable' && isStaff && (
                    <Button variant="outline" size="sm" onClick={handleDelist} className="gap-1.5 text-red-700 border-red-300">
                      下架
                    </Button>
                  )}
                  {/* 紧急放行：仅老板 (is_superuser) 可见 */}
                  {!product.is_active && isSuperuser && (
                    <Button variant="outline" size="sm" onClick={handleEmergencyPublish} className="gap-1.5 text-amber-700 border-amber-300">
                      紧急放行
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={enterEdit} className="gap-1.5">
                    <Edit2 className="h-3.5 w-3.5" /> 编辑
                  </Button>
                </>
              )}
            </div>
          </div>
          {product.review_status === 'draft' && product.review_note && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              驳回原因：{product.review_note}
            </div>
          )}
          {!!product.emergency_override_reason && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              紧急放行记录：{product.emergency_override_reason}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-neutral-200">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    tab === t.key
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <Card>
            <CardContent className="p-5">
              {/* ── 基本信息 Tab ── */}
              {tab === 'info' && !editMode && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="英文名称" value={product.title_en} />
                    <InfoRow label="区域" value={REGION_LABELS[product.region] ?? product.region} />
                    {['u', 'a'].includes(product.region) && (
                      <InfoRow label="阿语名称" value={product.title_ar} dir="rtl" />
                    )}
                    {['t', 'a'].includes(product.region) && (
                      <InfoRow label="泰语名称" value={product.title_th} />
                    )}
                    <InfoRow label="品类" value={product.primary_category_name || '未分类'} />
                    <InfoRow label="售价" value={formatPrice(product.selling_price)} />
                    <InfoRow label="原价" value={product.regular_price ? formatPrice(product.regular_price) : '—'} />
                  </div>
                  {product.short_description && (
                    <InfoRow label="简介" value={product.short_description} />
                  )}
                  {product.description && (
                    <InfoRow label="详细描述" value={product.description} multiline />
                  )}
                  {(product.video_urls ?? []).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-neutral-500">视频链接</span>
                      <div className="space-y-1">
                        {product.video_urls.map((v, i) => (
                          <a
                            key={i}
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-violet-600 hover:underline truncate font-mono"
                          >
                            {v.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 编辑模式 ── */}
              {tab === 'info' && editMode && form && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* title_en */}
                    <div className="space-y-1.5">
                      <Label>英文名称</Label>
                      <Input value={form.title_en} onChange={(e) => setF('title_en', e.target.value)} />
                    </div>
                    {/* title_ar */}
                    {(form.region === 'u' || form.region === 'a') && (
                      <div className="space-y-1.5">
                        <Label>阿拉伯语名称</Label>
                        <Input value={form.title_ar} onChange={(e) => setF('title_ar', e.target.value)} dir="rtl" placeholder="اسم المنتج" />
                      </div>
                    )}
                    {/* title_th */}
                    {(form.region === 't' || form.region === 'a') && (
                      <div className="space-y-1.5">
                        <Label>泰语名称</Label>
                        <Input value={form.title_th} onChange={(e) => setF('title_th', e.target.value)} placeholder="ชื่อสินค้าภาษาไทย" />
                      </div>
                    )}
                    {/* primary_category */}
                    <div className="space-y-1.5">
                      <Label>主品类</Label>
                      <Select value={form.primary_category || '__none__'} onValueChange={(v) => setF('primary_category', v === '__none__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择品类" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">未分类</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name_zh || c.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* region */}
                    <div className="space-y-1.5">
                      <Label>区域</Label>
                      <div className="flex gap-2">
                        {(['u', 't', 'a'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setF('region', r)}
                            className={cn(
                              'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                              form.region === r
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                            )}
                          >
                            {REGION_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* selling_price */}
                    <div className="space-y-1.5">
                      <Label>售价</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">AED</span>
                        <Input
                          type="number"
                          className="pl-11"
                          value={form.selling_price}
                          onChange={(e) => setF('selling_price', e.target.value)}
                        />
                      </div>
                    </div>
                    {/* regular_price */}
                    <div className="space-y-1.5">
                      <Label>原价（划线价）</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">AED</span>
                        <Input
                          type="number"
                          className="pl-11"
                          value={form.regular_price}
                          onChange={(e) => setF('regular_price', e.target.value)}
                          placeholder="可选"
                        />
                      </div>
                    </div>
                  </div>

                  {/* short_description */}
                  <div className="space-y-1.5">
                    <Label>简介 <span className="text-neutral-400 text-xs">({form.short_description.length}/200)</span></Label>
                    <Input
                      value={form.short_description}
                      onChange={(e) => setF('short_description', e.target.value.slice(0, 200))}
                      placeholder="商品简短描述..."
                    />
                  </div>

                  {/* description */}
                  <div className="space-y-1.5">
                    <Label>详细描述</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setF('description', e.target.value)}
                      rows={4}
                      placeholder="完整商品描述..."
                    />
                  </div>

                  {/* audience_tags */}
                  <div className="space-y-1.5">
                    <Label>受众标签</Label>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCE_TAGS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleAudienceTag(key)}
                          className={cn(
                            'px-3 py-1 rounded-full text-sm border transition-colors',
                            form.audience_tags.includes(key)
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* image_urls */}
                  <div className="space-y-1.5">
                    <Label>图片 URL</Label>
                    <ImageUrlEditor
                      urls={form.image_urls}
                      onChange={(urls) => setF('image_urls', urls)}
                    />
                  </div>

                  {/* video_urls */}
                  <div className="space-y-1.5">
                    <Label>视频 URL <span className="text-xs text-neutral-400 font-normal ml-1">（每行一个）</span></Label>
                    <Textarea
                      value={form.video_urls.join('\n')}
                      onChange={(e) => {
                        const urls = e.target.value
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean)
                        setF('video_urls', urls)
                      }}
                      rows={3}
                      placeholder="粘贴视频链接，每行一个..."
                      className="resize-none text-xs font-mono"
                    />
                    {form.video_urls.length > 0 && (
                      <p className="text-xs text-neutral-400">已填 {form.video_urls.length} 个视频链接</p>
                    )}
                  </div>

                  {/* Toggles */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setF('is_active', e.target.checked)}
                        className="w-4 h-4 rounded accent-violet-600"
                      />
                      <span className="text-sm text-neutral-700">上架中</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_featured}
                        onChange={(e) => setF('is_featured', e.target.checked)}
                        className="w-4 h-4 rounded accent-amber-500"
                      />
                      <span className="text-sm text-neutral-700">精选商品</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── 供应商映射 Tab ── */}
              {tab === 'suppliers' && <SupplierSkusTab product={product} onRefresh={loadProduct} />}

              {/* ── WP映射 Tab ── */}
              {tab === 'wp' && <WPMappingsTab productId={productId} />}

              {/* ── 价格日志 Tab ── */}
              {tab === 'price_logs' && <PriceLogsTab productId={productId} refreshKey={priceLogKey} />}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── 辅助组件 ──
function InfoRow({
  label,
  value,
  dir,
  multiline,
}: {
  label: string
  value: string
  dir?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <p
        className={cn('text-sm text-neutral-900', multiline && 'whitespace-pre-wrap')}
        dir={dir}
      >
        {value || <span className="text-neutral-300">—</span>}
      </p>
    </div>
  )
}
