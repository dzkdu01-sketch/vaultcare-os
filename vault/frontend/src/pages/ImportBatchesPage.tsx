import { useEffect, useState, useCallback } from 'react'
import { productsAPI, suppliersAPI, categoriesAPI } from '@/api/endpoints'
import type { Supplier, Category } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  MessageSquare,
  ExternalLink,
  FileText,
  Sparkles,
  Loader2,
  Tag,
  DollarSign,
  Globe,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── 类型定义 ────────────────────────────────────────────────────────────────

interface ImportBatch {
  id: number
  source_filename: string
  total_rows: number
  success_count: number
  failed_count: number
  status: 'completed' | 'partial_failed'
  created_at: string
  needs_escalation: boolean
  workorder_created: boolean
  workorder_status: string
  alert_sent: boolean
  last_alert_at: string | null
  alert_channels: string[]
}

interface ProductItem {
  id: number
  master_code: string
  title_en: string
  selling_price: string
  region: string
  primary_category: number | null
  audience_tags: string[]
}

interface AIRecommendation {
  action: 'set_supplier' | 'set_price' | 'set_sales_region' | 'add_tags'
  target_ids: number[]
  params: Record<string, unknown>
  reason: string
  confidence: number
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小时前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const REGION_OPTIONS = [
  { value: 'u', label: 'UAE' },
  { value: 't', label: 'Thailand' },
  { value: 'a', label: 'All' },
]

const AUDIENCE_TAG_OPTIONS = [
  { key: 'for_her', label: '她用' },
  { key: 'for_him', label: '他用' },
  { key: 'for_couples', label: '情侣' },
]

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function ImportBatchesPage() {
  const { isStaff, isSuperuser } = useAuth()
  const canExecuteBulkAction = isStaff || isSuperuser

  // 导入批次相关状态
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [creatingWorkorder, setCreatingWorkorder] = useState<number | null>(null)
  const [sendingAlert, setSendingAlert] = useState<number | null>(null)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [alertChannels, setAlertChannels] = useState<string[]>(['message'])
  const [emailRecipients, setEmailRecipients] = useState('')

  // 批量操作相关状态
  const [activeTab, setActiveTab] = useState<'batches' | 'bulk-ops'>('batches')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // 批量操作对话框
  const [bulkOpDialog, setBulkOpDialog] = useState<{
    open: boolean
    type: 'supplier' | 'price' | 'region' | 'tags' | null
  }>({ open: false, type: null })

  // 表单状态
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [supplierCode, setSupplierCode] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [regularPrice, setRegularPrice] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // AI 推荐相关
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)

