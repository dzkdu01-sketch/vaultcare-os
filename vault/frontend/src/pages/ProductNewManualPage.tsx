import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiAPI, productsAPI, categoriesAPI, operationalTagsAPI } from '@/api/endpoints'
import type { Category, OperationalTag } from '@/types'
import { AUDIENCE_TAG_OPTIONS, MANUAL_NEW_PRODUCT_STEPS, MANUAL_STEP_HINTS } from '@/constants/productForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { showToast } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Check, AlertCircle, Sparkles, X } from 'lucide-react'

const REGIONS = [
  { value: 'u', label: 'UAE (u)' },
  { value: 't', label: 'Thailand (t)' },
  { value: 'a', label: 'All (a)' },
]

interface FormState {
  title_en: string
  title_ar: string
  title_th: string
  short_description: string
  description: string
  primary_category: string
  region: 'u' | 't' | 'a'
  selling_price: string
  regular_price: string
  audience_tags: string[]
  operational_tag_ids: number[]
  image_urls: string[]
  is_featured: boolean
}

interface AIResult {
  title_en?: string
  title_ar?: string
  short_description?: string
  description?: string
  primary_category?: string
  audience_tags?: string[]
  operational_tags?: string[]
  confidence_score?: number
  notes?: string
}

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-6">
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

