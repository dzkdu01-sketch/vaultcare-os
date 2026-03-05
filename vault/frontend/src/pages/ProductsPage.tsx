import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiAPI, productsAPI, categoriesAPI, operationalTagsAPI } from '@/api/endpoints'
import { Label } from '@/components/ui/label'
import type { MasterSKU, ProductStats, Category, OperationalTag } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Plus,
  Search,
  RefreshCw,
  LayoutList,
  LayoutGrid,
  Star,
  MoreHorizontal,
  Eye,
  Edit2,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ImageOff,
  Download,
  Upload,
  Check,
  AlertCircle,
  Columns3,
  Save,
  SkipForward,
  ShieldAlert,
  WandSparkles,
} from 'lucide-react'

// ──────────────────────────────────────────────
// 常量
// ──────────────────────────────────────────────
const REGION_LABELS: Record<string, string> = { u: 'UAE', t: 'TH', a: 'All' }
const REGION_COLORS: Record<string, string> = {
  u: 'bg-blue-100 text-blue-700',
  t: 'bg-orange-100 text-orange-700',
  a: 'bg-purple-100 text-purple-700',
}
// Task 3: AI 辅助程度常量和样式
const AI_ASSISTED_LABELS: Record<string, string> = {
  none: '完全手动',
  ocr: 'AI 识别',
  optimize: 'AI 优化',
  both: 'AI 生成',
}
const AI_ASSISTED_VARIANTS: Record<string, 'secondary' | 'default' | 'success' | 'warning'> = {
  none: 'secondary',
  ocr: 'default',
  optimize: 'success',
  both: 'warning',
}
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
const AUDIENCE_TAG_LABELS: Record<string, string> = {
  for_her: '她用',
  for_him: '他用',
  for_couples: '情侣',
}
const DEFAULT_OPERATIONAL_TAGS = ['best_seller', 'high_value', 'new_arrival']
const PAGE_SIZE = 20
const WORKFLOW_TAB_STORAGE_KEY = 'products_workflow_tab'
const PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY = 'products_visible_columns_v1'

type WorkflowTab = 'draft' | 'pending_review' | 'publishable' | 'inactive_delisted'
type DynamicColumnKey =
  | 'category'
  | 'price'
  | 'status'
  | 'featured'
  | 'region'
  | 'updated'
  | 'ai_assisted'

const WORKFLOW_TABS: Array<{ key: WorkflowTab; label: string }> = [
  { key: 'draft', label: '草稿池' },
  { key: 'pending_review', label: '待审核' },
  { key: 'publishable', label: '可发布' },
  { key: 'inactive_delisted', label: '已下架' },
]

const DYNAMIC_COLUMNS: Array<{ key: DynamicColumnKey; label: string }> = [
  { key: 'category', label: '品类' },
  { key: 'price', label: '价格' },
  { key: 'status', label: '状态' },
  { key: 'featured', label: '精选' },
  { key: 'region', label: '区域' },
  { key: 'updated', label: '更新' },
  { key: 'ai_assisted', label: 'AI 辅助' },
]

const DEFAULT_VISIBLE_COLUMNS: DynamicColumnKey[] = DYNAMIC_COLUMNS.map((col) => col.key)
const TITLE_HINTS = [
  '建议包含核心品名 + 规格/卖点，长度 12-60 字符',
  '避免纯营销词堆叠（如 “爆款/超值/神奇”）',
  '优先写可审核的信息：材质、功能、适配场景',
]
const SHORT_DESC_QUICK_ITEMS = ['材质说明', '尺寸规格', '适用场景', '护理方式']

function readWorkflowTabFromStorage(): WorkflowTab {
  const raw = localStorage.getItem(WORKFLOW_TAB_STORAGE_KEY)
  return (raw as WorkflowTab) ?? 'draft'
}

// ──────────────────────────────────────────────
// 辅助函数
// ──────────────────────────────────────────────
function formatPrice(val: string | null | undefined) {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n.toFixed(0)
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function buildWASimple(p: MasterSKU) {
  const price = `${formatPrice(p.selling_price)} AED`
  const was = p.regular_price ? ` (was ${formatPrice(p.regular_price)} AED)` : ''
  const img = p.image_urls?.[0] ?? ''
  return `${p.master_code} - ${p.title_en}\n${price}${was}\n${img}`.trim()
}

function buildWAFull(p: MasterSKU) {
  const price = `${formatPrice(p.selling_price)} AED`
  const was = p.regular_price ? ` (was ${formatPrice(p.regular_price)} AED)` : ''
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
// 子组件：统计条
// ──────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: number
  active: boolean
  color?: string
  onClick: () => void
}
function StatCard({ label, value, active, color = 'text-neutral-900', onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center px-4 py-3 rounded-xl border transition-all min-w-[80px]',
        active
          ? 'border-violet-400 bg-violet-50 shadow-sm'
          : 'border-neutral-200 bg-white hover:bg-neutral-50'
      )}
    >
      <span className={cn('text-xl font-bold', color)}>{value}</span>
      <span className="text-xs text-neutral-500 mt-0.5">{label}</span>
    </button>
  )
}

