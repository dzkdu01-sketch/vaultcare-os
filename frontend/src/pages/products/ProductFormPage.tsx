import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { applyCatalogTagToggle, dedupeGenderCatalogTags, tagKeyEquals } from '../../lib/catalogTags'
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_TAGS,
  parseTaxonomyJson,
} from '../../lib/productTaxonomy'
import { usePageHeader } from '../../context/PageHeaderContext'
import { productApi, settingsApi, siteApi } from '../../services/app-services'
import type { Site } from '../../services/types'
import { ProductSyncToSitesModal } from './ProductSyncToSitesModal'
import { SupplierCodeBindSection } from './SupplierCodeBindSection'
import type { ProductInput } from '../../services/types'

/** 产品图默认前缀，与资源命名 `{SKU}-n.webp` 一致 */
const PRODUCT_IMAGE_BASE = 'http://vault-me.site/pic/'
/** 长描述主视频路径，与 `{SKU}-s1.mp4`、`{SKU}-s2.mp4` … 一致 */
const PRODUCT_VIDEO_BASE = 'http://vault-me.site/vid/'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 根据当前正文已有链接，计算下一个视频序号（s1、s2…） */
function nextVideoIndexForSku(description: string, sku: string): number {
  const re = new RegExp(`${escapeRegExp(sku.trim())}-s(\\d+)\\.mp4`, 'gi')
  let max = 0
  for (const m of description.matchAll(re)) {
    const n = parseInt(m[1], 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return max + 1
}
/** 固定 4 张：{SKU}-1.webp … {SKU}-4.webp，首行作列表缩略图 */
const FIXED_IMAGE_SLOTS = 4

function buildDefaultProductImageUrls(sku: string): string[] {
  return Array.from({ length: FIXED_IMAGE_SLOTS }, (_, i) => `${PRODUCT_IMAGE_BASE}${sku}-${i + 1}.webp`)
}

const IMAGE_SLOT_LABELS = ['主图（列表）', '图 2', '图 3', '图 4'] as const

function ProductImagePreviewSlot({ url }: { url: string | undefined }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [url])
  const trimmed = url?.trim() ?? ''
  if (!trimmed) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-[10px] leading-tight text-slate-400">
        无链接
      </div>
    )
  }
  if (failed) {
    return (
      <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-1 text-center text-[10px] leading-tight text-amber-800">
        加载失败
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => window.open(trimmed, '_blank', 'noopener,noreferrer')}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left focus:outline-none focus:ring-2 focus:ring-primary-ring"
      title="在新标签页打开原图"
    >
      <img
        src={trimmed}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition group-hover:opacity-90"
        onError={() => setFailed(true)}
      />
      <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 pt-4 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        查看原图
      </span>
    </button>
  )
}

const FORM_ID = 'product-form'

const SECTION_NAV = [
  { id: 'section-basic', label: '基础信息' },
  { id: 'section-supplier', label: '供应商' },
  { id: 'section-desc', label: '描述' },
  { id: 'section-meta', label: '图片' },
] as const

function FormSection({
  id,
  title,
  headerExtra,
  children,
}: {
  id: string
  title: string
  headerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7"
    >
      <header className="mb-6 flex flex-col gap-3 border-b border-slate-100/90 pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        </div>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </header>
      {children}
    </section>
  )
}

