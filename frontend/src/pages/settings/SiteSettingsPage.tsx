import { useEffect, useState } from 'react'
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_TAGS,
  linesToTaxonomyJson,
  parseTaxonomyJson,
  taxonomyToLines,
} from '../../lib/productTaxonomy'
import { siteApi, supplierApi, settingsApi } from '../../services/app-services'
import type { Site, SiteInput, Supplier, SupplierInput } from '../../services/types'

export function SiteSettingsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [exchangeRate, setExchangeRate] = useState('1.95')
  const [savedRate, setSavedRate] = useState('1.95')
  const [savingRate, setSavingRate] = useState(false)
  const [categoryLines, setCategoryLines] = useState(() => taxonomyToLines(DEFAULT_PRODUCT_CATEGORIES))
  const [tagLines, setTagLines] = useState(() => taxonomyToLines(DEFAULT_PRODUCT_TAGS))
  const [savingTaxonomy, setSavingTaxonomy] = useState(false)
  const loadData = async () => {
    const [s, sup, settings] = await Promise.all([siteApi.list(), supplierApi.list(), settingsApi.get()])
    setSites(s)
    setSuppliers(sup)
    if (settings.exchange_rate) {
      setExchangeRate(settings.exchange_rate)
      setSavedRate(settings.exchange_rate)
    }
    const cats = parseTaxonomyJson(settings.product_categories_json, DEFAULT_PRODUCT_CATEGORIES)
    const tgs = parseTaxonomyJson(settings.product_tags_json, DEFAULT_PRODUCT_TAGS)
    setCategoryLines(taxonomyToLines(cats))
    setTagLines(taxonomyToLines(tgs))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleDeleteSite = async (id: string) => {
    if (!confirm('确定删除该站点？')) return
    await siteApi.remove(id)
    loadData()
  }

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('确定删除该供应商？关联的产品映射也会被删除。')) return
    await supplierApi.remove(id)
    loadData()
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const result = await siteApi.test(id)
      setTestResult(prev => ({ ...prev, [id]: { ok: result.connected, error: result.error } }))
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [id]: { ok: false, error: err.message } }))
    } finally {
      setTesting(null)
    }
  }

  const handleSaveRate = async () => {
    const val = parseFloat(exchangeRate)
    if (isNaN(val) || val <= 0) return
    setSavingRate(true)
    try {
      await settingsApi.update('exchange_rate', String(val))
      setSavedRate(String(val))
    } finally {
      setSavingRate(false)
    }
  }

  const handleSaveProductTaxonomy = async () => {
    setSavingTaxonomy(true)
    try {
      await Promise.all([
        settingsApi.update('product_categories_json', linesToTaxonomyJson(categoryLines)),
        settingsApi.update('product_tags_json', linesToTaxonomyJson(tagLines)),
      ])
    } finally {
      setSavingTaxonomy(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-500">加载中...</div>

  return (
    <div className="p-6 space-y-8">
      {/* WooCommerce 站点 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">WooCommerce 站点</h2>
            <p className="text-sm text-slate-500">配置分销站点，产品将同步到这些站点</p>
          </div>
          <button
            onClick={() => { setEditingSite(null); setShowSiteForm(true) }}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700"
          >
            添加站点
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">还没有配置站点</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sites.map(site => (
              <div key={site.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{site.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {site.status === 'active' ? '启用' : '停用'}
                      </span>
                      {testResult[site.id] && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${testResult[site.id].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {testResult[site.id].ok ? '连接成功' : `连接失败`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{site.url}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleTest(site.id)} disabled={testing === site.id} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">
                      {testing === site.id ? '测试中...' : '测试连接'}
                    </button>
                    <button onClick={() => { setEditingSite(site); setShowSiteForm(true) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">编辑</button>
                    <button onClick={() => handleDeleteSite(site.id)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50">删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 供应商 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">供应商</h2>
            <p className="text-sm text-slate-500">管理供应商信息，在产品详情中关联供应商编码</p>
          </div>
          <button
            onClick={() => { setEditingSupplier(null); setShowSupplierForm(true) }}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700"
          >
            添加供应商
          </button>
        </div>

        {suppliers.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">还没有添加供应商</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {suppliers.map(sup => (
              <div key={sup.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{sup.name}</h3>
                    <div className="flex gap-4 mt-1 text-sm text-slate-500">
                      {sup.code_prefix && <span>编码前缀: <span className="font-mono">{sup.code_prefix}</span></span>}
                      {sup.contact && <span>联系方式: {sup.contact}</span>}
                    </div>
                    {sup.note && <p className="text-sm text-slate-400 mt-1">{sup.note}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingSupplier(sup); setShowSupplierForm(true) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">编辑</button>
                    <button onClick={() => handleDeleteSupplier(sup.id)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50">删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 汇率设置 */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">汇率设置</h2>
          <p className="text-sm text-slate-500">用于计算利润率，当前 1 AED ≈ {savedRate} CNY</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">AED → CNY 汇率</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={handleSaveRate}
              disabled={savingRate || exchangeRate === savedRate}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
            >
              {savingRate ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </section>

      {/* 商品分类与标签（用于产品编辑页与列表筛选） */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">商品分类与标签</h2>
          <p className="text-sm text-slate-500">每行一项；保存后产品编辑页与列表筛选下拉将使用此处配置。</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
            <textarea
              value={categoryLines}
              onChange={e => setCategoryLines(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
              placeholder="每行一个分类名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">标签</label>
            <textarea
              value={tagLines}
              onChange={e => setTagLines(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
              placeholder="每行一个标签"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveProductTaxonomy()}
            disabled={savingTaxonomy}
            className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
          >
            {savingTaxonomy ? '保存中...' : '保存分类与标签'}
          </button>
        </div>
      </section>

      {showSiteForm && (
        <SiteFormDialog site={editingSite} onClose={() => setShowSiteForm(false)} onSaved={() => { setShowSiteForm(false); loadData() }} />
      )}
      {showSupplierForm && (
        <SupplierFormDialog supplier={editingSupplier} onClose={() => setShowSupplierForm(false)} onSaved={() => { setShowSupplierForm(false); loadData() }} />
      )}
    </div>
  )
}

function SiteFormDialog({ site, onClose, onSaved }: { site: Site | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SiteInput>({
    name: site?.name || '', url: site?.url || '', consumer_key: site?.consumer_key || '', consumer_secret: site?.consumer_secret || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (site) { await siteApi.update(site.id, form) } else { await siteApi.create(form) }
      onSaved()
    } catch (err: any) { setError(err.message || '保存失败') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{site ? '编辑站点' : '添加站点'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">站点名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="例如：Vaultcare D" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">站点 URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="https://your-store.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Key</label>
            <input value={form.consumer_key} onChange={e => setForm(f => ({ ...f, consumer_key: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="ck_..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Secret</label>
            <input value={form.consumer_secret} onChange={e => setForm(f => ({ ...f, consumer_secret: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="cs_..." required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierFormDialog({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SupplierInput>({
    name: supplier?.name || '', code_prefix: supplier?.code_prefix || '', contact: supplier?.contact || '', note: supplier?.note || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (supplier) { await supplierApi.update(supplier.id, form) } else { await supplierApi.create(form) }
      onSaved()
    } catch (err: any) { setError(err.message || '保存失败') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{supplier ? '编辑供应商' : '添加供应商'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">供应商名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="例如：供应商 A" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">编码前缀</label>
            <input value={form.code_prefix} onChange={e => setForm(f => ({ ...f, code_prefix: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="例如：vip" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">联系方式</label>
            <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="电话 / 微信 / WhatsApp" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