// ──────────────────────────────────────────────
// 子组件：商品行
// ──────────────────────────────────────────────
interface ProductRowProps {
  product: MasterSKU
  checked: boolean
  visibleColumns: Set<DynamicColumnKey>
  onCheck: (id: number, checked: boolean) => void
  onView: (id: number) => void
  onEdit: (p: MasterSKU) => void
  onToggleActive: (p: MasterSKU) => void
  onToggleFeatured: (p: MasterSKU) => void
  onDelete: (p: MasterSKU) => void
  onCopyWA: (p: MasterSKU, full: boolean) => void
  onUpgradeCode: (p: MasterSKU) => void
  sortField: string
  inlinePriceEditId: number | null
  inlinePriceValue: string
  onPriceDoubleClick: (id: number, currentPrice: string) => void
  onPriceChange: (val: string) => void
  onPriceSave: (id: number) => void
  onPriceCancel: () => void
}
function ProductRow({
  product: p,
  checked,
  visibleColumns,
  onCheck,
  onView,
  onEdit,
  onToggleActive,
  onToggleFeatured,
  onDelete,
  onCopyWA,
  onUpgradeCode,
  inlinePriceEditId,
  inlinePriceValue,
  onPriceDoubleClick,
  onPriceChange,
  onPriceSave,
  onPriceCancel,
}: ProductRowProps) {
  const thumb = p.image_urls?.[0]
  const selling = formatPrice(p.selling_price)
  const regular = formatPrice(p.regular_price)
  const cost = formatPrice(p.best_cost_price)
  const isEditingPrice = inlinePriceEditId === p.id
  const margin =
    p.best_cost_price && p.selling_price
      ? Math.round(
          ((parseFloat(p.selling_price) - parseFloat(p.best_cost_price)) /
            parseFloat(p.selling_price)) *
            100
        )
      : null

  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50/60 group">
      {/* Checkbox */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(p.id, e.target.checked)}
          className="w-4 h-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
        />
      </td>

      {/* Thumbnail */}
      <td className="px-2 py-2">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt={p.title_en} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ImageOff className="h-4 w-4 text-neutral-300" />
          )}
        </div>
      </td>

      {/* Code / Name */}
      <td
        className="px-3 py-2 cursor-pointer max-w-[220px]"
        onClick={() => onView(p.id)}
      >
        <div className="font-mono text-xs font-semibold text-violet-700">{p.master_code}</div>
        <div className="text-sm font-medium text-neutral-900 truncate">{p.title_en}</div>
        {p.legacy_code && (
          <div className="text-xs text-neutral-400 font-mono">{p.legacy_code}</div>
        )}
        {p.title_ar && (
          <div className="text-xs text-neutral-400 truncate" dir="rtl">{p.title_ar}</div>
        )}
      </td>

      {/* Category */}
      {visibleColumns.has('category') && (
        <td className="px-3 py-2">
          {p.primary_category_name ? (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {p.primary_category_name}
            </Badge>
          ) : (
            <span className="text-xs text-neutral-300">未分类</span>
          )}
        </td>
      )}

      {/* Price — double-click to inline edit selling price */}
      {visibleColumns.has('price') && (
        <td
          className="px-3 py-2 text-right"
          onDoubleClick={() => !isEditingPrice && onPriceDoubleClick(p.id, p.selling_price)}
          title="双击快速修改售价"
        >
          {isEditingPrice ? (
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                type="number"
                value={inlinePriceValue}
                onChange={(e) => onPriceChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onPriceSave(p.id)
                  if (e.key === 'Escape') onPriceCancel()
                }}
                className="w-20 text-right text-sm border border-violet-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-xs text-neutral-500">AED</span>
            </div>
          ) : (
            <>
              <div className="font-semibold text-sm text-neutral-900 cursor-text select-none">
                {selling ? `${selling} AED` : '—'}
              </div>
              {regular && regular !== selling && (
                <div className="text-xs text-neutral-400 line-through">{regular} AED</div>
              )}
              {cost && (
                <div className="text-xs text-neutral-400">
                  成本 {cost}
                  {margin !== null && (
                    <span className="ml-1 text-green-600">{margin}%</span>
                  )}
                </div>
              )}
            </>
          )}
        </td>
      )}

      {/* Status + Availability */}
      {visibleColumns.has('status') && (
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1 items-start">
            <button
              onClick={() => onToggleActive(p)}
              className="focus:outline-none"
              title={p.is_active ? '点击下架' : '点击上架'}
            >
              <Badge variant={p.is_active ? 'success' : 'secondary'} className="text-xs cursor-pointer">
                {p.is_active ? '上架' : '下架'}
              </Badge>
            </button>
            <div className="flex items-center gap-1">
              <span
                className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', AVAIL_COLORS[p.availability] ?? 'bg-neutral-300')}
              />
              <span className="text-xs text-neutral-500">{AVAIL_LABELS[p.availability] ?? p.availability}</span>
            </div>
          </div>
        </td>
      )}

      {/* Featured */}
      {visibleColumns.has('featured') && (
        <td className="px-3 py-2 text-center">
          <button
            onClick={() => onToggleFeatured(p)}
            title={p.is_featured ? '取消精选' : '设为精选'}
            className="focus:outline-none"
          >
            <Star
              className={cn(
                'h-4 w-4 transition-colors',
                p.is_featured ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 hover:text-amber-300'
              )}
            />
          </button>
        </td>
      )}

      {/* Region */}
      {visibleColumns.has('region') && (
        <td className="px-3 py-2">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              REGION_COLORS[p.region] ?? 'bg-neutral-100 text-neutral-600'
            )}
          >
            {REGION_LABELS[p.region] ?? p.region}
          </span>
        </td>
      )}

      {/* Time */}
      {visibleColumns.has('updated') && (
        <td className="px-3 py-2 text-xs text-neutral-400 whitespace-nowrap">
          {relativeTime(p.updated_at)}
        </td>
      )}

      {/* Task 3: AI 辅助程度 */}
      {visibleColumns.has('ai_assisted') && (
        <td className="px-3 py-2">
          <Badge variant={AI_ASSISTED_VARIANTS[p.ai_assisted ?? 'none'] ?? 'secondary'} className="text-xs">
            {AI_ASSISTED_LABELS[p.ai_assisted ?? 'none'] ?? p.ai_assisted}
          </Badge>
        </td>
      )}

      {/* Actions */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(p.id)}>
              <Eye className="h-3.5 w-3.5" /> 查看详情
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(p)}>
              <Edit2 className="h-3.5 w-3.5" /> 编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCopyWA(p, false)}>
              <MessageSquare className="h-3.5 w-3.5" /> 复制WA素材（简版）
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCopyWA(p, true)}>
              <Copy className="h-3.5 w-3.5" /> 复制WA素材（完整）
            </DropdownMenuItem>
            {!p.master_code.startsWith('vc-') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onUpgradeCode(p)}>
                  <ArrowUpDown className="h-3.5 w-3.5" /> 升级编码
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onClick={() => onDelete(p)}>
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

// ──────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────
type SortField = 'updated_at' | 'selling_price' | 'master_code' | 'created_at'
type SortDir = 'asc' | 'desc'

interface Filters {
  search: string
  category: string
  region: string
  is_active: string
  is_featured: string
  review_status: string
  audience_tags: string[]
  // stat quick-filter flags
  uncategorized?: boolean
  missing_title_ar?: boolean
  missing_image?: boolean
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  category: '',
  region: '',
  is_active: '',
  is_featured: '',
  review_status: '',
  audience_tags: [],
}

interface DrawerFormState {
  title_en: string
  title_ar: string
  short_description: string
  selling_price: string
  regular_price: string
  region: 'u' | 't' | 'a'
  primary_category: string
  is_active: boolean
  is_featured: boolean
  audience_tags: string[]
}

interface DrawerOCRResult {
  title_en?: string
  title_ar?: string
  short_description?: string
  primary_category?: string
  audience_tags?: string[]
  notes?: string
  degraded?: boolean
}

const DEFAULT_DRAWER_FORM: DrawerFormState = {
  title_en: '',
  title_ar: '',
  short_description: '',
  selling_price: '',
  regular_price: '',
  region: 'u',
  primary_category: '',
  is_active: false,
  is_featured: false,
  audience_tags: [],
}