function SectionNav() {
  return (
    <nav
      className="hidden xl:block xl:w-44 xl:shrink-0"
      aria-label="本页目录"
    >
      <div className="sticky top-6 rounded-lg border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur-sm">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          跳转
        </p>
        <ul className="space-y-0.5">
          {SECTION_NAV.map(item => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-primary-muted hover:text-primary-hover"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [sku, setSku] = useState('')
  const [form, setForm] = useState<ProductInput>({
    name: '', short_description: '', description: '',
    sale_price: 0, regular_price: 0,
    category: '', tags: [], images: [], status: 1,
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [categories, setCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES)
  const [tags, setTags] = useState<string[]>(DEFAULT_PRODUCT_TAGS)
  const [sites, setSites] = useState<Site[]>([])
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [selectedSyncSites, setSelectedSyncSites] = useState<string[]>([])
  const [syncingToSites, setSyncingToSites] = useState(false)
  const [skuCopied, setSkuCopied] = useState(false)
  const submitIntent = useRef<'stay' | 'list'>('stay')
  const formRef = useRef(form)
  formRef.current = form
  const { setSubtitle, setHeaderActions } = usePageHeader()

  const copySkuToClipboard = useCallback(() => {
    const t = sku.trim()
    if (!t) return
    void navigator.clipboard.writeText(t).then(() => {
      setSkuCopied(true)
      window.setTimeout(() => setSkuCopied(false), 2000)
    })
  }, [sku])

  useEffect(() => {
    if (!isEdit) {
      setSubtitle('保存后将进入编辑页，可绑定供应商编码')
      return () => setSubtitle(null)
    }
    if (loading) {
      setSubtitle('加载中…')
      return () => setSubtitle(null)
    }
    // 顶栏只显示 SKU，避免长商品名占满顶栏、像固定输入框；名称仅在「基础信息」中编辑
    setSubtitle(sku ? `SKU ${sku}` : null)
    return () => setSubtitle(null)
  }, [isEdit, loading, sku, setSubtitle])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await settingsApi.get()
        if (cancelled) return
        setCategories(parseTaxonomyJson(s.product_categories_json, DEFAULT_PRODUCT_CATEGORIES))
        setTags(parseTaxonomyJson(s.product_tags_json, DEFAULT_PRODUCT_TAGS))
      } catch {
        if (!cancelled) {
          setCategories(DEFAULT_PRODUCT_CATEGORIES)
          setTags(DEFAULT_PRODUCT_TAGS)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    void siteApi.list().then(setSites).catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (!saveSuccess) return
    const t = window.setTimeout(() => setSaveSuccess(false), 4000)
    return () => window.clearTimeout(t)
  }, [saveSuccess])

  useEffect(() => {
    if (!id) return
    productApi.getById(id).then(data => {
      const parsedImages =
        typeof data.images === 'string' ? JSON.parse(data.images || '[]') : (data.images || [])
      const images =
        Array.isArray(parsedImages) && parsedImages.length === 0 && data.sku
          ? buildDefaultProductImageUrls(data.sku)
          : parsedImages
      setSku(data.sku)
      const rawTags = typeof data.tags === 'string' ? JSON.parse(data.tags || '[]') : (data.tags || [])
      const tags = dedupeGenderCatalogTags(rawTags)
      setForm({
        name: data.name,
        short_description: data.short_description || '',
        description: data.description || '',
        sale_price: data.sale_price || 0,
        regular_price: data.regular_price || 0,
        category: data.category || '',
        tags,
        images,
        status: data.status ?? 1,
      })
      setLoading(false)
    })
  }, [id])

  const runSave = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    setError('')
    setSaveSuccess(false)
    const data = formRef.current
    try {
      if (isEdit) {
        await productApi.update(id!, { ...data, sku: sku.trim() })
        const intent = submitIntent.current
        submitIntent.current = 'stay'
        if (intent === 'list') {
          navigate('/products')
          return false
        }
        setSaveSuccess(true)
        return true
      }
      const created = await productApi.create(data)
      navigate(`/products/${created.id}/edit`)
      return false
    } catch (err: any) {
      setError(err.message || '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }, [isEdit, id, navigate, sku])

  const handleSaveAndReturnList = useCallback(async () => {
    if (!isEdit || !id) return
    const el = document.getElementById(FORM_ID) as HTMLFormElement | null
    if (el && !el.checkValidity()) {
      el.reportValidity()
      return
    }
    submitIntent.current = 'list'
    await runSave()
  }, [isEdit, id, runSave])

  const set = (field: keyof ProductInput, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  const insertNextProductVideoLine = useCallback(() => {
    const s = sku.trim()
    if (!s) {
      alert('请先填写并保存商品，获得 SKU 后再插入视频。')
      return
    }
    const ta = descriptionTextareaRef.current
    setForm(f => {
      const val = f.description ?? ''
      const idx = nextVideoIndexForSku(val, s)
      const snippet = `${PRODUCT_VIDEO_BASE}${s}-s${idx}.mp4\n`
      if (!ta) {
        return { ...f, description: val + snippet }
      }
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = val.slice(0, start) + snippet + val.slice(end)
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + snippet.length
        ta.setSelectionRange(pos, pos)
      })
      return { ...f, description: next }
    })
  }, [sku])

  const toggleTag = (tag: string) => {
    const current = form.tags || []
    if (current.some(t => tagKeyEquals(t, tag))) {
      set('tags', current.filter(t => !tagKeyEquals(t, tag)))
    } else {
      set('tags', applyCatalogTagToggle(current, tag))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await runSave()
  }

  const openSyncModal = useCallback(() => {
    if (!id) return
    const active = sites.filter(s => s.status === 'active').map(s => s.id)
    setSelectedSyncSites(active)
    setSyncModalOpen(true)
  }, [id, sites])

  const toggleSyncSite = useCallback((siteId: string) => {
    setSelectedSyncSites(prev =>
      prev.includes(siteId) ? prev.filter(x => x !== siteId) : [...prev, siteId],
    )
  }, [])

  const handleSyncConfirm = useCallback(async () => {
    if (!id || selectedSyncSites.length === 0) return
    const el = document.getElementById(FORM_ID) as HTMLFormElement | null
    if (el && !el.checkValidity()) {
      el.reportValidity()
      return
    }
    setSyncingToSites(true)
    setError('')
    try {
      submitIntent.current = 'stay'
      const saved = await runSave()
      if (!saved) return
      const result = await productApi.sync(id, selectedSyncSites)
      const ok = result.results.filter(r => r.success).length
      const fail = result.results.filter(r => !r.success).length
      const siteCount = result.results.length
      const lines = result.results.map(
        r => `${r.site_name}: ${r.success ? '成功' : `失败 ${r.error || ''}`}`,
      )
      const skipped = result.skipped_images?.length
        ? `\n\n已跳过无法访问的图片（未推送到站点，其余内容已同步）：\n${result.skipped_images.join('\n')}`
        : ''
      alert(
        `同步完成（仅当前编辑的这一件商品；已选 ${siteCount} 个站点）：${ok} 个站点成功，${fail} 个站点失败\n${lines.join('\n')}${skipped}`,
      )
      setSyncModalOpen(false)
    } catch (err: any) {
      const msg = err.message || '同步失败'
      setError(msg)
      alert(msg)
    } finally {
      setSyncingToSites(false)
    }
  }, [id, selectedSyncSites, runSave])

  useEffect(() => {
    if (loading) {
      setHeaderActions(null)
      return
    }
    setHeaderActions(
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm hover:bg-slate-50"
        >
          取消
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={() => void handleSaveAndReturnList()}
            disabled={saving}
            className="rounded-lg border border-primary-border bg-white px-3 py-2 text-sm text-primary shadow-sm hover:bg-primary-muted disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存并返回列表'}
          </button>
        )}
        <button
          type="submit"
          form={FORM_ID}
          disabled={saving}
          onClick={() => { submitIntent.current = 'stay' }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? '保存中...' : isEdit ? '保存' : '创建'}
        </button>
      </div>,
    )
    return () => setHeaderActions(null)
  }, [loading, saving, isEdit, navigate, setHeaderActions, handleSaveAndReturnList])

  if (loading) {
    return (
      <div className="flex flex-1 min-h-[40vh] items-center justify-center text-slate-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full max-w-none">
      <div className="flex min-h-0 flex-1 flex-col gap-8 xl:flex-row xl:items-start xl:gap-12">
        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className="mx-auto flex min-w-0 w-full max-w-[56rem] flex-1 flex-col gap-8 pb-12 xl:mx-0 xl:max-w-none xl:flex-[1_1_0%]"
        >
          {saveSuccess && (
            <div
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              已保存
            </div>
          )}
          <FormSection
            id="section-basic"
            title="基础信息"
            headerExtra={
              isEdit && id ? (
                <button
                  type="button"
                  onClick={openSyncModal}
                  className="rounded-lg border border-primary-border bg-primary-muted px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-primary-muted"
                >
                  同步至网站
                </button>
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {isEdit && (
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">SKU</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={sku}
                      onChange={e => setSku(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 font-sku text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void copySkuToClipboard()}
                      disabled={!sku.trim()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                      title="复制完整货号，避免 0/O/8 看错"
                    >
                      <Copy className="h-4 w-4 opacity-80" aria-hidden />
                      {skuCopied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    货号使用等宽字体显示，数字 0 与字母 O、数字 8 更易区分；需要核对时请用「复制」粘贴到别处比对。修改 SKU
                    后请自行核对长描述与图片中的资源路径是否仍与货号一致；已同步至网站的商品请在改码后重新同步。
                  </p>
                </div>
              )}

              <div className="xl:col-span-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:gap-6">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">商品名称 *</label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="shrink-0 xl:max-w-[min(100%,320px)]">
                  <span className="mb-1 block text-sm font-medium text-slate-700">状态</span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="上架状态">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={(form.status ?? 1) === 1}
                      onClick={() => set('status', 1)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                        (form.status ?? 1) === 1
                          ? 'border-primary bg-primary-muted text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      上架
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={(form.status ?? 1) === 0}
                      onClick={() => set('status', 0)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                        (form.status ?? 1) === 0
                          ? 'border-primary bg-primary-muted text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      草稿
                    </button>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-2 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">分类</label>
                  <select
                    value={form.category || ''}
                    onChange={e => set('category', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">选择分类</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">标签</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const selected = (form.tags || []).some(t => tagKeyEquals(t, tag))
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? 'border-primary-border bg-primary-muted text-slate-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">售价 (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sale_price || ''}
                  onChange={e => set('sale_price', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">划线价 (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.regular_price || ''}
                  onChange={e => set('regular_price', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </FormSection>

          <FormSection id="section-supplier" title="供应商编码">
            {isEdit && id ? (
              <SupplierCodeBindSection productId={id} embedded />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
                保存商品后可绑定供应商编码
              </div>
            )}
          </FormSection>

          <FormSection
            id="section-desc"
            title="商品描述"
            headerExtra={
              <button
                type="button"
                disabled={!sku.trim()}
                title={sku.trim() ? '按当前 SKU 插入 ImageKit 视频链接（s1、s2… 递增）' : '请先保存商品以生成 SKU'}
                onClick={() => insertNextProductVideoLine()}
                className="rounded-lg border border-primary-border bg-primary-muted/80 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-primary-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                插入视频
              </button>
            }
          >
            <div className="space-y-8">
              <div>
                <label
                  htmlFor="field-short-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  短描述
                </label>
                <textarea
                  id="field-short-description"
                  value={form.short_description || ''}
                  onChange={e => set('short_description', e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder="列表摘要等，可含 HTML"
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="border-t border-slate-100 pt-8">
                <label
                  htmlFor="field-long-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  长描述
                </label>
                <textarea
                  id="field-long-description"
                  ref={descriptionTextareaRef}
                  value={form.description || ''}
                  onChange={e => set('description', e.target.value)}
                  rows={14}
                  spellCheck={false}
                  placeholder="正文与视频链接（每行一条链接可便于管理）"
                  className="min-h-[280px] w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </FormSection>

          <FormSection id="section-meta" title="图片">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">图片 URL</label>
              {isEdit && sku ? (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set('images', buildDefaultProductImageUrls(sku))}
                    className="rounded-lg border border-primary-border bg-white px-3 py-1.5 text-xs font-medium text-primary shadow-sm hover:bg-primary-muted"
                  >
                    重新生成 4 条链接
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-8">
                <div className="flex min-w-0 flex-1 flex-col">
                  <textarea
                    value={(form.images || []).join('\n')}
                    onChange={e => set('images', e.target.value.split('\n').filter(Boolean))}
                    rows={8}
                    spellCheck={false}
                    placeholder="https://ik.imagekit.io/vaultcare/pic/..."
                    className="min-h-[200px] w-full flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="shrink-0 xl:w-[min(100%,280px)]">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">预览</p>
                  <div className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-4">
                    {IMAGE_SLOT_LABELS.map((label, i) => {
                      const u = (form.images || [])[i]
                      return (
                        <div key={label} className="flex gap-3">
                          <span className="w-[4.5rem] shrink-0 pt-1 text-xs leading-snug text-slate-500">{label}</span>
                          <ProductImagePreviewSlot url={u} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </FormSection>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/90 p-5 shadow-inner">
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                onClick={() => { submitIntent.current = 'stay' }}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? '保存中...' : isEdit ? '保存' : '创建'}
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => void handleSaveAndReturnList()}
                  disabled={saving}
                  className="rounded-lg border border-primary-border bg-white px-4 py-2 text-sm text-primary hover:bg-primary-muted disabled:opacity-50"
                >
                  保存并返回列表
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </form>

        <SectionNav />
      </div>

      <ProductSyncToSitesModal
        open={syncModalOpen}
        sites={sites}
        selectedIds={selectedSyncSites}
        onToggle={toggleSyncSite}
        onClose={() => setSyncModalOpen(false)}
        onConfirm={() => void handleSyncConfirm()}
        loading={syncingToSites || saving}
      />
    </div>
  )
}