  // ── 数据加载 ──────────────────────────────────────────────────────────────

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsAPI.getImportBatches()
      setBatches(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const res = await productsAPI.list({ limit: 100 })
      setProducts(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await suppliersAPI.list()
      setSuppliers(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesAPI.list()
      setCategories(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadBatches()
    loadProducts()
    loadSuppliers()
    loadCategories()
  }, [])

  // ── 导入批次操作 ───────────────────────────────────────────────────────────

  const handleRetry = async (batchId: number) => {
    setRetrying(batchId)
    try {
      await productsAPI.retryFailedRows(batchId)
      await loadBatches()
      showToast('重试完成')
    } catch {
      showToast('重试失败')
    } finally {
      setRetrying(null)
    }
  }

  const handleCreateWorkorder = async (batchId: number) => {
    setCreatingWorkorder(batchId)
    try {
      await productsAPI.createWorkorder(batchId)
      await loadBatches()
      showToast('工单已创建')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '创建失败'
      showToast(msg)
    } finally {
      setCreatingWorkorder(null)
    }
  }

  const handleSendAlert = async () => {
    if (!selectedBatch) return
    setSendingAlert(selectedBatch.id)
    try {
      const channels = alertChannels
      const recipients = emailRecipients.split(',').map((e) => e.trim()).filter(Boolean)
      await productsAPI.sendAlert(selectedBatch.id, channels, recipients)
      await loadBatches()
      setAlertDialogOpen(false)
      showToast('提醒已发送')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '发送失败'
      showToast(msg)
    } finally {
      setSendingAlert(null)
    }
  }

  const openAlertDialog = (batch: ImportBatch) => {
    setSelectedBatch(batch)
    setAlertChannels(['message'])
    setEmailRecipients('')
    setAlertDialogOpen(true)
  }

  // ── 商品选择 ──────────────────────────────────────────────────────────────

  const toggleProductSelection = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const selectAllProducts = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map((p) => p.id))
    }
  }

  // ── 批量操作 ──────────────────────────────────────────────────────────────

  const openBulkOpDialog = (type: 'supplier' | 'price' | 'region' | 'tags') => {
    if (selectedProducts.length === 0) {
      showToast('请先选择要修改的商品')
      return
    }
    setBulkOpDialog({ open: true, type })
    // 重置表单
    setSelectedSupplier('')
    setSupplierCode('')
    setCostPrice('')
    setSellingPrice('')
    setRegularPrice('')
    setSelectedRegion('')
    setSelectedTags([])
    setAiRecommendation(null)
  }

  const handleBulkAction = async () => {
    if (!bulkOpDialog.type || selectedProducts.length === 0) return

    setBulkActionLoading(true)
    try {
      let action: string
      let params: Record<string, unknown> = {}

      switch (bulkOpDialog.type) {
        case 'supplier':
          if (!selectedSupplier) {
            showToast('请选择供应商')
            return
          }
          action = 'set_supplier'
          params = {
            supplier_id: parseInt(selectedSupplier),
            supplier_code: supplierCode,
            cost_price: costPrice || '0',
          }
          break
        case 'price':
          if (!sellingPrice) {
            showToast('请填写实售价')
            return
          }
          action = 'set_price'
          params = {
            selling_price: sellingPrice,
            regular_price: regularPrice || undefined,
          }
          break
        case 'region':
          if (!selectedRegion) {
            showToast('请选择销售区域')
            return
          }
          action = 'set_sales_region'
          params = { sales_region: selectedRegion }
          break
        case 'tags':
          if (selectedTags.length === 0) {
            showToast('请选择标签')
            return
          }
          action = 'add_audience_tags'
          params = { tags: selectedTags }
          break
        default:
          return
      }

      await productsAPI.bulkAction({
        ids: selectedProducts,
        action: action as never,
        params,
      })

      showToast('批量修改成功')
      setBulkOpDialog({ open: false, type: null })
      loadProducts()
      setSelectedProducts([])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '操作失败'
      showToast(msg, 'error')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // ── AI 批量建议 ────────────────────────────────────────────────────────────

  const handleAIRecommend = async () => {
    if (selectedProducts.length === 0) {
      showToast('请先选择商品')
      return
    }
    setAnalyzingAI(true)
    try {
      // 模拟 AI 建议：根据品类推荐供应商
      const mockRecommendation: AIRecommendation = {
        action: 'set_supplier',
        target_ids: selectedProducts,
        params: {
          supplier_id: suppliers[0]?.id,
          supplier_code: '',
          cost_price: '0',
        },
        reason: `AI 分析发现这 ${selectedProducts.length} 个商品建议统一供应商以降低采购成本`,
        confidence: 0.85,
      }
      setAiRecommendation(mockRecommendation)
      setAiDialogOpen(true)
    } catch (e) {
      showToast('AI 分析失败')
    } finally {
      setAnalyzingAI(false)
    }
  }

  const applyAIRecommendation = async () => {
    if (!aiRecommendation) return
    setBulkActionLoading(true)
    try {
      await productsAPI.bulkAction({
        ids: aiRecommendation.target_ids,
        action: aiRecommendation.action as never,
        params: aiRecommendation.params,
      })
      showToast('已应用 AI 建议')
      setAiDialogOpen(false)
      setAiRecommendation(null)
      loadProducts()
      setSelectedProducts([])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '应用失败'
      showToast(msg, 'error')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">批量管理</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            批量修改商品属性、AI 智能推荐、导入批次处理
          </p>
        </div>
        <Button variant="outline" onClick={loadBatches} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('batches')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'batches'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-neutral-500 hover:text-neutral-700'
          )}
        >
          <FileText className="h-4 w-4 inline mr-1.5" />
          导入批次
        </button>
        <button
          onClick={() => setActiveTab('bulk-ops')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'bulk-ops'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-neutral-500 hover:text-neutral-700'
          )}
        >
          <RefreshCw className="h-4 w-4 inline mr-1.5" />
          批量操作
        </button>
      </div>

      {/* ── 导入批次列表 ───────────────────────────────────────────────────── */}
      {activeTab === 'batches' && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          )}

          {!loading && batches.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-neutral-400">
                <FileText className="h-12 w-12 mx-auto mb-3 text-neutral-300" />
                <p>暂无导入批次记录</p>
              </CardContent>
            </Card>
          )}

          {!loading && batches.length > 0 && (
            <div className="space-y-3">
              {batches.map((batch) => {
                const successRate = Math.round((batch.success_count / batch.total_rows) * 100)
                return (
                  <Card key={batch.id} className={cn(batch.needs_escalation && 'border-amber-300 bg-amber-50/30')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-neutral-900">{batch.source_filename || '未命名'}</span>
                            <Badge variant={batch.status === 'completed' ? 'success' : 'warning'}>
                              {batch.status === 'completed' ? '完成' : '部分失败'}
                            </Badge>
                            {batch.needs_escalation && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                需升级
                              </Badge>
                            )}
                            {batch.workorder_created && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                工单已创建
                              </Badge>
                            )}
                            {batch.alert_sent && (
                              <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-300">
                                <Mail className="h-3 w-3" />
                                已发送提醒
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatRelativeTime(batch.created_at)}
                            </span>
                            <span>总计：{batch.total_rows} 行</span>
                            <span className="text-green-600">成功：{batch.success_count}</span>
                            <span className="text-red-600">失败：{batch.failed_count}</span>
                            <span>成功率：{successRate}%</span>
                          </div>

                          {(batch.alert_channels ?? []).length > 0 && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400">
                              <span>提醒渠道：</span>
                              {(batch.alert_channels ?? []).map((c) => (
                                <Badge key={c} variant="outline" className="text-xs">
                                  {c === 'message' ? '消息' : '邮件'}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(batch.id)}
                            disabled={retrying === batch.id || batch.failed_count === 0}
                            className="gap-1.5"
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5', retrying === batch.id && 'animate-spin')} />
                            重试失败行
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAlertDialog(batch)}
                            disabled={sendingAlert === batch.id || !batch.needs_escalation}
                            className="gap-1.5"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            发送提醒
                          </Button>
                          <Button
                            size="sm"
                            variant={batch.needs_escalation && !batch.workorder_created ? 'default' : 'outline'}
                            onClick={() => handleCreateWorkorder(batch.id)}
                            disabled={creatingWorkorder === batch.id || !batch.needs_escalation || batch.workorder_created}
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {batch.workorder_created ? '工单已创建' : '创建工单'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 批量操作面板 ───────────────────────────────────────────────────── */}
      {activeTab === 'bulk-ops' && (
        <div className="space-y-4">
          {/* 权限提示 */}
          {!canExecuteBulkAction && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-900">预览模式</p>
                  <p className="text-xs text-amber-700">批量修改功能仅限审核员或超级管理员使用。当前您只能预览 AI 建议，无法执行修改。</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作工具栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-neutral-500">
                    已选择 <span className="font-medium text-violet-600">{selectedProducts.length}</span> 个商品
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllProducts}
                    className="h-8"
                  >
                    {selectedProducts.length === products.length ? '取消全选' : '全选'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAIRecommend}
                    disabled={analyzingAI || selectedProducts.length === 0}
                    className="gap-1.5"
                  >
                    {analyzingAI ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI 分析中</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> AI 批量建议</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 批量操作按钮组 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={cn("cursor-pointer transition-colors", canExecuteBulkAction ? "hover:border-violet-300" : "opacity-50 cursor-not-allowed")} onClick={() => canExecuteBulkAction && openBulkOpDialog('supplier')}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <Truck className="h-8 w-8 text-neutral-400" />
                <span className="font-medium text-sm">改供应商</span>
                <span className="text-xs text-neutral-500">批量设置供应商</span>
              </CardContent>
            </Card>

            <Card className={cn("cursor-pointer transition-colors", canExecuteBulkAction ? "hover:border-violet-300" : "opacity-50 cursor-not-allowed")} onClick={() => canExecuteBulkAction && openBulkOpDialog('price')}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <DollarSign className="h-8 w-8 text-neutral-400" />
                <span className="font-medium text-sm">改价格</span>
                <span className="text-xs text-neutral-500">批量调整售价</span>
              </CardContent>
            </Card>

            <Card className={cn("cursor-pointer transition-colors", canExecuteBulkAction ? "hover:border-violet-300" : "opacity-50 cursor-not-allowed")} onClick={() => canExecuteBulkAction && openBulkOpDialog('tags')}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <Tag className="h-8 w-8 text-neutral-400" />
                <span className="font-medium text-sm">改标签</span>
                <span className="text-xs text-neutral-500">批量添加受众标签</span>
              </CardContent>
            </Card>

            <Card className={cn("cursor-pointer transition-colors", canExecuteBulkAction ? "hover:border-violet-300" : "opacity-50 cursor-not-allowed")} onClick={() => canExecuteBulkAction && openBulkOpDialog('region')}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <Globe className="h-8 w-8 text-neutral-400" />
                <span className="font-medium text-sm">改销售区域</span>
                <span className="text-xs text-neutral-500">批量调整推送市场</span>
              </CardContent>
            </Card>
          </div>

          {/* 商品列表 */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === products.length && products.length > 0}
                          onChange={selectAllProducts}
                          className="h-4 w-4"
                        />
                      </th>
                      <th className="p-3 text-left font-medium text-neutral-600">商品编码</th>
                      <th className="p-3 text-left font-medium text-neutral-600">商品名称</th>
                      <th className="p-3 text-left font-medium text-neutral-600">售价</th>
                      <th className="p-3 text-left font-medium text-neutral-600">区域</th>
                      <th className="p-3 text-left font-medium text-neutral-600">标签</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className={cn(
                          'border-t hover:bg-neutral-50 cursor-pointer',
                          selectedProducts.includes(product.id) && 'bg-violet-50'
                        )}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-3 font-mono text-neutral-600">{product.master_code}</td>
                        <td className="p-3">{product.title_en}</td>
                        <td className="p-3">{product.selling_price} AED</td>
                        <td className="p-3">
                          <Badge variant="outline">{REGION_OPTIONS.find(r => r.value === product.region)?.label || product.region}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {(product.audience_tags ?? []).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {AUDIENCE_TAG_OPTIONS.find(t => t.key === tag)?.label || tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 批量操作对话框 ─────────────────────────────────────────────────── */}
      <Dialog open={bulkOpDialog.open} onOpenChange={(open) => setBulkOpDialog({ open, type: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkOpDialog.type === 'supplier' && '批量修改供应商'}
              {bulkOpDialog.type === 'price' && '批量修改价格'}
              {bulkOpDialog.type === 'region' && '批量修改销售区域'}
              {bulkOpDialog.type === 'tags' && '批量修改标签'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-neutral-500">
              将对 <span className="font-medium text-violet-600">{selectedProducts.length}</span> 个商品进行批量修改
            </p>

            {bulkOpDialog.type === 'supplier' && (
              <>
                <div className="space-y-2">
                  <Label>供应商 <span className="text-red-400">*</span></Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择供应商" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>供应商编码</Label>
                  <Input
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    placeholder="留空则使用商品编码"
                  />
                </div>
                <div className="space-y-2">
                  <Label>成本价</Label>
                  <Input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            {bulkOpDialog.type === 'price' && (
              <>
                <div className="space-y-2">
                  <Label>实售价（AED）<span className="text-red-400">*</span></Label>
                  <Input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>划线原价（AED）</Label>
                  <Input
                    type="number"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    placeholder="0.00（可选）"
                  />
                </div>
              </>
            )}

            {bulkOpDialog.type === 'region' && (
              <div className="space-y-2">
                <Label>销售区域 <span className="text-red-400">*</span></Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择销售区域" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkOpDialog.type === 'tags' && (
              <div className="space-y-2">
                <Label>受众标签</Label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_TAG_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(key)
                            ? prev.filter((t) => t !== key)
                            : [...prev, key]
                        )
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        selectedTags.includes(key)
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpDialog({ open: false, type: null })}>
              取消
            </Button>
            <Button onClick={handleBulkAction} disabled={bulkActionLoading}>
              {bulkActionLoading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 处理中...</>
              ) : (
                <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> 确认修改</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI 推荐对话框 ─────────────────────────────────────────────────── */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              AI 批量建议
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {aiRecommendation && (
              <>
                <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    <span className="font-medium text-violet-900">AI 建议</span>
                  </div>
                  <p className="text-sm text-violet-700">{aiRecommendation.reason}</p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">影响商品数</span>
                  <span className="font-medium">{aiRecommendation.target_ids.length} 个</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">置信度</span>
                  <Badge variant="outline" className="border-violet-300 text-violet-600">
                    {Math.round(aiRecommendation.confidence * 100)}%
                  </Badge>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  AI 建议仅供参考，请人工确认后再执行
                </div>

                {!canExecuteBulkAction && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    您没有执行权限，此操作仅限审核员或超级管理员
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={applyAIRecommendation}
              disabled={bulkActionLoading || !canExecuteBulkAction}
              className={cn("bg-violet-600 hover:bg-violet-700", !canExecuteBulkAction && "opacity-50 cursor-not-allowed")}
            >
              {bulkActionLoading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 应用中...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> 应用建议</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 发送提醒弹窗 ─────────────────────────────────────────────────── */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>发送升级提醒</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedBatch && (
              <div className="text-sm text-neutral-500">
                批次：{selectedBatch.source_filename}（失败 {selectedBatch.failed_count} 行，超过 48 小时）
              </div>
            )}

            <div className="space-y-2">
              <Label>提醒渠道</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertChannels.includes('message')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAlertChannels([...alertChannels, 'message'])
                      } else {
                        setAlertChannels(alertChannels.filter((c) => c !== 'message'))
                      }
                    }}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span className="text-sm text-neutral-700 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    消息
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertChannels.includes('email')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAlertChannels([...alertChannels, 'email'])
                      } else {
                        setAlertChannels(alertChannels.filter((c) => c !== 'email'))
                      }
                    }}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span className="text-sm text-neutral-700 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    邮件
                  </span>
                </label>
              </div>
            </div>

            {alertChannels.includes('email') && (
              <div className="space-y-2">
                <Label>邮件接收人</Label>
                <Input
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="多个地址用逗号分隔，如：ops@example.com,dev@example.com"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSendAlert} disabled={sendingAlert !== null || alertChannels.length === 0}>
              {sendingAlert !== null ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 发送中...</>
              ) : (
                <><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> 发送提醒</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 text-sm px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-bottom-4",
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-neutral-900 text-white'
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