export default function ProductsPage() {
  const navigate = useNavigate()

  // Data
  const [products, setProducts] = useState<MasterSKU[]>([])
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [operationalTags, setOperationalTags] = useState<OperationalTag[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filters & sort
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    review_status: readWorkflowTabFromStorage(),
  }))
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false) // true = 全选当前筛选

  // View
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    return (localStorage.getItem('products_view') as 'list' | 'card') ?? 'list'
  })
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768)
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>(readWorkflowTabFromStorage)
  const [visibleColumns, setVisibleColumns] = useState<DynamicColumnKey[]>(() => {
    const raw = localStorage.getItem(PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY)
    if (!raw) return DEFAULT_VISIBLE_COLUMNS
    try {
      const parsed = JSON.parse(raw) as DynamicColumnKey[]
      const valid = parsed.filter((key) => DYNAMIC_COLUMNS.some((col) => col.key === key))
      return valid.length > 0 ? valid : DEFAULT_VISIBLE_COLUMNS
    } catch {
      return DEFAULT_VISIBLE_COLUMNS
    }
  })
  const visibleColumnSet = new Set(visibleColumns)

  // Drawer editing
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerProductId, setDrawerProductId] = useState<number | null>(null)
  const [drawerTab, setDrawerTab] = useState<'ai' | 'basic' | 'pricing' | 'tags' | 'media'>('ai')
  const [drawerForm, setDrawerForm] = useState<DrawerFormState>(DEFAULT_DRAWER_FORM)
  const [drawerInitialForm, setDrawerInitialForm] = useState<DrawerFormState>(DEFAULT_DRAWER_FORM)
  const [drawerDirty, setDrawerDirty] = useState(false)
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [drawerOCRFiles, setDrawerOCRFiles] = useState<File[]>([])
  const [drawerOCRLoading, setDrawerOCRLoading] = useState(false)
  const [drawerOCRResult, setDrawerOCRResult] = useState<DrawerOCRResult | null>(null)
  const [drawerOptimizeLoading, setDrawerOptimizeLoading] = useState(false)
  const [drawerOptimizePreview, setDrawerOptimizePreview] = useState<{ title_en: string; description: string } | null>(null)
  const [riskConfirmOpen, setRiskConfirmOpen] = useState(false)
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [pendingSaveAction, setPendingSaveAction] = useState<'close' | 'next' | null>(null)
  const drawerTitleInputRef = useRef<HTMLInputElement | null>(null)
  const drawerShortDescRef = useRef<HTMLTextAreaElement | null>(null)

  // Mobile behavior: enforce card view under 768px
  useEffect(() => {
    const syncViewport = () => {
      const mobile = window.innerWidth < 768
      setIsMobileViewport(mobile)
      if (mobile) {
        setViewMode('card')
      }
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!isMobileViewport) return
    setFilterExpanded(false)
  }, [isMobileViewport, filters])

  // Inline price editing
  const [inlinePriceEditId, setInlinePriceEditId] = useState<number | null>(null)
  const [inlinePriceValue, setInlinePriceValue] = useState('')

  const handlePriceDoubleClick = (id: number, currentPrice: string) => {
    setInlinePriceEditId(id)
    setInlinePriceValue(parseFloat(currentPrice).toFixed(0))
  }
  const handlePriceSave = async (id: number) => {
    if (!inlinePriceValue || inlinePriceEditId !== id) return
    setInlinePriceEditId(null)
    try {
      await productsAPI.update(id, { selling_price: parseFloat(inlinePriceValue) })
      showToast('售价已更新')
      loadProducts()
      loadStats()
    } catch {
      showToast('更新失败')
    }
  }
  const handlePriceCancel = () => setInlinePriceEditId(null)

  // Export
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, unknown> = { search: debouncedSearch }
      if (filters.category) params.primary_category = filters.category
      if (filters.region) params.region = filters.region
      if (filters.is_active) params.is_active = filters.is_active
      const res = await productsAPI.exportCsv(params)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('CSV 已下载')
    } catch {
      showToast('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // Import
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    updated: number
    skipped: number
    errors: string[]
    success_count?: number
    failed_count?: number
    failed_rows?: Array<{ line_no: number; master_code: string; reason: string }>
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await productsAPI.importCsv(importFile)
      setImportResult(res.data)
      if ((res.data.success_count ?? res.data.updated ?? 0) > 0) {
        loadProducts()
        loadStats()
      }
    } catch {
      showToast('导入失败，请检查文件格式')
    } finally {
      setImporting(false)
    }
  }

  const closeImport = () => {
    setImportOpen(false)
    setImportFile(null)
    setImportResult(null)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  // Batch modals
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false)
  const [batchRegionOpen, setBatchRegionOpen] = useState(false)
  const [batchAudienceOpen, setBatchAudienceOpen] = useState(false)
  const [batchAudienceMode, setBatchAudienceMode] = useState<'add' | 'remove'>('add')
  const [batchAudienceTags, setBatchAudienceTags] = useState<string[]>([])
  const [batchOperationalOpen, setBatchOperationalOpen] = useState(false)
  const [batchOperationalMode, setBatchOperationalMode] = useState<'add' | 'remove'>('add')
  const [batchOperationalTagNames, setBatchOperationalTagNames] = useState<string[]>([])
  const [batchCategoryId, setBatchCategoryId] = useState('')
  const [batchRegion, setBatchRegion] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)

  // Toasts
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  // Search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search)
      setPage(1)
    }, 350)
    return () => clearTimeout(searchTimer.current)
  }, [filters.search])

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page,
        search: debouncedSearch,
        ordering: sortDir === 'desc' ? `-${sortField}` : sortField,
      }
      if (filters.category) params.primary_category = filters.category
      if (filters.region) params.region = filters.region
      if (filters.is_active) params.is_active = filters.is_active
      if (filters.is_featured) params.is_featured = filters.is_featured
      if (filters.review_status) params.review_status = filters.review_status
      if (filters.audience_tags.length > 0) params.audience_tags = filters.audience_tags
      if (filters.uncategorized) params.uncategorized = 'true'
      if (filters.missing_title_ar) params.missing_title_ar = 'true'
      if (filters.missing_image) params.missing_image = 'true'

      const res = await productsAPI.list(params)
      const data = res.data
      setProducts(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, sortField, sortDir, filters.category, filters.region, filters.is_active, filters.is_featured, filters.review_status, filters.audience_tags, filters.uncategorized, filters.missing_title_ar, filters.missing_image])

  const loadStats = useCallback(async () => {
    try {
      const res = await productsAPI.stats()
      setStats(res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesAPI.list()
      setCategories(res.data.results ?? res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadOperationalTags = useCallback(async () => {
    try {
      const res = await operationalTagsAPI.list()
      setOperationalTags(res.data.results ?? res.data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadStats()
    loadCategories()
    loadOperationalTags()
  }, [loadStats, loadCategories, loadOperationalTags])

  // View mode persistence
  useEffect(() => {
    localStorage.setItem('products_view', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem(WORKFLOW_TAB_STORAGE_KEY, workflowTab)
  }, [workflowTab])

  useEffect(() => {
    localStorage.setItem(PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const hasChanges = JSON.stringify(drawerForm) !== JSON.stringify(drawerInitialForm)
    setDrawerDirty(hasChanges)
  }, [drawerForm, drawerInitialForm])

  // Reset selection when page/filter changes
  useEffect(() => {
    setSelectedIds(new Set())
    setSelectAll(false)
  }, [page, debouncedSearch, filters])

  // ── Sorting ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-neutral-400" />
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-violet-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-violet-600" />
    )
  }

  // ── Selection ──
  const pageIds = products.map((p) => p.id)
  const allPageChecked = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const someChecked = pageIds.some((id) => selectedIds.has(id))

  const handleCheckAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageIds.forEach((id) => next.add(id))
        return next
      })
    } else {
      setSelectedIds(new Set())
      setSelectAll(false)
    }
  }

  const handleCheck = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setSelectAll(false)
  }

  const selectionCount = selectAll ? count : selectedIds.size
  const hasSelection = selectionCount > 0

  // ── Filter helpers ──
  const applyWorkflowTab = (tab: WorkflowTab) => {
    setWorkflowTab(tab)
    setFilters((prev) => ({ ...prev, review_status: tab }))
    setPage(1)
  }

  const showAllWorkflowStatuses = () => {
    setFilters((prev) => ({ ...prev, review_status: '' }))
    setPage(1)
  }

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    if (key === 'review_status') {
      const status = String(value)
      if (status === 'draft' || status === 'pending_review' || status === 'publishable' || status === 'inactive_delisted') {
        setWorkflowTab(status as WorkflowTab)
      }
    }
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const toggleAudienceTag = (tag: string) => {
    setFilters((prev) => {
      const tags = prev.audience_tags.includes(tag)
        ? prev.audience_tags.filter((t) => t !== tag)
        : [...prev.audience_tags, tag]
      return { ...prev, audience_tags: tags }
    })
    setPage(1)
  }

  const resetFilters = () => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, review_status: prev.review_status }))
    setPage(1)
  }

  const hasActiveFilters = !!(
    filters.search || filters.category || filters.region ||
    filters.is_active || filters.is_featured || filters.review_status ||
    filters.audience_tags.length > 0 ||
    filters.uncategorized || filters.missing_title_ar || filters.missing_image
  )

  const toggleColumn = (column: DynamicColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) {
          showToast('至少保留 1 列')
          return prev
        }
        return prev.filter((key) => key !== column)
      }
      return [...prev, column]
    })
  }

  const initDrawerForm = (product: MasterSKU) => {
    const nextForm: DrawerFormState = {
      title_en: product.title_en ?? '',
      title_ar: product.title_ar ?? '',
      short_description: product.short_description ?? '',
      selling_price: product.selling_price ? String(parseFloat(product.selling_price)) : '',
      regular_price: product.regular_price ? String(parseFloat(product.regular_price)) : '',
      region: product.region ?? 'u',
      primary_category: product.primary_category ? String(product.primary_category) : '',
      is_active: product.is_active,
      is_featured: product.is_featured,
      audience_tags: product.audience_tags ?? [],
    }
    setDrawerProductId(product.id)
    setDrawerTab('ai')
    setDrawerForm(nextForm)
    setDrawerInitialForm(nextForm)
    setDrawerOCRFiles([])
    setDrawerOCRResult(null)
    setDrawerOptimizePreview(null)
    setRiskConfirmOpen(false)
    setPendingSaveAction(null)
    setRiskConfirmed(false)
  }

  const confirmDiscardIfDirty = () => {
    const domTitleDirty =
      drawerTitleInputRef.current !== null &&
      drawerTitleInputRef.current.value.trim() !== drawerInitialForm.title_en.trim()
    const domShortDescDirty =
      drawerShortDescRef.current !== null &&
      drawerShortDescRef.current.value.trim() !== drawerInitialForm.short_description.trim()
    const shouldConfirm = drawerDirty || domTitleDirty || domShortDescDirty || drawerProductId !== null
    if (!shouldConfirm) return true
    return confirm('有未保存的改动，确认放弃吗？')
  }

  const openEditDrawer = (product: MasterSKU) => {
    if (drawerOpen && !confirmDiscardIfDirty()) return
    initDrawerForm(product)
    setDrawerOpen(true)
  }

  const closeEditDrawer = () => {
    if (!confirmDiscardIfDirty()) return
    setDrawerOpen(false)
    setDrawerDirty(false)
    setDrawerProductId(null)
    setDrawerForm(DEFAULT_DRAWER_FORM)
    setDrawerInitialForm(DEFAULT_DRAWER_FORM)
  }

  const updateDrawerField = <K extends keyof DrawerFormState>(key: K, value: DrawerFormState[K]) => {
    setDrawerForm((prev) => ({ ...prev, [key]: value }))
  }

  const titleIssues: string[] = []
  if (drawerForm.title_en.trim().length < 12) titleIssues.push('标题偏短，建议补充规格或功能信息')
  if (drawerForm.title_en.trim().length > 60) titleIssues.push('标题偏长，建议控制在 60 字内')
  if (/爆款|神奇|超值|秒杀/.test(drawerForm.title_en)) titleIssues.push('存在营销词，建议替换为可审核的事实描述')

  const shortDescItems = drawerForm.short_description
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  const updateShortDescItem = (index: number, value: string) => {
    const next = [...shortDescItems]
    next[index] = value
    updateDrawerField('short_description', next.filter(Boolean).join('\n'))
  }

  const removeShortDescItem = (index: number) => {
    const next = shortDescItems.filter((_, i) => i !== index)
    updateDrawerField('short_description', next.join('\n'))
  }

  const appendShortDescItem = (label: string) => {
    const text = `• ${label}`
    if (shortDescItems.includes(text)) return
    updateDrawerField('short_description', [...shortDescItems, text].join('\n'))
  }

  const runDrawerOCR = async () => {
    if (!drawerOCRFiles.length) {
      showToast('请先上传图片/PDF')
      return
    }
    setDrawerOCRLoading(true)
    try {
      const fd = new FormData()
      drawerOCRFiles.forEach((file) => fd.append('images', file))
      const res = await aiAPI.ocrAnalyze(fd)
      setDrawerOCRResult(res.data as DrawerOCRResult)
      showToast('AI 提取完成，请校对后应用')
    } catch {
      showToast('AI 提取失败，请稍后重试')
    } finally {
      setDrawerOCRLoading(false)
    }
  }

  const applyOCRToDrawer = () => {
    if (!drawerOCRResult) return
    const matchedCategory = categories.find(
      (c) => c.name_en === drawerOCRResult.primary_category || c.name_zh === drawerOCRResult.primary_category
    )
    setDrawerForm((prev) => ({
      ...prev,
      title_en: drawerOCRResult.title_en || prev.title_en,
      title_ar: drawerOCRResult.title_ar || prev.title_ar,
      short_description: drawerOCRResult.short_description || prev.short_description,
      primary_category: matchedCategory ? String(matchedCategory.id) : prev.primary_category,
      audience_tags:
        drawerOCRResult.audience_tags && drawerOCRResult.audience_tags.length > 0
          ? drawerOCRResult.audience_tags
          : prev.audience_tags,
    }))
    showToast('已将 AI 提取结果回填到人工补充区')
  }

  const runDrawerOptimize = async () => {
    if (!drawerForm.title_en.trim()) {
      showToast('请先填写英文标题')
      return
    }
    setDrawerOptimizeLoading(true)
    try {
      const res = await aiAPI.optimizeText({
        title_en: drawerForm.title_en,
        description: drawerForm.short_description,
      })
      const data = res.data as { optimized?: { title_en?: string; description?: string } }
      setDrawerOptimizePreview({
        title_en: data.optimized?.title_en ?? drawerForm.title_en,
        description: data.optimized?.description ?? drawerForm.short_description,
      })
      showToast('已生成优化建议')
    } catch {
      showToast('文案优化失败')
    } finally {
      setDrawerOptimizeLoading(false)
    }
  }

  const applyOptimizePreview = () => {
    if (!drawerOptimizePreview) return
    setDrawerForm((prev) => ({
      ...prev,
      title_en: drawerOptimizePreview.title_en,
      short_description: drawerOptimizePreview.description,
    }))
    showToast('已应用优化建议')
  }

  const getRiskWarnings = () => {
    const warnings: string[] = []
    const costPrice = drawerProduct?.best_cost_price ? parseFloat(drawerProduct.best_cost_price) : null
    const sellingPrice = drawerForm.selling_price ? parseFloat(drawerForm.selling_price) : null
    if (costPrice !== null && sellingPrice !== null && !Number.isNaN(sellingPrice) && sellingPrice < costPrice) {
      warnings.push('实售价低于成本价，可能导致亏损')
    }
    if (drawerInitialForm.is_active === false && drawerForm.is_active === true && !drawerProduct?.image_urls?.length) {
      warnings.push('当前商品无图片，直接上架存在审核风险')
    }
    if (!drawerForm.primary_category) {
      warnings.push('主品类为空，提交后将影响审核效率')
    }
    return warnings
  }

  const requestSave = (action: 'close' | 'next') => {
    const warnings = getRiskWarnings()
    if (!warnings.length) {
      if (action === 'close') void saveDrawerAndClose()
      else void saveDrawerAndNext()
      return
    }
    setPendingSaveAction(action)
    setRiskConfirmed(false)
    setRiskConfirmOpen(true)
  }

  const proceedRiskConfirmedSave = () => {
    if (!riskConfirmed || !pendingSaveAction) return
    setRiskConfirmOpen(false)
    if (pendingSaveAction === 'close') void saveDrawerAndClose()
    else void saveDrawerAndNext()
  }

  const persistDrawer = async () => {
    if (!drawerProductId) return false
    if (!drawerForm.title_en.trim() || !drawerForm.selling_price.trim()) {
      showToast('标题和售价为必填')
      return false
    }
    const sellingPrice = parseFloat(drawerForm.selling_price)
    const regularPrice = drawerForm.regular_price.trim() ? parseFloat(drawerForm.regular_price) : null
    if (Number.isNaN(sellingPrice) || (regularPrice !== null && Number.isNaN(regularPrice))) {
      showToast('价格格式不正确')
      return false
    }
    setDrawerSaving(true)
    try {
      await productsAPI.update(drawerProductId, {
        title_en: drawerForm.title_en.trim(),
        title_ar: drawerForm.title_ar.trim(),
        short_description: drawerForm.short_description.trim(),
        selling_price: sellingPrice,
        regular_price: regularPrice,
        region: drawerForm.region,
        primary_category: drawerForm.primary_category ? parseInt(drawerForm.primary_category) : null,
        is_active: drawerForm.is_active,
        is_featured: drawerForm.is_featured,
        audience_tags: drawerForm.audience_tags,
      })
      setDrawerInitialForm(drawerForm)
      showToast('已保存')
      loadProducts()
      loadStats()
      return true
    } catch {
      showToast('保存失败')
      return false
    } finally {
      setDrawerSaving(false)
    }
  }

  const saveDrawerAndClose = async () => {
    const ok = await persistDrawer()
    if (!ok) return
    setDrawerOpen(false)
  }

  const saveDrawerAndNext = async () => {
    if (!drawerProductId) return
    const currentIndex = products.findIndex((p) => p.id === drawerProductId)
    const nextProduct = currentIndex >= 0 ? products[currentIndex + 1] : null
    const ok = await persistDrawer()
    if (!ok) return
    if (!nextProduct) {
      showToast('当前页已处理到最后一条')
      setDrawerOpen(false)
      return
    }
    initDrawerForm(nextProduct)
    setDrawerOpen(true)
  }

  // ── Stats quick-filters ──
  const handleStatClick = (key: string) => {
    const map: Record<string, Partial<Filters>> = {
      active: { is_active: 'true', is_featured: '', review_status: '', category: '', region: '' },
      inactive: { is_active: 'false', is_featured: '', review_status: '', category: '', region: '' },
      uncategorized: { uncategorized: true, review_status: '', category: '', is_active: '', region: '' },
    }
    if (map[key]) {
      setFilters({ ...DEFAULT_FILTERS, ...map[key] })
    }
    setPage(1)
  }

  // ── Product actions ──
  const handleToggleActive = async (p: MasterSKU) => {
    try {
      await productsAPI.update(p.id, { is_active: !p.is_active })
      showToast(p.is_active ? '已下架' : '已上架')
      loadProducts()
      loadStats()
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleFeatured = async (p: MasterSKU) => {
    try {
      await productsAPI.update(p.id, { is_featured: !p.is_featured })
      showToast(p.is_featured ? '已取消精选' : '已设为精选')
      loadProducts()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (p: MasterSKU) => {
    if (!confirm(`确认删除商品 ${p.master_code}？此操作不可撤销。`)) return
    try {
      await productsAPI.delete(p.id)
      showToast('已删除')
      loadProducts()
      loadStats()
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpgradeCode = async (p: MasterSKU) => {
    try {
      const res = await productsAPI.upgradCode(p.id)
      showToast(`编码已升级: ${res.data.old_code} → ${res.data.new_code}`)
      loadProducts()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '升级失败'
      showToast(msg)
    }
  }

  const handleCopyWA = (p: MasterSKU, full: boolean) => {
    copyText(full ? buildWAFull(p) : buildWASimple(p))
    showToast('WA素材已复制')
  }

  // ── Batch actions ──
  const getBulkPayloadBase = () =>
    selectAll
      ? { filter: buildFilterObj() }
      : { ids: Array.from(selectedIds) }

  const buildFilterObj = () => {
    const f: Record<string, unknown> = { search: debouncedSearch }
    if (filters.category) f.primary_category = filters.category
    if (filters.region) f.region = filters.region
    if (filters.is_active) f.is_active = filters.is_active
    if (filters.is_featured) f.is_featured = filters.is_featured
    if (filters.review_status) f.review_status = filters.review_status
    if (filters.audience_tags.length > 0) f.audience_tags = filters.audience_tags
    if (filters.uncategorized) f.uncategorized = true
    if (filters.missing_title_ar) f.missing_title_ar = true
    if (filters.missing_image) f.missing_image = true
    return f
  }

  const runBulkAction = async (
    action: 'activate' | 'deactivate' | 'delete',
    label: string
  ) => {
    if (action === 'delete' && !confirm(`确认批量删除 ${selectionCount} 件商品？`)) return
    setBatchLoading(true)
    try {
      const res = await productsAPI.bulkAction({ ...getBulkPayloadBase(), action })
      showToast(`${label}成功，影响 ${res.data.affected} 件`)
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
      loadStats()
    } catch (e) {
      console.error(e)
    } finally {
      setBatchLoading(false)
    }
  }

  const runBulkSetCategory = async () => {
    if (!batchCategoryId) return
    setBatchLoading(true)
    try {
      const res = await productsAPI.bulkAction({
        ...getBulkPayloadBase(),
        action: 'set_category',
        params: { category_id: parseInt(batchCategoryId) },
      })
      showToast(`品类已更新，影响 ${res.data.affected} 件`)
      setBatchCategoryOpen(false)
      setBatchCategoryId('')
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
    } catch (e) {
      console.error(e)
    } finally {
      setBatchLoading(false)
    }
  }

  const runBulkSetRegion = async () => {
    if (!batchRegion) return
    setBatchLoading(true)
    try {
      const res = await productsAPI.bulkAction({
        ...getBulkPayloadBase(),
        action: 'set_region',
        params: { region: batchRegion },
      })
      showToast(`区域已更新，影响 ${res.data.affected} 件`)
      setBatchRegionOpen(false)
      setBatchRegion('')
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
    } catch (e) {
      console.error(e)
    } finally {
      setBatchLoading(false)
    }
  }

  const runBulkSubmitReview = async () => {
    setBatchLoading(true)
    try {
      const res = await productsAPI.bulkAction({
        ...getBulkPayloadBase(),
        action: 'submit_review',
      })
      showToast(`批量提交审核完成，提交 ${res.data.submitted} / 影响 ${res.data.affected}`)
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
      loadStats()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '批量提交审核失败'
      showToast(msg)
    } finally {
      setBatchLoading(false)
    }
  }

  const runBulkAudienceTags = async () => {
    if (!batchAudienceTags.length) return
    setBatchLoading(true)
    try {
      const action = batchAudienceMode === 'add' ? 'add_audience_tags' : 'remove_audience_tags'
      const res = await productsAPI.bulkAction({
        ...getBulkPayloadBase(),
        action,
        params: { tags: batchAudienceTags },
      })
      showToast(`受众标签已${batchAudienceMode === 'add' ? '新增' : '移除'}，影响 ${res.data.affected} 件`)
      setBatchAudienceOpen(false)
      setBatchAudienceTags([])
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '批量标签操作失败'
      showToast(msg)
    } finally {
      setBatchLoading(false)
    }
  }

  const runBulkOperationalTags = async () => {
    if (!batchOperationalTagNames.length) return
    setBatchLoading(true)
    try {
      const action = batchOperationalMode === 'add' ? 'add_operational_tags' : 'remove_operational_tags'
      const res = await productsAPI.bulkAction({
        ...getBulkPayloadBase(),
        action,
        params: { tag_names: batchOperationalTagNames },
      })
      showToast(`运营标签已${batchOperationalMode === 'add' ? '新增' : '移除'}，影响 ${res.data.affected} 件`)
      setBatchOperationalOpen(false)
      setBatchOperationalTagNames([])
      setSelectedIds(new Set())
      setSelectAll(false)
      loadProducts()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '批量标签操作失败'
      showToast(msg)
    } finally {
      setBatchLoading(false)
    }
  }

  const availableOperationalTagNames =
    operationalTags.length > 0 ? operationalTags.map((t) => t.name) : DEFAULT_OPERATIONAL_TAGS

  const handleBulkCopyWA = () => {
    const selected = products.filter((p) => selectedIds.has(p.id))
    if (!selected.length) return
    const text = selected.map((p) => buildWASimple(p)).join('\n─────────\n')
    copyText(text)
    showToast(`已复制 ${selected.length} 件商品的WA素材`)
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const drawerProduct = products.find((p) => p.id === drawerProductId) ?? null

  // ── Render ──
  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">商品管理</h1>
          <p className="text-neutral-500 text-sm mt-0.5">共 {count} 个 SKU</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden md:flex rounded-lg border border-neutral-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'list' ? 'bg-violet-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'card' ? 'bg-violet-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={() => { loadProducts(); loadStats() }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport} disabled={exporting} title="导出 CSV">
            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setImportOpen(true)} title="导入 CSV">
            <Upload className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/products/entry')}>
            <Plus className="h-4 w-4 mr-1.5" />
            录入商品
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-100 border border-neutral-200 w-fit">
          {WORKFLOW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => applyWorkflowTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                workflowTab === tab.key
                  ? 'bg-white text-violet-700 shadow-sm border border-violet-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={showAllWorkflowStatuses}
          >
            查看全部状态
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4 mr-1.5" />
                动态列
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {DYNAMIC_COLUMNS.map((column) => {
                const selected = visibleColumns.includes(column.key)
                return (
                  <DropdownMenuItem key={column.key} onClick={() => toggleColumn(column.key)}>
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                      {selected ? <Check className="h-3.5 w-3.5 text-violet-600" /> : null}
                    </span>
                    {column.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          <StatCard label="全部" value={stats.total} active={!hasActiveFilters} onClick={resetFilters} />
          <StatCard label="上架" value={stats.active} active={filters.is_active === 'true'} color="text-green-600" onClick={() => handleStatClick('active')} />
          <StatCard label="下架" value={stats.inactive} active={filters.is_active === 'false'} color="text-neutral-500" onClick={() => handleStatClick('inactive')} />
          <StatCard label="未分类" value={stats.uncategorized} active={!!filters.uncategorized} color="text-orange-500" onClick={() => handleStatClick('uncategorized')} />
          <StatCard label="缺阿语" value={stats.missing_title_ar} active={!!filters.missing_title_ar} color="text-red-500" onClick={() => { setFilters({ ...DEFAULT_FILTERS, missing_title_ar: true }); setPage(1) }} />
          <StatCard label="缺图片" value={stats.missing_image} active={!!filters.missing_image} color="text-red-500" onClick={() => { setFilters({ ...DEFAULT_FILTERS, missing_image: true }); setPage(1) }} />
        </div>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3">
          {/* 移动端：搜索框 + 展开按钮 */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="编码、名称搜索..."
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
              />
            </div>
            <button
              onClick={() => setFilterExpanded((v) => !v)}
              className={cn(
                'md:hidden flex items-center gap-1 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
                filterExpanded || hasActiveFilters
                  ? 'border-violet-400 text-violet-600 bg-violet-50'
                  : 'border-neutral-200 text-neutral-600 bg-white'
              )}
            >
              筛选{hasActiveFilters ? ' ·' : ''}
            </button>
            {/* 桌面端始终展示其余筛选 */}
            <div className="hidden md:flex flex-wrap gap-2 items-center flex-1">
              <Select
                value={filters.category || '__all__'}
                onValueChange={(v) => setFilter('category', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue placeholder="全部品类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部品类</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name_zh || c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.region || '__all__'}
                onValueChange={(v) => setFilter('region', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[100px] text-sm">
                  <SelectValue placeholder="全部区域" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部区域</SelectItem>
                  <SelectItem value="u">UAE</SelectItem>
                  <SelectItem value="t">Thailand</SelectItem>
                  <SelectItem value="a">All</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.is_active || '__all__'}
                onValueChange={(v) => setFilter('is_active', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[100px] text-sm">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部状态</SelectItem>
                  <SelectItem value="true">上架</SelectItem>
                  <SelectItem value="false">下架</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.is_featured || '__all__'}
                onValueChange={(v) => setFilter('is_featured', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[90px] text-sm">
                  <SelectValue placeholder="精选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  <SelectItem value="true">精选</SelectItem>
                  <SelectItem value="false">非精选</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.review_status || '__all__'}
                onValueChange={(v) => setFilter('review_status', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[110px] text-sm">
                  <SelectValue placeholder="审核状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部审核</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending_review">待审核</SelectItem>
                  <SelectItem value="publishable">可发布</SelectItem>
                  <SelectItem value="inactive_delisted">已下架</SelectItem>
                </SelectContent>
              </Select>

              {Object.entries(AUDIENCE_TAG_LABELS).map(([tag, label]) => (
                <button
                  key={tag}
                  onClick={() => toggleAudienceTag(tag)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                    filters.audience_tags.includes(tag)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                  )}
                >
                  {label}
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 ml-auto"
                >
                  <X className="h-3 w-3" /> 清空筛选
                </button>
              )}
            </div>
          </div>

          {/* 移动端展开面板 */}
          {filterExpanded && (
            <div className="md:hidden mt-3 flex flex-wrap gap-2 max-h-[45vh] overflow-y-auto pr-1">
              <Select
                value={filters.category || '__all__'}
                onValueChange={(v) => setFilter('category', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[130px] text-sm">
                  <SelectValue placeholder="全部品类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部品类</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name_zh || c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.region || '__all__'}
                onValueChange={(v) => setFilter('region', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[100px] text-sm">
                  <SelectValue placeholder="全部区域" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部区域</SelectItem>
                  <SelectItem value="u">UAE</SelectItem>
                  <SelectItem value="t">Thailand</SelectItem>
                  <SelectItem value="a">All</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.is_active || '__all__'}
                onValueChange={(v) => setFilter('is_active', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[100px] text-sm">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部状态</SelectItem>
                  <SelectItem value="true">上架</SelectItem>
                  <SelectItem value="false">下架</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.is_featured || '__all__'}
                onValueChange={(v) => setFilter('is_featured', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[90px] text-sm">
                  <SelectValue placeholder="精选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  <SelectItem value="true">精选</SelectItem>
                  <SelectItem value="false">非精选</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.review_status || '__all__'}
                onValueChange={(v) => setFilter('review_status', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-[110px] text-sm">
                  <SelectValue placeholder="审核状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部审核</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending_review">待审核</SelectItem>
                  <SelectItem value="publishable">可发布</SelectItem>
                  <SelectItem value="inactive_delisted">已下架</SelectItem>
                </SelectContent>
              </Select>

              {Object.entries(AUDIENCE_TAG_LABELS).map(([tag, label]) => (
                <button
                  key={tag}
                  onClick={() => toggleAudienceTag(tag)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                    filters.audience_tags.includes(tag)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                  )}
                >
                  {label}
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
                >
                  <X className="h-3 w-3" /> 清空筛选
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table / Card View */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked && !allPageChecked }}
                        onChange={(e) => handleCheckAll(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                      />
                    </th>
                    <th className="w-12 px-2 py-2.5" />
                    <th className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs">
                      编码 / 名称
                    </th>
                    {visibleColumnSet.has('category') && (
                      <th className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs w-[110px]">
                        品类
                      </th>
                    )}
                    {visibleColumnSet.has('price') && (
                      <th
                        className="px-3 py-2.5 text-right font-medium text-neutral-600 text-xs w-[130px] cursor-pointer select-none"
                        onClick={() => handleSort('selling_price')}
                      >
                        <span className="flex items-center justify-end gap-1">
                          价格 <SortIcon field="selling_price" />
                        </span>
                      </th>
                    )}
                    {visibleColumnSet.has('status') && (
                      <th className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs w-[90px]">
                        状态
                      </th>
                    )}
                    {visibleColumnSet.has('featured') && (
                      <th className="px-3 py-2.5 text-center font-medium text-neutral-600 text-xs w-10">
                        精选
                      </th>
                    )}
                    {visibleColumnSet.has('region') && (
                      <th className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs w-[60px]">
                        区域
                      </th>
                    )}
                    {visibleColumnSet.has('updated') && (
                      <th
                        className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs w-[100px] cursor-pointer select-none"
                        onClick={() => handleSort('updated_at')}
                      >
                        <span className="flex items-center gap-1">
                          更新 <SortIcon field="updated_at" />
                        </span>
                      </th>
                    )}
                    {visibleColumnSet.has('ai_assisted') && (
                      <th className="px-3 py-2.5 text-left font-medium text-neutral-600 text-xs w-[80px]">
                        AI 辅助
                      </th>
                    )}
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4 + visibleColumns.length} className="px-4 py-12 text-center text-neutral-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                        加载中...
                      </td>
                    </tr>
                  )}
                  {!loading && products.length === 0 && (
                    <tr>
                      <td colSpan={4 + visibleColumns.length} className="px-4 py-12 text-center text-neutral-400">
                        暂无数据
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    products.map((p) => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        checked={selectedIds.has(p.id)}
                        visibleColumns={visibleColumnSet}
                        onCheck={handleCheck}
                        onView={(id) => navigate(`/products/${id}`)}
                        onEdit={openEditDrawer}
                        onToggleActive={handleToggleActive}
                        onToggleFeatured={handleToggleFeatured}
                        onDelete={handleDelete}
                        onCopyWA={handleCopyWA}
                        onUpgradeCode={handleUpgradeCode}
                        sortField={sortField}
                        inlinePriceEditId={inlinePriceEditId}
                        inlinePriceValue={inlinePriceValue}
                        onPriceDoubleClick={handlePriceDoubleClick}
                        onPriceChange={setInlinePriceValue}
                        onPriceSave={handlePriceSave}
                        onPriceCancel={handlePriceCancel}
                      />
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
                <span className="text-sm text-neutral-500">
                  第 {page} / {totalPages} 页，共 {count} 条
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    return (
                      <Button
                        key={pg}
                        variant={pg === page ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(pg)}
                      >
                        {pg}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {loading && (
            <div className="col-span-full py-12 text-center text-neutral-400">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          )}
          {!loading && products.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-400">暂无数据</div>
          )}
          {!loading &&
            products.map((p) => {
              const thumb = p.image_urls?.[0]
              const selling = formatPrice(p.selling_price)
              const regular = formatPrice(p.regular_price)
              const cost = formatPrice(p.best_cost_price)
              return (
                <div
                  key={p.id}
                  className={cn(
                    'bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow cursor-pointer group',
                    selectedIds.has(p.id) ? 'border-violet-400 shadow-sm' : 'border-neutral-200'
                  )}
                >
                  {/* Image */}
                  <div
                    className="relative aspect-square bg-neutral-100"
                    onClick={() => navigate(`/products/${p.id}`)}
                  >
                    {thumb ? (
                      <img src={thumb} alt={p.title_en} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="h-8 w-8 text-neutral-300" />
                      </div>
                    )}
                    {/* Checkbox overlay */}
                    <div
                      className="absolute top-2 left-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => handleCheck(p.id, e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                      />
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={p.is_active ? 'success' : 'secondary'}
                        className="text-[10px] px-1.5"
                      >
                        {p.is_active ? '上架' : '下架'}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <div className="font-mono text-[10px] font-semibold text-violet-700">
                      {p.master_code}
                    </div>
                    <div className="text-xs font-medium text-neutral-900 truncate mt-0.5">
                      {p.title_en}
                    </div>
                    {/* Prices */}
                    <div className="mt-1.5 space-y-0.5">
                      <div className="font-semibold text-sm text-neutral-900">
                        {selling ? `${selling} AED` : '—'}
                      </div>
                      {regular && regular !== selling && (
                        <div className="text-[11px] text-neutral-400 line-through">{regular} AED</div>
                      )}
                      {cost && <div className="text-[11px] text-neutral-400">成本 {cost}</div>}
                    </div>
                    {/* Availability */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full', AVAIL_COLORS[p.availability] ?? 'bg-neutral-300')} />
                      <span className="text-[11px] text-neutral-500">{AVAIL_LABELS[p.availability] ?? p.availability}</span>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => openEditDrawer(p)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> 编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-neutral-500 hover:text-violet-600"
                        onClick={() => handleCopyWA(p, false)}
                        title="复制WA素材"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-neutral-500 hover:text-violet-600"
                        onClick={() => navigate(`/products/${p.id}`)}
                        title="详情"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Batch Action Floating Bar */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-neutral-900/30 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm font-medium">已选 {selectionCount} 件</span>
            {!selectAll && selectedIds.size < count && (
              <button
                onClick={() => setSelectAll(true)}
                className="text-xs text-violet-300 hover:text-violet-200 underline"
              >
                全选当前 {count} 件
              </button>
            )}
          </div>
          <div className="w-px h-5 bg-neutral-700" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => runBulkAction('activate', '批量上架')}
          >
            批量上架
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => runBulkAction('deactivate', '批量下架')}
          >
            批量下架
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => setBatchCategoryOpen(true)}
          >
            改品类
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => setBatchRegionOpen(true)}
          >
            改区域
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={runBulkSubmitReview}
          >
            提交审核
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => setBatchAudienceOpen(true)}
          >
            受众标签
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => setBatchOperationalOpen(true)}
          >
            运营标签
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-neutral-800"
            onClick={handleBulkCopyWA}
          >
            复制WA
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-neutral-800"
            disabled={batchLoading}
            onClick={() => runBulkAction('delete', '批量删除')}
          >
            删除
          </Button>
          <div className="w-px h-5 bg-neutral-700" />
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectAll(false) }}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Dialog
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDrawer()
            return
          }
          setDrawerOpen(true)
        }}
      >
        <DialogContent className="!left-auto !right-0 !top-0 !translate-x-0 !translate-y-0 h-full w-[96vw] sm:w-[860px] max-w-none rounded-none border-l overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-base">商品宽抽屉编辑</DialogTitle>
                <p className="mt-1 text-xs text-neutral-500">
                  {drawerProduct ? `${drawerProduct.master_code} · ${drawerProduct.title_en}` : '未选择商品'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={closeEditDrawer}>
                  关闭
                </Button>
                <Button size="sm" variant="outline" onClick={() => requestSave('close')} disabled={drawerSaving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  保存
                </Button>
                <Button size="sm" onClick={() => requestSave('next')} disabled={drawerSaving}>
                  <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                  保存并下一条
                </Button>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
              <button
                onClick={() => setDrawerTab('ai')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  drawerTab === 'ai' ? 'bg-white border border-neutral-200 text-violet-700' : 'text-neutral-600'
                )}
              >
                AI 提取校对
              </button>
              <button
                onClick={() => setDrawerTab('basic')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  drawerTab === 'basic' ? 'bg-white border border-neutral-200 text-violet-700' : 'text-neutral-600'
                )}
              >
                基础信息
              </button>
              <button
                onClick={() => setDrawerTab('pricing')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  drawerTab === 'pricing' ? 'bg-white border border-neutral-200 text-violet-700' : 'text-neutral-600'
                )}
              >
                价格库存
              </button>
              <button
                onClick={() => setDrawerTab('tags')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  drawerTab === 'tags' ? 'bg-white border border-neutral-200 text-violet-700' : 'text-neutral-600'
                )}
              >
                标签状态
              </button>
              <button
                onClick={() => setDrawerTab('media')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  drawerTab === 'media' ? 'bg-white border border-neutral-200 text-violet-700' : 'text-neutral-600'
                )}
              >
                图文信息
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {drawerTab === 'ai' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-neutral-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-800">AI 提取区</div>
                    <Button size="sm" variant="outline" onClick={runDrawerOptimize} disabled={drawerOptimizeLoading}>
                      <WandSparkles className="h-3.5 w-3.5 mr-1.5" />
                      {drawerOptimizeLoading ? '优化中...' : '文案优化'}
                    </Button>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setDrawerOCRFiles(files.slice(0, 5))
                    }}
                    className="block w-full text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                  />
                  <div className="text-xs text-neutral-500">支持最多 5 个文件（图片/PDF）</div>
                  <Button size="sm" onClick={runDrawerOCR} disabled={drawerOCRLoading || !drawerOCRFiles.length}>
                    {drawerOCRLoading ? '识别中...' : 'AI 识别图片/PDF'}
                  </Button>
                  {drawerOCRResult && (
                    <div className="rounded-lg border border-violet-200 bg-white p-3 space-y-1.5 text-xs text-neutral-700">
                      <div><span className="text-neutral-400">标题：</span>{drawerOCRResult.title_en || '—'}</div>
                      <div><span className="text-neutral-400">主品类：</span>{drawerOCRResult.primary_category || '—'}</div>
                      <div><span className="text-neutral-400">说明：</span>{drawerOCRResult.short_description || '—'}</div>
                      <Button size="sm" variant="outline" onClick={applyOCRToDrawer}>应用到人工补充区</Button>
                    </div>
                  )}
                  {drawerOptimizePreview && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5 text-xs text-emerald-800">
                      <div className="font-medium">优化建议</div>
                      <div>{drawerOptimizePreview.title_en}</div>
                      <Button size="sm" variant="outline" onClick={applyOptimizePreview}>采用优化文案</Button>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
                  <div className="text-sm font-semibold text-neutral-800">人工补充区（可直接编辑）</div>
                  <div className="space-y-1.5">
                    <Label>英文标题</Label>
                    <Input
                      ref={drawerTitleInputRef}
                      value={drawerForm.title_en}
                      onChange={(e) => updateDrawerField('title_en', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>短描述（条目化）</Label>
                    <textarea
                    ref={drawerShortDescRef}
                      value={drawerForm.short_description}
                      onChange={(e) => updateDrawerField('short_description', e.target.value)}
                      className="min-h-24 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SHORT_DESC_QUICK_ITEMS.map((item) => (
                      <Button key={item} size="sm" variant="outline" onClick={() => appendShortDescItem(item)}>
                        + {item}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'basic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>英文标题</Label>
                  <Input
                    ref={drawerTitleInputRef}
                    value={drawerForm.title_en}
                    onChange={(e) => updateDrawerField('title_en', e.target.value)}
                  />
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600 space-y-1">
                    {TITLE_HINTS.map((hint) => (
                      <div key={hint}>- {hint}</div>
                    ))}
                  </div>
                  {titleIssues.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 space-y-1">
                      {titleIssues.map((issue) => (
                        <div key={issue}>⚠ {issue}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>阿语标题</Label>
                  <Input value={drawerForm.title_ar} onChange={(e) => updateDrawerField('title_ar', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>主品类</Label>
                  <Select value={drawerForm.primary_category || '__none__'} onValueChange={(v) => updateDrawerField('primary_category', v === '__none__' ? '' : v)}>
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
                <div className="space-y-1.5">
                  <Label>区域</Label>
                  <Select value={drawerForm.region} onValueChange={(v) => updateDrawerField('region', v as 'u' | 't' | 'a')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="u">UAE</SelectItem>
                      <SelectItem value="t">Thailand</SelectItem>
                      <SelectItem value="a">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {drawerTab === 'pricing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>售价（AED）</Label>
                  <Input type="number" value={drawerForm.selling_price} onChange={(e) => updateDrawerField('selling_price', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>划线价（AED）</Label>
                  <Input type="number" value={drawerForm.regular_price} onChange={(e) => updateDrawerField('regular_price', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>当前成本价（只读）</Label>
                  <Input value={drawerProduct?.best_cost_price ?? ''} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>可售状态（只读）</Label>
                  <Input value={drawerProduct ? AVAIL_LABELS[drawerProduct.availability] ?? drawerProduct.availability : ''} disabled />
                </div>
              </div>
            )}

            {drawerTab === 'tags' && (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={drawerForm.is_active}
                      onChange={(e) => updateDrawerField('is_active', e.target.checked)}
                    />
                    上架
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={drawerForm.is_featured}
                      onChange={(e) => updateDrawerField('is_featured', e.target.checked)}
                    />
                    精选
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>受众标签</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(AUDIENCE_TAG_LABELS).map(([tag, label]) => {
                      const selected = drawerForm.audience_tags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            updateDrawerField(
                              'audience_tags',
                              selected
                                ? drawerForm.audience_tags.filter((item) => item !== tag)
                                : [...drawerForm.audience_tags, tag]
                            )
                          }
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            selected
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'media' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>短描述</Label>
                  <textarea
                    ref={drawerShortDescRef}
                    value={drawerForm.short_description}
                    onChange={(e) => updateDrawerField('short_description', e.target.value)}
                    className="min-h-28 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>短描述条目组件（快速编辑）</Label>
                  <div className="space-y-2">
                    {shortDescItems.map((item, idx) => (
                      <div key={`${idx}-${item}`} className="flex items-center gap-2">
                        <Input
                          value={item}
                          onChange={(e) => updateShortDescItem(idx, e.target.value)}
                          className="h-8"
                        />
                        <Button size="sm" variant="outline" onClick={() => removeShortDescItem(idx)}>
                          删除
                        </Button>
                      </div>
                    ))}
                    {shortDescItems.length === 0 && (
                      <div className="text-xs text-neutral-400">暂无条目，可用下方快捷项快速补充。</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SHORT_DESC_QUICK_ITEMS.map((item) => (
                      <Button key={item} size="sm" variant="outline" onClick={() => appendShortDescItem(item)}>
                        + {item}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>图片预览</Label>
                  {drawerProduct?.image_urls?.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {drawerProduct.image_urls.map((url) => (
                        <div key={url} className="rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                          <img src={url} alt="preview" className="w-full h-28 object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-400">暂无图片</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={riskConfirmOpen} onOpenChange={setRiskConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              高危字段强确认
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-neutral-600">检测到以下风险，请确认后再提交：</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5 text-sm text-amber-900">
              {getRiskWarnings().map((warning) => (
                <div key={warning}>- {warning}</div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={riskConfirmed}
                onChange={(e) => setRiskConfirmed(e.target.checked)}
              />
              我已确认风险并继续保存
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskConfirmOpen(false)}>取消</Button>
            <Button onClick={proceedRiskConfirmedSave} disabled={!riskConfirmed}>确认继续</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Category Modal */}
      <Dialog open={batchCategoryOpen} onOpenChange={setBatchCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量改品类</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-neutral-500 mb-3">将 {selectionCount} 件商品的品类改为：</p>
            <Select value={batchCategoryId} onValueChange={setBatchCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标品类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name_zh || c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategoryOpen(false)}>取消</Button>
            <Button onClick={runBulkSetCategory} disabled={!batchCategoryId || batchLoading}>
              {batchLoading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Region Modal */}
      <Dialog open={batchRegionOpen} onOpenChange={setBatchRegionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量改区域</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-neutral-500 mb-3">将 {selectionCount} 件商品的区域改为：</p>
            <Select value={batchRegion} onValueChange={setBatchRegion}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标区域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="u">UAE</SelectItem>
                <SelectItem value="t">Thailand</SelectItem>
                <SelectItem value="a">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchRegionOpen(false)}>取消</Button>
            <Button onClick={runBulkSetRegion} disabled={!batchRegion || batchLoading}>
              {batchLoading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Audience Tags Modal */}
      <Dialog open={batchAudienceOpen} onOpenChange={setBatchAudienceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量受众标签</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-neutral-500">对 {selectionCount} 件商品执行受众标签操作：</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={batchAudienceMode === 'add' ? 'default' : 'outline'}
                onClick={() => setBatchAudienceMode('add')}
              >
                批量新增
              </Button>
              <Button
                type="button"
                variant={batchAudienceMode === 'remove' ? 'default' : 'outline'}
                onClick={() => setBatchAudienceMode('remove')}
              >
                批量移除
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(AUDIENCE_TAG_LABELS).map(([tag, label]) => {
                const selected = batchAudienceTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setBatchAudienceTags((prev) =>
                        selected ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      selected
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAudienceOpen(false)}>取消</Button>
            <Button onClick={runBulkAudienceTags} disabled={!batchAudienceTags.length || batchLoading}>
              {batchLoading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Operational Tags Modal */}
      <Dialog open={batchOperationalOpen} onOpenChange={setBatchOperationalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量运营标签</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-neutral-500">对 {selectionCount} 件商品执行运营标签操作：</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={batchOperationalMode === 'add' ? 'default' : 'outline'}
                onClick={() => setBatchOperationalMode('add')}
              >
                批量新增
              </Button>
              <Button
                type="button"
                variant={batchOperationalMode === 'remove' ? 'default' : 'outline'}
                onClick={() => setBatchOperationalMode('remove')}
              >
                批量移除
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableOperationalTagNames.map((name) => {
                const selected = batchOperationalTagNames.includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setBatchOperationalTagNames((prev) =>
                        selected ? prev.filter((t) => t !== name) : [...prev, name]
                      )
                    }
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      selected
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
                    )}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOperationalOpen(false)}>取消</Button>
            <Button onClick={runBulkOperationalTags} disabled={!batchOperationalTagNames.length || batchLoading}>
              {batchLoading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Modal */}
      <Dialog open={importOpen} onOpenChange={(v) => { if (!v) closeImport() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导入 CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-neutral-500">
              上传与导出格式一致的 CSV 文件。
              <strong> 已存在的 master_code 会被更新，不存在的会计入失败明细，但不会中断整批导入。</strong>
            </p>

            {/* 格式说明 */}
            <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-600 font-mono leading-relaxed">
              master_code, title_en, title_ar, selling_price,<br />
              regular_price, region, is_active, is_featured,<br />
              audience_tags, image_urls, primary_category
            </div>

            {/* 文件选择 */}
            <div className="space-y-1.5">
              <Label>选择文件</Label>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null)
                  setImportResult(null)
                }}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
              />
              {importFile && (
                <p className="text-xs text-neutral-400">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>

            {/* 导入结果 */}
            {importResult && (
              <div className={cn(
                'rounded-lg p-3 text-sm',
                (importResult.failed_count ?? importResult.errors.length) > 0
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-green-50 border border-green-200'
              )}>
                <div className="flex items-center gap-2 font-medium mb-1">
                  {(importResult.failed_count ?? importResult.errors.length) > 0 ? (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  导入完成
                </div>
                <div className="text-xs space-y-0.5 text-neutral-600">
                  <div>✅ 成功：<strong>{importResult.success_count ?? importResult.updated}</strong> 条</div>
                  <div>❌ 失败：<strong>{importResult.failed_count ?? importResult.errors.length}</strong> 条</div>
                  {importResult.skipped > 0 && (
                    <div>⏭ 其它跳过：<strong>{importResult.skipped}</strong> 条</div>
                  )}
                  {(importResult.failed_count ?? importResult.errors.length) > 0 && (
                    <div className="text-red-600 mt-1">
                      ⚠ 失败明细：
                      <ul className="list-disc ml-4 mt-0.5">
                        {(importResult.failed_rows ?? []).length > 0 ? (
                          <>
                            {(importResult.failed_rows ?? []).slice(0, 5).map((row, i) => (
                              <li key={i}>
                                行{row.line_no}
                                {row.master_code ? `（${row.master_code}）` : ''}：{row.reason}
                              </li>
                            ))}
                            {(importResult.failed_rows ?? []).length > 5 && (
                              <li>...还有 {(importResult.failed_rows ?? []).length - 5} 条</li>
                            )}
                          </>
                        ) : (
                          <>
                            {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                            {importResult.errors.length > 5 && <li>...还有 {importResult.errors.length - 5} 条</li>}
                          </>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImport}>
              {importResult ? '关闭' : '取消'}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="gap-1.5"
              >
                {importing ? (
                  <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> 导入中...</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> 开始导入</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 right-6 z-50 bg-neutral-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  )
}
