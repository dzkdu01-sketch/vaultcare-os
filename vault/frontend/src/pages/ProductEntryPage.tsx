import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiAPI, productsAPI, categoriesAPI, operationalTagsAPI } from '@/api/endpoints'
import type { Category, OperationalTag } from '@/types'
import { AUDIENCE_TAG_OPTIONS, UNIFIED_ENTRY_STEPS, UNIFIED_STEP_HINTS } from '@/constants/productForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  Sparkles,
  Check,
  X,
  ImagePlus,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
} from 'lucide-react'

// ─── 类型 ────────────────────────────────────────────────────────────────────

interface AIResult {
  title_en: string
  title_ar: string
  short_description: string
  description: string
  primary_category: string
  audience_tags: string[]
  operational_tags: string[]
  confidence_score: number
  notes: string
  degraded?: boolean
}

interface OptimizeResult {
  original: { title_en: string; description: string }
  optimized: { title_en: string; description: string }
  improvements: string[]
  quality_score: number
}

interface FormState {
  title_en: string
  title_ar: string
  title_th: string
  short_description: string
  description: string
  primary_category_id: string
  audience_tags: string[]
  operational_tag_ids: number[]
  regular_price: string
  selling_price: string
  region: 'u' | 't' | 'a'
  is_featured: boolean
  image_urls: string[]
}

// 运营标签预定义
const OPERATIONAL_TAG_OPTIONS = [
  { key: 'best_seller', label: '畅销', id: 1 },
  { key: 'high_value', label: '高值', id: 2 },
  { key: 'new_arrival', label: '新品', id: 3 },
]

const REGIONS = [
  { value: 'u', label: 'UAE (u)' },
  { value: 't', label: 'Thailand (t)' },
  { value: 'a', label: 'All (a)' },
]