export default function ProductNewManualPage() {
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
    primary_category: '',
    region: 'u',
    selling_price: '',
    regular_price: '',
    audience_tags: [],
    operational_tag_ids: [],
    image_urls: [],
    is_featured: false,
  })
  const [newImageUrl, setNewImageUrl] = useState('')
  const [aiFiles, setAiFiles] = useState<File[]>([])
  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [aiAssistError, setAiAssistError] = useState('')
  const [aiAssistNote, setAiAssistNote] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Task 3: OCR 和文案优化状态
  const [ocrResultOpen, setOcrResultOpen] = useState(false)
  const [ocrResult, setOcrResult] = useState<AIResult | null>(null)
  const [optimizeResultOpen, setOptimizeResultOpen] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<{
    original: { title_en: string; description: string }
    optimized: { title_en: string; description: string }
    improvements: string[]
    quality_score: number
  } | null>(null)
  const [optimizingText, setOptimizingText] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-upload-debug',hypothesisId:'H1',location:'ProductNewManualPage.tsx:handleImageUpload:start',message:'manual image upload start',data:{name:file.name,type:file.type,size:file.size},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (file.type.startsWith('image/')) {
      setAiFiles((prev) => [...prev, file].slice(0, 5))
    }
    setUploadingImage(true)
    try {
      const res = await productsAPI.uploadImage(file)
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-upload-debug',hypothesisId:'H1',location:'ProductNewManualPage.tsx:handleImageUpload:success',message:'manual image upload success',data:{url:res?.data?.url || ''},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setF('image_urls', [...form.image_urls, res.data.url])
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const payload = (err as { response?: { data?: unknown } })?.response?.data
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-upload-debug',hypothesisId:'H1',location:'ProductNewManualPage.tsx:handleImageUpload:error',message:'manual image upload failed',data:{status:status || null,payload},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.error(err)
      alert('图片上传失败')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  useEffect(() => {
    categoriesAPI.list().then((res) => {
      setCategories(res.data.results ?? res.data)
    }).catch(console.error)
    operationalTagsAPI.list().then((res) => {
      setOperationalTags(res.data.results ?? res.data)
    }).catch(console.error)
  }, [])

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      audience_tags: prev.audience_tags.includes(tag)
        ? prev.audience_tags.filter((t) => t !== tag)
        : [...prev.audience_tags, tag],
    }))
  }

  const toggleOperationalTag = (tagId: number) => {
    setForm((prev) => ({
      ...prev,
      operational_tag_ids: prev.operational_tag_ids.includes(tagId)
        ? prev.operational_tag_ids.filter((t) => t !== tagId)
        : [...prev.operational_tag_ids, tagId],
    }))
  }

  const addImageUrl = () => {
    const url = newImageUrl.trim()
    if (url && !form.image_urls.includes(url)) {
      setF('image_urls', [...form.image_urls, url])
      setNewImageUrl('')
    }
  }

  const removeImageUrl = (i: number) =>
    setF('image_urls', form.image_urls.filter((_, idx) => idx !== i))

  const handleManualAIAssist = async () => {
    if (!aiFiles.length) {
      setAiAssistError('请先上传至少 1 张本地图片，再使用 AI 辅助填充')
      return
    }
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-ai-assist-debug',hypothesisId:'H3',location:'ProductNewManualPage.tsx:handleManualAIAssist:start',message:'manual ai assist start',data:{fileCount:aiFiles.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setAnalyzingAI(true)
    setAiAssistError('')
    setAiAssistNote('')
    try {
      const fd = new FormData()
      aiFiles.forEach((file) => fd.append('images', file))
      const res = await aiAPI.ocrAnalyze(fd)
      const data: AIResult = res.data

      // 显示 OCR 结果确认对话框，而不是直接填充
      setOcrResult(data)
      setOcrResultOpen(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      const errorMsg = (msg as { error?: string; message?: string })?.error || (msg as { message?: string })?.message || 'AI 辅助填充失败，请稍后重试'
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-ai-assist-debug',hypothesisId:'H3',location:'ProductNewManualPage.tsx:handleManualAIAssist:error',message:'manual ai assist failed',data:{error:errorMsg},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // 降级处理：AI 服务不可用时提示但不阻断
      if ((msg as { error_code?: string })?.error_code === 'AI_SERVICE_UNAVAILABLE' || (msg as { degraded?: boolean })?.degraded) {
        showToast(errorMsg, 'warning')
      } else {
        setAiAssistError(errorMsg)
      }
    } finally {
      setAnalyzingAI(false)
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
      primary_category: matchedCategory ? String(matchedCategory.id) : prev.primary_category,
      audience_tags: (ocrResult.audience_tags && ocrResult.audience_tags.length > 0) ? ocrResult.audience_tags : prev.audience_tags,
      operational_tag_ids: opTagIds.length > 0 ? opTagIds : prev.operational_tag_ids,
    }))
    setOcrResultOpen(false)
    setOcrResult(null)
    setAiAssistNote('AI 已回填标题、描述、品类和标签，请人工复核后继续')
  }

  const handleOptimizeText = async () => {
    if (!form.title_en.trim()) {
      showToast('请先填写英文标题', 'warning')
      return
    }
    setOptimizingText(true)
    try {
      const res = await aiAPI.optimizeText({
        title_en: form.title_en,
        description: form.description,
      })
      setOptimizeResult(res.data)
      setOptimizeResultOpen(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg || '文案优化失败，请稍后重试', 'error')
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
    setOptimizeResultOpen(false)
    setOptimizeResult(null)
    showToast('已采用优化后的文案', 'success')
  }

  const handleSave = async () => {
    if (!form.title_en.trim()) {
      setSaveError('英文名称不能为空')
      return
    }
    if (!form.selling_price) {
      setSaveError('实售价不能为空')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      // 判断 AI 辅助程度
      let aiAssisted: 'none' | 'ocr' | 'optimize' | 'both' = 'none'
      if (ocrResult && optimizeResult) {
        aiAssisted = 'both'
      } else if (ocrResult) {
        aiAssisted = 'ocr'
      } else if (optimizeResult) {
        aiAssisted = 'optimize'
      }

      const res = await productsAPI.createManualDraft({
        title_en: form.title_en,
        title_ar: form.title_ar,
        title_th: form.title_th,
        short_description: form.short_description,
        description: form.description,
        primary_category: form.primary_category ? parseInt(form.primary_category) : null,
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
          <h1 className="text-xl font-bold text-neutral-900">手动新增商品</h1>
          <p className="text-sm text-neutral-500 mt-0.5">按步骤填写商品信息，保存后默认为草稿（下架状态）</p>
        </div>
      </div>

      <StepIndicator step={step} steps={MANUAL_NEW_PRODUCT_STEPS} />

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
        {step === 1 && (
          <>
            <div className="text-sm text-neutral-500 -mt-1">{MANUAL_STEP_HINTS[step]}</div>
            <div className="space-y-1.5">
              <Label>推送市场 (区域) <span className="text-red-400">*</span></Label>
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
            <div className="space-y-1.5">
              <Label>英文标题 <span className="text-red-400">*</span></Label>
              <Input
                value={form.title_en}
                onChange={(e) => setF('title_en', e.target.value)}
                placeholder="Product title (English)"
              />
            </div>
            {(form.region === 'u' || form.region === 'a') && (
              <div className="space-y-1.5">
                <Label>阿拉伯语标题</Label>
                <Input
                  value={form.title_ar}
                  onChange={(e) => setF('title_ar', e.target.value)}
                  dir="rtl"
                  placeholder="العنوان بالعربية"
                  className="text-right"
                />
              </div>
            )}
            {(form.region === 't' || form.region === 'a') && (
              <div className="space-y-1.5">
                <Label>泰语标题</Label>
                <Input
                  value={form.title_th}
                  onChange={(e) => setF('title_th', e.target.value)}
                  placeholder="ชื่อสินค้าภาษาไทย"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>主品类 <span className="text-red-400">*</span></Label>
              <select
                value={form.primary_category}
                onChange={(e) => setF('primary_category', e.target.value)}
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
            <div className="space-y-1.5">
              <Label>受众标签</Label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_TAG_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTag(key)}
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
            <div className="space-y-1.5">
              <Label>运营标签</Label>
              <div className="flex flex-wrap gap-2">
                {operationalTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleOperationalTag(tag.id)}
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>图片与说明书</Label>
                {/* Task 3: AI 识别按钮 */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={handleManualAIAssist}
                  disabled={analyzingAI || aiFiles.length === 0}
                >
                  {analyzingAI ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 识别中</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI 识别图片/PDF</>
                  )}
                </Button>
              </div>
              {aiAssistError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {aiAssistError}
                </div>
              )}
              {aiAssistNote && (
                <div className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  {aiAssistNote}
                </div>
              )}
              <div className="space-y-2">
                {form.image_urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex-shrink-0 rounded-md overflow-hidden bg-neutral-100 border flex items-center justify-center">
                      {url.toLowerCase().endsWith('.pdf') ? (
                        <span className="text-[10px] font-bold text-neutral-500">PDF</span>
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="flex-1 text-xs text-neutral-600 truncate font-mono">{url}</span>
                    <button onClick={() => removeImageUrl(i)} className="text-neutral-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-center w-full h-20 px-4 transition bg-white border-2 border-neutral-200 border-dashed rounded-xl appearance-none cursor-pointer hover:border-violet-400 hover:bg-violet-50 focus:outline-none">
                    <span className="flex items-center space-x-2">
                      {uploadingImage ? <Loader2 className="w-4 h-4 text-violet-600 animate-spin" /> : <Plus className="w-4 h-4 text-neutral-400" />}
                      <span className="font-medium text-neutral-500 text-sm">
                        {uploadingImage ? '上传中...' : '拖拽或点击上传本地图片 / PDF'}
                      </span>
                    </span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                      placeholder="或直接粘贴网络 URL，按 Enter 添加"
                      className="text-xs h-8"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 shrink-0"
                      onClick={addImageUrl}
                      disabled={!newImageUrl.trim()}
                      title="添加图片 URL"
                    >
                      添加网络图片
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>简短描述</Label>
              <Input
                value={form.short_description}
                onChange={(e) => setF('short_description', e.target.value.slice(0, 200))}
                placeholder="商品简短描述（最多200字）"
                maxLength={200}
              />
              <p className="text-xs text-neutral-400 text-right">{form.short_description.length}/200</p>
            </div>
            <div className="space-y-1.5">
              <Label>详细描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setF('description', e.target.value)}
                rows={4}
                placeholder="完整商品描述..."
                className="resize-none"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-sm text-neutral-500 -mt-1">{MANUAL_STEP_HINTS[step]}</div>
            {/* Task 3: AI 优化文案按钮 */}
            <div className="mb-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-violet-900">AI 文案优化</Label>
                  <p className="text-xs text-violet-600 mt-0.5">优化英文标题和描述，使其更具吸引力和 SEO 友好</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs border-violet-300 text-violet-700 hover:bg-violet-100"
                  onClick={handleOptimizeText}
                  disabled={optimizingText || !form.title_en.trim()}
                >
                  {optimizingText ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 优化中</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI 优化文案</>
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>实售价（AED）<span className="text-red-400">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">AED</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) => setF('selling_price', e.target.value)}
                    className="pl-12"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>划线原价（AED）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">AED</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.regular_price}
                    onChange={(e) => setF('regular_price', e.target.value)}
                    className="pl-12"
                    placeholder="0.00（可选）"
                  />
                </div>
              </div>
            </div>
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
                <span className="text-xs text-neutral-400 ml-2 font-normal">将在首页和精选区域优先展示</span>
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-sm text-neutral-500 -mt-1">{MANUAL_STEP_HINTS[step]}</div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2 text-sm">
              <p><span className="text-neutral-500">英文标题：</span>{form.title_en || '未填写'}</p>
              <p><span className="text-neutral-500">主品类：</span>{categories.find((c) => String(c.id) === form.primary_category)?.name_zh || '未选择'}</p>
              <p><span className="text-neutral-500">推送市场：</span>{REGIONS.find((r) => r.value === form.region)?.label}</p>
              <p><span className="text-neutral-500">实售价：</span>{form.selling_price || '未填写'}</p>
            </div>
          </>
        )}

        {saveError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => (step === 1 ? navigate('/products') : setStep(step - 1))} className="h-11 px-6 rounded-xl">
            {step === 1 ? '取消' : '上一步'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && (!form.title_en.trim() || !form.primary_category)) || (step === 2 && !form.selling_price)}
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-md shadow-violet-600/20"
            >
              下一步 <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving || !form.title_en.trim() || !form.selling_price}
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
      </div>

      {/* Task 3: OCR 结果确认对话框 */}
      <Dialog open={ocrResultOpen} onOpenChange={setOcrResultOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 识别结果确认</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>英文标题</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea value={form.title_en} readOnly className="text-neutral-500 bg-neutral-50" placeholder="当前值" />
                <Textarea
                  value={ocrResult?.title_en || ''}
                  onChange={(e) => setOcrResult({...ocrResult!, title_en: e.target.value})}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>阿拉伯语标题</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea value={form.title_ar} readOnly className="text-neutral-500 bg-neutral-50" placeholder="当前值" />
                <Textarea
                  value={ocrResult?.title_ar || ''}
                  onChange={(e) => setOcrResult({...ocrResult!, title_ar: e.target.value})}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>简短描述</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea value={form.short_description} readOnly className="text-neutral-500 bg-neutral-50" placeholder="当前值" />
                <Textarea
                  value={ocrResult?.short_description || ''}
                  onChange={(e) => setOcrResult({...ocrResult!, short_description: e.target.value})}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>详细描述</Label>
              <div className="grid grid-cols-2 gap-3">
                <Textarea value={form.description} readOnly className="text-neutral-500 bg-neutral-50 min-h-[150px]" placeholder="当前值" />
                <Textarea
                  value={ocrResult?.description || ''}
                  onChange={(e) => setOcrResult({...ocrResult!, description: e.target.value})}
                  placeholder="AI 建议"
                  className="border-violet-300 bg-violet-50 min-h-[150px]"
                />
              </div>
            </div>
            {ocrResult?.confidence_score !== undefined && (
              <div className="text-sm text-neutral-500">
                <span className="font-medium">置信度：</span>
                <span className={ocrResult.confidence_score > 0.7 ? 'text-green-600' : ocrResult.confidence_score > 0.4 ? 'text-yellow-600' : 'text-red-600'}>
                  {Math.round(ocrResult.confidence_score * 100)}%
                </span>
              </div>
            )}
            {ocrResult?.notes && (
              <div className="text-sm text-neutral-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <span className="font-medium">AI 说明：</span>{ocrResult.notes}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOcrResultOpen(false); setOcrResult(null); }}>取消</Button>
            <Button onClick={confirmOCR}>确认使用 AI 建议</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task 3: 文案优化对比对话框 */}
      <Dialog open={optimizeResultOpen} onOpenChange={setOptimizeResultOpen}>
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
                    <p className="font-medium text-sm text-violet-900">{optimizeResult?.optimized.title_en}</p>
                    <p className="text-neutral-600 text-sm">{optimizeResult?.optimized.description}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            {optimizeResult?.improvements && optimizeResult.improvements.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">改进说明</Label>
                <ul className="list-disc list-inside text-sm text-neutral-600 space-y-0.5">
                  {optimizeResult.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                </ul>
              </div>
            )}
            {optimizeResult?.quality_score !== undefined && (
              <div className="text-sm text-neutral-500">
                <span className="font-medium">质量评分：</span>
                <span className={optimizeResult.quality_score > 0.7 ? 'text-green-600' : 'text-yellow-600'}>
                  {Math.round(optimizeResult.quality_score * 100)}%
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOptimizeResultOpen(false); setOptimizeResult(null); }}>取消</Button>
            <Button onClick={confirmOptimize}>采用优化版本</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
