import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiAPI, categoriesAPI, productsAPI } from '@/api/endpoints'
import type { Category } from '@/types'
import { AI_NEW_PRODUCT_STEPS, AI_STEP_HINTS, AUDIENCE_TAG_OPTIONS } from '@/constants/productForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  region: string
  is_featured: boolean
}

// 运营标签预定义（与手动新增保持一致）
const OPERATIONAL_TAG_OPTIONS = [
  { key: 'best_seller', label: '畅销', id: 1 },
  { key: 'high_value', label: '高值', id: 2 },
  { key: 'new_arrival', label: '新品', id: 3 },
]
const REGIONS = [{ value: 'u', label: 'UAE (u)' }, { value: 't', label: 'Thailand (t)' }, { value: 'a', label: 'All (a)' }]

// ─── 进度步骤组件 ─────────────────────────────────────────────────────────────

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${done ? 'bg-violet-100 text-violet-700' : active ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-neutral-100 text-neutral-400'}`}>
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
  label, options, selected, onChange,
}: {
  label: string
  options: Array<{ key: string; label: string }>
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

export default function ProductNewAIPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<FormState>({
    title_en: '', title_ar: '', title_th: '', short_description: '', description: '',
    primary_category_id: '', audience_tags: [], operational_tag_ids: [],
    regular_price: '', selling_price: '', region: 'u', is_featured: false,
  })
  const [generatingAr, setGeneratingAr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const categorySelectRef = useRef<HTMLSelectElement>(null)
  const sellingPriceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    categoriesAPI.list().then((res) => {
      setCategories(res.data.results ?? res.data)
    }).catch(console.error)
  }, [])

  const isDegradedMode = !!aiResult?.degraded
  const missingTitle = isDegradedMode && !form.title_en.trim()
  const missingCategory = isDegradedMode && !form.primary_category_id
  const missingSellingPrice = isDegradedMode && !form.selling_price.trim()

  useEffect(() => {
    if (!isDegradedMode) return
    if (step === 2) {
      if (missingTitle) {
        titleInputRef.current?.focus()
        return
      }
      if (missingCategory) {
        categorySelectRef.current?.focus()
      }
      return
    }
    if (step === 3 && missingSellingPrice) {
      sellingPriceInputRef.current?.focus()
    }
  }, [isDegradedMode, step, missingTitle, missingCategory, missingSellingPrice])

  // ── 图片处理 ────────────────────────────────────────────────────────────────

  const addFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - files.length)
    if (!valid.length) return
    const updated = [...files, ...valid].slice(0, 5)
    setFiles(updated)
    valid.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPreviews(p => [...p, e.target?.result as string].slice(0, 5))
      reader.readAsDataURL(f)
    })
  }

  const removeFile = (i: number) => {
    setFiles(f => f.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }, [files])

  // ── 步骤 1 → 2：AI 分析 ─────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!files.length) return
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('images', f))
      const res = await aiAPI.analyzeImages(fd)
      const data: AIResult = res.data
      setAiResult(data)
      // 尝试按名称匹配AI返回的品类，找到对应ID
      const matchedCat = categories.find(
        (c) => c.name_en === data.primary_category || c.name_zh === data.primary_category
      )
      // 将 AI 返回的 operational_tags 字符串转换为 ID（与手动新增保持一致）
      const opTagIdMap: Record<string, number> = { best_seller: 1, high_value: 2, new_arrival: 3 }
      const operationalTagIds = (data.operational_tags || []).map((tag: string) => opTagIdMap[tag]).filter(Boolean)

      setForm(prev => ({
        ...prev,
        title_en: data.title_en || '',
        title_ar: data.title_ar || '',
        title_th: '', // AI 暂不支持泰语，保留字段为空
        short_description: data.short_description || '',
        description: data.description || '',
        primary_category_id: matchedCat ? String(matchedCat.id) : '',
        audience_tags: data.audience_tags || [],
        operational_tag_ids: operationalTagIds,
      }))
      setStep(2)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setAnalyzeError(msg || 'AI 分析失败，请检查 API Key 配置或稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── 重新生成阿拉伯语 ─────────────────────────────────────────────────────────

  const handleRegenerateArabic = async () => {
    if (!form.title_en) return
    setGeneratingAr(true)
    try {
      const res = await aiAPI.generateArabic({ title_en: form.title_en, description: form.description })
      const data = res.data
      setForm(prev => ({ ...prev, title_ar: data.title_ar || prev.title_ar }))
    } finally {
      setGeneratingAr(false)
    }
  }

  // ── 步骤 3：保存商品 ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.primary_category_id) {
      setSaveError('请选择主品类后再保存')
      return
    }
    if (!previews.length) {
      setSaveError('请至少上传 1 张图片后再保存')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await productsAPI.createAIDraft({
        title_en: form.title_en,
        title_ar: form.title_ar,
        title_th: form.title_th,
        short_description: form.short_description,
        description: form.description,
        primary_category: form.primary_category_id ? parseInt(form.primary_category_id) : null,
        audience_tags: form.audience_tags,
        operational_tag_ids: form.operational_tag_ids,
        region: form.region,
        regular_price: form.regular_price || null,
        selling_price: form.selling_price || '0.01',
        is_featured: form.is_featured,
        image_urls: previews,
      })
      navigate(`/products/${res.data.id}?created=draft`)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      setSaveError(typeof data === 'string' ? data : JSON.stringify(data) || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const f = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => step === 1 ? navigate('/products') : setStep(s => s - 1)}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" /> AI 辅助上线新品
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">上传图片，AI 自动填写商品信息，人工确认后保存</p>
        </div>
      </div>

      <StepIndicator step={step} steps={AI_NEW_PRODUCT_STEPS} />
      <p className="text-sm text-neutral-500 -mt-4 mb-6">{AI_STEP_HINTS[step]}</p>

      {/* ── Step 1: 上传图片 ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* 拖拽区 */}
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${files.length ? 'border-violet-300 bg-violet-50/50' : 'border-neutral-200 hover:border-violet-300 hover:bg-violet-50/30'}`}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="bg-violet-100 rounded-2xl p-4">
                <ImagePlus className="h-8 w-8 text-violet-500" />
              </div>
              <div>
                <p className="font-semibold text-neutral-800">拖拽图片到此处，或点击选择</p>
                <p className="text-sm text-neutral-500 mt-1">支持 JPG、PNG、WebP，最多 5 张</p>
              </div>
            </div>
          </div>

          {/* 预览 */}
          {previews.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-neutral-200 shadow-sm">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(i) }}
                    className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-violet-600 rounded-md px-1.5 py-0.5 text-[10px] text-white font-medium">
                      主图
                    </div>
                  )}
                </div>
              ))}
              {files.length < 5 && (
                <div
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex items-center justify-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all"
                >
                  <Upload className="h-5 w-5 text-neutral-400" />
                </div>
              )}
            </div>
          )}

          {analyzeError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {analyzeError}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleAnalyze}
              disabled={!files.length || analyzing}
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI 分析中…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> 开始 AI 分析</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: 确认/编辑 AI 建议 ── */}
      {step === 2 && aiResult && (
        <div className="space-y-6">
          {aiResult.degraded && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">当前为 AI 降级模式</p>
                <p className="text-amber-700 mt-0.5">
                  已返回可编辑草稿建议，请人工补全标题、描述、品类和价格后再保存。
                </p>
              </div>
            </div>
          )}

          {/* 置信度卡片 */}
          <Card className="border-violet-200 bg-violet-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-700">AI 分析置信度</span>
                </div>
                <Badge variant="outline" className="border-violet-300 text-violet-600 bg-white text-xs">
                  claude-3-5-haiku
                </Badge>
              </div>
              <ConfidenceBar score={aiResult.confidence_score} />
              {aiResult.notes && (
                <p className="mt-2 text-xs text-neutral-500 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                  {aiResult.notes}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 图片缩略图 */}
          <div className="flex gap-2">
            {previews.map((src, i) => (
              <img key={i} src={src} alt="" className="h-14 w-14 rounded-lg object-cover border border-neutral-200" />
            ))}
          </div>

          <div className="grid gap-5">
            {/* 英文标题 */}
            <div>
              <Label className="text-sm font-medium">英文标题 <span className="text-red-400">*</span></Label>
              <Input
                ref={titleInputRef}
                value={form.title_en}
                onChange={f('title_en')}
                className={`mt-1.5 ${missingTitle ? 'border-red-300 ring-2 ring-red-100 focus-visible:ring-red-200' : ''}`}
                placeholder="Product title (English)"
              />
              {missingTitle && (
                <p className="text-xs text-red-600 mt-1">降级模式下请先补全英文标题</p>
              )}
            </div>

            {/* 阿拉伯语标题 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium">阿拉伯语标题</Label>
                <button
                  type="button"
                  onClick={handleRegenerateArabic}
                  disabled={generatingAr || !form.title_en}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 transition-colors"
                >
                  {generatingAr ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
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

            {/* 泰语标题（仅当区域为 t 或 a 时显示） */}
            {(form.region === 't' || form.region === 'a') && (
              <div>
                <Label className="text-sm font-medium">泰语标题</Label>
                <Input
                  value={form.title_th}
                  onChange={f('title_th')}
                  placeholder="ชื่อสินค้าภาษาไทย"
                  className="mt-1.5"
                />
              </div>
            )}

            {/* 简短描述 */}
            <div>
              <Label className="text-sm font-medium">简短描述</Label>
              <Input value={form.short_description} onChange={f('short_description')} className="mt-1.5" placeholder="Short description (max 150 chars)" maxLength={150} />
              <p className="text-xs text-neutral-400 mt-1 text-right">{form.short_description.length}/150</p>
            </div>

            {/* 详细描述 */}
            <div>
              <Label className="text-sm font-medium">详细描述</Label>
              <Textarea value={form.description} onChange={f('description')} className="mt-1.5 min-h-[140px] resize-none" placeholder="Product description..." />
            </div>

            {/* 品类 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium">主品类 <span className="text-red-400">*</span></Label>
                {aiResult?.primary_category && !form.primary_category_id && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    AI建议："{aiResult.primary_category}"（未找到匹配，请手动选择）
                  </span>
                )}
              </div>
              <select
                ref={categorySelectRef}
                value={form.primary_category_id}
                onChange={f('primary_category_id')}
                className={`w-full h-10 px-3 rounded-lg border bg-white text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:border-transparent
                  ${missingCategory ? 'border-red-300 ring-red-100 focus:ring-red-200' : 'border-neutral-200 focus:ring-violet-500'}`}
              >
                <option value="">-- 选择品类 --</option>
                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name_zh || c.name_en}</option>)}
              </select>
              {missingCategory && (
                <p className="text-xs text-red-600 mt-1">降级模式下请先选择主品类</p>
              )}
            </div>

            {/* 标签 */}
            <div className="grid grid-cols-2 gap-4">
              <TagToggleGroup label="受众标签" options={AUDIENCE_TAG_OPTIONS} selected={form.audience_tags} onChange={v => setForm(p => ({ ...p, audience_tags: v }))} />
              <TagToggleGroup
                label="运营标签"
                options={OPERATIONAL_TAG_OPTIONS.map((tag) => ({ key: String(tag.id), label: tag.label }))}
                selected={form.operational_tag_ids.map(String)}
                onChange={v => setForm(p => ({ ...p, operational_tag_ids: v.map(Number) }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(3)}
              disabled={!form.title_en || !form.primary_category_id}
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
            >
              下一步：填写价格 <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: 价格与区域 ── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* 信息摘要 */}
          <Card className="border-neutral-200">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base font-semibold text-neutral-800">商品摘要</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="flex gap-4">
                {previews[0] && <img src={previews[0]} alt="" className="h-16 w-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{form.title_en}</p>
                  {form.title_ar && <p className="text-sm text-neutral-500 mt-0.5 truncate" dir="rtl">{form.title_ar}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {categories.find(c => String(c.id) === form.primary_category_id)?.name_zh || '未选品类'}
                    </Badge>
                    {form.audience_tags.map(t => <Badge key={t} className="text-xs bg-blue-100 text-blue-700 border-0">{t}</Badge>)}
                    {form.operational_tag_ids.map((t: number) => <Badge key={t} className="text-xs bg-amber-100 text-amber-700 border-0">{t}</Badge>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5">
            {/* 区域 */}
            <div>
              <Label className="text-sm font-medium">推送市场 <span className="text-red-400">*</span></Label>
              <div className="flex gap-3 mt-1.5">
                {REGIONS.map(r => (
                  <label key={r.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-medium
                    ${form.region === r.value ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-neutral-700 border-neutral-200 hover:border-violet-300'}`}>
                    <input type="radio" name="region" value={r.value} checked={form.region === r.value} onChange={f('region')} className="sr-only" />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 价格 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">划线原价（AED）</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">AED</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.regular_price}
                    onChange={f('regular_price')}
                    className="pl-12"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">实售价（AED）<span className="text-red-400">*</span></Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">AED</span>
                  <Input
                    ref={sellingPriceInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.selling_price}
                    onChange={f('selling_price')}
                    className={`pl-12 ${missingSellingPrice ? 'border-red-300 ring-2 ring-red-100 focus-visible:ring-red-200' : ''}`}
                    placeholder="0.00"
                  />
                </div>
                {missingSellingPrice && (
                  <p className="text-xs text-red-600 mt-1">降级模式下请先填写实售价</p>
                )}
              </div>
            </div>

            {/* 精选 */}
            <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <input
                type="checkbox"
                id="is_featured"
                checked={form.is_featured}
                onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
              />
              <label htmlFor="is_featured" className="text-sm font-medium text-neutral-700 cursor-pointer">
                标记为精选商品
                <span className="text-xs text-neutral-400 ml-2 font-normal">将在首页和精选区域优先展示</span>
              </label>
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="h-11 px-6 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" /> 上一步
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.selling_price}
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中…</>
              ) : (
                <><Check className="h-4 w-4 mr-2" /> 保存为草稿</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