// ─── 进度步骤组件 ─────────────────────────────────────────────────────────────

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${done ? 'bg-violet-100 text-violet-700' : active ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-neutral-100 text-neutral-400'}`}
            >
              {done ? <Check className="h-4 w-4" /> : <span>{idx}</span>}
              {label}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 transition-all ${step > idx ? 'bg-violet-400' : 'bg-neutral-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 置信度条 ─────────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-semibold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  )
}

// ─── 标签切换组件 ─────────────────────────────────────────────────────────────

function TagToggleGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Array<{ key: string; label: string; id?: number }>
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (tagKey: string) => {
    onChange(
      selected.includes(tagKey)
        ? selected.filter((t) => t !== tagKey)
        : [...selected, tagKey]
    )
  }
  return (
    <div>
      <Label className="text-sm text-neutral-500 mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => (
          <button
            key={tag.key}
            type="button"
            onClick={() => toggle(tag.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${selected.includes(tag.key)
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'}`}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function ProductEntryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [operationalTags, setOperationalTags] = useState<OperationalTag[]>([])
  const [form, setForm] = useState<FormState>({
    title_en: '',
    title_ar: '',
    title_th: '',
    short_description: '',
    description: '',
    primary_category_id: '',
    audience_tags: [],
    operational_tag_ids: [],
    regular_price: '',
    selling_price: '',
    region: 'u',
    is_featured: false,
    image_urls: [],
  })

  // 图片管理
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')

  // AI 功能状态
  const [analyzing, setAnalyzing] = useState(false)
  const [ocrResult, setOcrResult] = useState<AIResult | null>(null)
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false)
  const [optimizingText, setOptimizingText] = useState(false)
  const [generatingAr, setGeneratingAr] = useState(false)

  // 保存状态
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [aiAssisted, setAiAssisted] = useState<'none' | 'ocr' | 'optimize' | 'both'>('none')

  const dropRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const categorySelectRef = useRef<HTMLSelectElement>(null)
  const sellingPriceInputRef = useRef<HTMLInputElement>(null)

  // 初始化加载品类和标签
  useEffect(() => {
    Promise.all([
      categoriesAPI.list().then((res) => setCategories(res.data.results ?? res.data)),
      operationalTagsAPI.list().then((res) => setOperationalTags(res.data.results ?? res.data)),
    ]).catch(console.error)
  }, [])

  const isDegradedMode = !!(ocrResult?.degraded || (analyzing && files.length > 0))

  // ── 图片处理 ────────────────────────────────────────────────────────────────

  const addFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles)
      .filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
      .slice(0, 5 - files.length)
    if (!valid.length) return
    const updated = [...files, ...valid].slice(0, 5)
    setFiles(updated)
    valid.forEach((f) => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) =>
          setPreviews((p) => [...p, e.target?.result as string].slice(0, 5))
        reader.readAsDataURL(f)
      } else {
        // PDF 文件添加占位符
        setPreviews((p) => [...p, 'pdf-placeholder'].slice(0, 5))
      }
    })
  }

  const removeFile = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i))
    setPreviews((p) => p.filter((_, idx) => idx !== i))
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      addFiles(e.dataTransfer.files)
    },
    [files]
  )

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const res = await productsAPI.uploadImage(file)
      setForm((prev) => ({ ...prev, image_urls: [...prev.image_urls, res.data.url] }))
    } catch (err) {
      console.error('图片上传失败:', err)
      alert('图片上传失败')
    } finally {
      setUploadingImage(false)
    }
  }

  // ── OCR 识别 ────────────────────────────────────────────────────────────────

  const handleOCRAnalyze = async () => {
    if (!files.length) {
      setSaveError('请先上传至少 1 张图片')
      return
    }
    setAnalyzing(true)
    setSaveError('')
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('images', f))
      const res = await aiAPI.ocrAnalyze(fd)
      const data: AIResult = res.data
      setOcrResult(data)
      setOcrDialogOpen(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSaveError(msg || 'AI 识别失败，请稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmOCR = () => {
    if (!ocrResult) return
    const matchedCategory = categories.find(
      (c) => c.name_en === ocrResult.primary_category || c.name_zh === ocrResult.primary_category
    )
    const opTagIds = (ocrResult.operational_tags || [])
      .map((name) => operationalTags.find((tag) => tag.name === name)?.id)
      .filter((id): id is number => typeof id === 'number')

    setForm((prev) => ({
      ...prev,
      title_en: ocrResult.title_en || prev.title_en,
      title_ar: ocrResult.title_ar || prev.title_ar,
      short_description: ocrResult.short_description || prev.short_description,
      description: ocrResult.description || prev.description,
      primary_category_id: matchedCategory ? String(matchedCategory.id) : prev.primary_category_id,
      audience_tags:
        ocrResult.audience_tags && ocrResult.audience_tags.length > 0
          ? ocrResult.audience_tags
          : prev.audience_tags,
      operational_tag_ids: opTagIds.length > 0 ? opTagIds : prev.operational_tag_ids,
    }))
    setOcrDialogOpen(false)
    setOcrResult(null)
    setAiAssisted((prev) => (prev === 'optimize' ? 'both' : 'ocr'))
  }

  // ── 文案优化 ────────────────────────────────────────────────────────────────

  const handleOptimizeText = async () => {
    if (!form.title_en.trim()) {
      setSaveError('请先填写英文标题')
      return
    }
    setOptimizingText(true)
    setSaveError('')
    try {
      const res = await aiAPI.optimizeText({
        title_en: form.title_en,
        description: form.description,
      })
      setOptimizeResult(res.data)
      setOptimizeDialogOpen(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSaveError(msg || '文案优化失败，请稍后重试')
    } finally {
      setOptimizingText(false)
    }
  }

  const confirmOptimize = () => {
    if (!optimizeResult) return
    setForm((prev) => ({
      ...prev,
      title_en: optimizeResult.optimized.title_en,
      description: optimizeResult.optimized.description,
    }))
    setOptimizeDialogOpen(false)
    setOptimizeResult(null)
    setAiAssisted((prev) => (prev === 'ocr' ? 'both' : 'optimize'))
  }

  // ── 重新生成阿拉伯语 ─────────────────────────────────────────────────────────

  const handleRegenerateArabic = async () => {
    if (!form.title_en) return
    setGeneratingAr(true)
    try {
      const res = await aiAPI.generateArabic({ title_en: form.title_en, description: form.description })
      const data = res.data
      setForm((prev) => ({ ...prev, title_ar: data.title_ar || prev.title_ar }))
    } finally {
      setGeneratingAr(false)
    }
  }

  // ── 保存商品 ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.primary_category_id) {
      setSaveError('请选择主品类后再保存')
      return
    }
    if (!form.selling_price) {
      setSaveError('请填写实售价')
      return
    }
    if (!form.image_urls.length) {
      setSaveError('请至少上传 1 张图片')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await productsAPI.createManualDraft({
        title_en: form.title_en,
        title_ar: form.title_ar,
        title_th: form.title_th,
        short_description: form.short_description,
        description: form.description,
        primary_category: form.primary_category_id ? parseInt(form.primary_category_id) : null,
        region: form.region,
        selling_price: form.selling_price,
        regular_price: form.regular_price || null,
        audience_tags: form.audience_tags,
        operational_tag_ids: form.operational_tag_ids,
        image_urls: form.image_urls,
        is_featured: form.is_featured,
        ai_assisted: aiAssisted,
      })
      navigate(`/products/${res.data.id}?created=manual-draft`)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      setSaveError(typeof data === 'string' ? data : JSON.stringify(data) || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const f = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">录入商品</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            统一录入页面，AI 作为页面内增效工具
          </p>
        </div>
      </div>

      <StepIndicator step={step} steps={UNIFIED_ENTRY_STEPS} />
      <p className="text-sm text-neutral-500 -mt-4">{UNIFIED_STEP_HINTS[step]}</p>

      {/* ── Step 1: 基本信息 ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          {/* 区域选择 */}
          <div className="space-y-1.5">
            <Label>
              推送市场 (区域) <span className="text-red-400">*</span>
            </Label>
            <div className="flex gap-2">
              {REGIONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex-1 flex items-center justify-center px-2 py-2 rounded-lg border cursor-pointer transition-all text-xs font-medium
                      ${form.region === r.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:border-violet-300'}`}
                >
                  <input
                    type="radio"
                    name="region"
                    value={r.value}
                    checked={form.region === r.value}
                    onChange={() => setF('region', r.value as 'u' | 't' | 'a')}
                    className="sr-only"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* 英文标题 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                英文标题 <span className="text-red-400">*</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={handleOptimizeText}
                disabled={optimizingText || !form.title_en.trim()}
              >
                {optimizingText ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> 优化中</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> AI 优化文案</>
                )}
              </Button>
            </div>
            <Input
              ref={titleInputRef}
              value={form.title_en}
              onChange={f('title_en')}
              placeholder="Product title (English)"
            />
          </div>

          {/* 阿拉伯语标题 */}
          {(form.region === 'u' || form.region === 'a') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>阿拉伯语标题</Label>
                <button
                  type="button"
                  onClick={handleRegenerateArabic}
                  disabled={generatingAr || !form.title_en}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 transition-colors"
                >
                  {generatingAr ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  重新生成
                </button>
              </div>
              <Input
                value={form.title_ar}
                onChange={f('title_ar')}
                dir="rtl"
                placeholder="العنوان بالعربية"
                className="text-right font-arabic"
              />
            </div>
          )}

          {/* 泰语标题 */}
          {(form.region === 't' || form.region === 'a') && (
            <div className="space-y-1.5">
              <Label>泰语标题</Label>
              <Input
                value={form.title_th}
                onChange={f('title_th')}
                placeholder="ชื่อสินค้าภาษาไทย"
              />
            </div>
          )}

          {/* 主品类 */}
          <div className="space-y-1.5">
            <Label>
              主品类 <span className="text-red-400">*</span>
            </Label>
            <select
              ref={categorySelectRef}
              value={form.primary_category_id}
              onChange={f('primary_category_id')}
              className="w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">-- 选择品类 --</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name_zh || c.name_en}
                </option>
              ))}
            </select>
          </div>

          {/* 受众标签 */}
          <div className="space-y-1.5">
            <Label>受众标签</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_TAG_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      audience_tags: prev.audience_tags.includes(key)
                        ? prev.audience_tags.filter((t) => t !== key)
                        : [...prev.audience_tags, key],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                      ${form.audience_tags.includes(key)
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 运营标签 */}
          <div className="space-y-1.5">
            <Label>运营标签</Label>
            <div className="flex flex-wrap gap-2">
              {operationalTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      operational_tag_ids: prev.operational_tag_ids.includes(tag.id)
                        ? prev.operational_tag_ids.filter((t) => t !== tag.id)
                        : [...prev.operational_tag_ids, tag.id],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                      ${form.operational_tag_ids.includes(tag.id)
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'}`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* 图片上传 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>图片与说明书</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={handleOCRAnalyze}
                disabled={analyzing || files.length === 0}
              >
                {analyzing ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> 识别中</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> AI 识别图片</>
                )}
              </Button>
            </div>

            {/* 本地文件预览 */}
            {files.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200"
                  >
                    {src === 'pdf-placeholder' ? (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-xs font-bold">
                        PDF
                      </div>
                    ) : (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 已上传的 URL 列表 */}
            {form.image_urls.length > 0 && (
              <div className="space-y-1 mb-3">
                {form.image_urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 flex-shrink-0 rounded-md overflow-hidden bg-neutral-100 border flex items-center justify-center">
                      {url.toLowerCase().endsWith('.pdf') ? (
                        <span className="text-[10px] font-bold text-neutral-500">PDF</span>
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="flex-1 text-neutral-600 truncate font-mono">{url}</span>
                    <button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          image_urls: prev.image_urls.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center justify-center w-full h-20 px-4 transition bg-white border-2 border-dashed rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50
                    ${uploadingImage ? 'border-violet-400 bg-violet-50' : 'border-neutral-200'}`}
              >
                <span className="flex items-center space-x-2">
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-neutral-400" />
                  )}
                  <span className="font-medium text-neutral-500 text-sm">
                    {uploadingImage ? '上传中...' : '拖拽或点击上传本地图片 / PDF'}
                  </span>
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      addFiles([file])
                      handleImageUpload(file)
                    }
                  }}
                  disabled={uploadingImage}
                />
              </label>

              <div className="flex gap-2">
                <Input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const url = newImageUrl.trim()
                      if (url && !form.image_urls.includes(url)) {
                        setF('image_urls', [...form.image_urls, url])
                        setNewImageUrl('')
                      }
                    }
                  }}
                  placeholder="或粘贴网络 URL，按 Enter 添加"
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 shrink-0"
                  onClick={() => {
                    const url = newImageUrl.trim()
                    if (url && !form.image_urls.includes(url)) {
                      setF('image_urls', [...form.image_urls, url])
                      setNewImageUrl('')
                    }
                  }}
                  disabled={!newImageUrl.trim()}
                >
                  添加
                </Button>
              </div>
            </div>
          </div>

          {/* 简短描述 */}
          <div className="space-y-1.5">
            <Label>简短描述</Label>
            <Input
              value={form.short_description}
              onChange={f('short_description')}
              placeholder="商品简短描述（最多 200 字）"
              maxLength={200}
            />
            <p className="text-xs text-neutral-400 text-right">
              {form.short_description.length}/200
            </p>
          </div>

          {/* 详细描述 */}
          <div className="space-y-1.5">
            <Label>详细描述</Label>
            <Textarea
              value={form.description}
              onChange={f('description')}
              rows={4}
              placeholder="完整商品描述..."
              className="resize-none"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: 价格与设置 ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          {/* 信息摘要 */}
          <Card className="border-neutral-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-4">
                {form.image_urls[0] && (
                  <img
                    src={form.image_urls[0]}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{form.title_en || '未填写标题'}</p>
                  {form.title_ar && (
                    <p className="text-sm text-neutral-500 mt-0.5 truncate" dir="rtl">
                      {form.title_ar}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {categories.find((c) => String(c.id) === form.primary_category_id)?.name_zh ||
                        '未选品类'}
                    </Badge>
                    {form.audience_tags.map((t) => (
                      <Badge key={t} className="text-xs bg-blue-100 text-blue-700 border-0">
                        {t}
                      </Badge>
                    ))}
                    {form.operational_tag_ids.map((t: number) => (
                      <Badge key={t} className="text-xs bg-amber-100 text-amber-700 border-0">
                        {operationalTags.find((tag) => tag.id === t)?.name || t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 价格 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                实售价（AED）<span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                  AED
                </span>
                <Input
                  ref={sellingPriceInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={f('selling_price')}
                  className="pl-12"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>划线原价（AED）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                  AED
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.regular_price}
                  onChange={f('regular_price')}
                  className="pl-12"
                  placeholder="0.00（可选）"
                />
              </div>
            </div>
          </div>

          {/* 精选商品 */}
          <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <input
              type="checkbox"
              id="is_featured"
              checked={form.is_featured}
              onChange={(e) => setF('is_featured', e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            <label htmlFor="is_featured" className="text-sm font-medium text-neutral-700 cursor-pointer">
              标记为精选商品
              <span className="text-xs text-neutral-400 ml-2 font-normal">
                将在首页和精选区域优先展示
              </span>
            </label>
          </div>

          {/* AI 使用状态提示 */}
          {aiAssisted !== 'none' && (
            <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700">
              <Sparkles className="h-4 w-4" />
              <span>
                已使用 AI 辅助：
                {aiAssisted === 'ocr' && '图片识别'}
                {aiAssisted === 'optimize' && '文案优化'}
                {aiAssisted === 'both' && '图片识别 + 文案优化'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 导航按钮 */}
      {saveError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {saveError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? navigate('/products') : setStep(step - 1))}
          className="h-11 px-6 rounded-xl"
        >
          {step === 1 ? '取消' : '上一步'}
        </Button>
        {step === 1 ? (
          <Button
            onClick={() => setStep(2)}
            disabled={!form.title_en.trim() || !form.primary_category_id}
            className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
          >
            下一步 <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || !form.selling_price || !form.primary_category_id}
            className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中…</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> 保存为草稿</>
            )}
          </Button>
        )}
      </div>

      {/* ── OCR 结果确认对话框 ── */}
      <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 识别结果确认</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {ocrResult?.confidence_score !== undefined && (
              <div>
                <Label className="text-sm text-neutral-500 mb-2 block">AI 置信度</Label>
                <ConfidenceBar score={ocrResult.confidence_score} />
              </div>
            )}
            <div className="space-y-2">
              <Label>英文标题</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea
                  value={form.title_en}
                  readOnly
                  className="text-neutral-500 bg-neutral-50"
                  placeholder="当前值"
                />
                <Textarea
                  value={ocrResult?.title_en || ''}
                  onChange={(e) => setOcrResult({ ...ocrResult!, title_en: e.target.value })}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>阿拉伯语标题</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea
                  value={form.title_ar}
                  readOnly
                  className="text-neutral-500 bg-neutral-50"
                  placeholder="当前值"
                />
                <Textarea
                  value={ocrResult?.title_ar || ''}
                  onChange={(e) => setOcrResult({ ...ocrResult!, title_ar: e.target.value })}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>简短描述</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea
                  value={form.short_description}
                  readOnly
                  className="text-neutral-500 bg-neutral-50"
                  placeholder="当前值"
                />
                <Textarea
                  value={ocrResult?.short_description || ''}
                  onChange={(e) =>
                    setOcrResult({ ...ocrResult!, short_description: e.target.value })
                  }
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>详细描述</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea
                  value={form.description}
                  readOnly
                  className="text-neutral-500 bg-neutral-50 min-h-[150px]"
                  placeholder="当前值"
                />
                <Textarea
                  value={ocrResult?.description || ''}
                  onChange={(e) => setOcrResult({ ...ocrResult!, description: e.target.value })}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50 min-h-[150px]"
                />
              </div>
            </div>
            {ocrResult?.notes && (
              <div className="text-sm text-neutral-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <span className="font-medium">AI 说明：</span>
                {ocrResult.notes}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOcrDialogOpen(false); setOcrResult(null); }}>
              取消
            </Button>
            <Button onClick={confirmOCR}>确认使用 AI 建议</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 文案优化对比对话框 ── */}
      <Dialog open={optimizeDialogOpen} onOpenChange={setOptimizeDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>文案优化对比</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>原文案</Label>
                <Card>
                  <CardContent className="p-3 space-y-2 bg-neutral-50">
                    <p className="font-medium text-sm">{optimizeResult?.original.title_en}</p>
                    <p className="text-neutral-500 text-sm">{optimizeResult?.original.description}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>优化后</Label>
                <Card className="border-violet-300">
                  <CardContent className="p-3 space-y-2 bg-violet-50">
                    <p className="font-medium text-sm text-violet-900">
                      {optimizeResult?.optimized.title_en}
                    </p>
                    <p className="text-neutral-600 text-sm">
                      {optimizeResult?.optimized.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
            {optimizeResult?.improvements && optimizeResult.improvements.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">改进说明</Label>
                <ul className="list-disc list-inside text-sm text-neutral-600 space-y-0.5">
                  {optimizeResult.improvements.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}
            {optimizeResult?.quality_score !== undefined && (
              <div className="text-sm text-neutral-500">
                <span className="font-medium">质量评分：</span>
                <span
                  className={
                    optimizeResult.quality_score > 0.7 ? 'text-green-600' : 'text-yellow-600'
                  }
                >
                  {Math.round(optimizeResult.quality_score * 100)}%
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOptimizeDialogOpen(false); setOptimizeResult(null); }}>
              取消
            </Button>
            <Button onClick={confirmOptimize}>采用优化版本</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
