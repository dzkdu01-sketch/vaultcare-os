import { useEffect, useState } from 'react'
import { distributorApi, siteApi } from '../../services/app-services'

export function MySitesPage() {
  const [sites, setSites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({})

  const load = () => {
    distributorApi.mySites()
      .then(setSites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const r = await siteApi.test(id)
      setTestResult(p => ({ ...p, [id]: { ok: r.connected, error: r.error } }))
    } catch (err: any) {
      setTestResult(p => ({ ...p, [id]: { ok: false, error: err.message } }))
    } finally { setTesting(null) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该站点？有订单的站点无法删除。')) return
    try {
      await distributorApi.deleteMySite(id)
      load()
    } catch (err: any) { alert(err.message || '删除失败') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">我的网站</h2>
          <p className="text-sm text-slate-500">管理您的 WooCommerce 网站，用于接收订单自动同步</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-md bg-primary text-sm text-white hover:bg-primary-hover">+ 添加网站</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : sites.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🌐</div>
            <div className="text-slate-500 mb-2">暂无网站</div>
            <p className="text-sm text-slate-400 mb-4">添加您的 WooCommerce 网站以自动接收和同步订单</p>
            <button onClick={() => setShowForm(true)}
              className="text-primary hover:text-primary-hover text-sm font-medium">点击添加第一个网站 →</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sites.map((s: any) => (
              <div key={s.id} className="p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.status === 'active' ? '活跃' : '已停用'}
                    </span>
                    {testResult[s.id] && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${testResult[s.id].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {testResult[s.id].ok ? '连接成功' : '连接失败'}
                      </span>
                    )}
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary-hover">{s.url}</a>
                  {testResult[s.id]?.error && (
                    <p className="text-xs text-red-600 mt-1 max-w-md break-words" title={testResult[s.id].error}>
                      {testResult[s.id].error}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleTest(s.id)} disabled={testing === s.id}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">
                    {testing === s.id ? '测试中...' : '测试连接'}</button>
                  <button onClick={() => handleDelete(s.id)}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && <AddSiteDialog onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function AddSiteDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', url: '', consumer_key: '', consumer_secret: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await distributorApi.createMySite(form)
      onSaved()
    } catch (err: any) { setError(err.message || '添加失败') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">添加网站</h3>
        <p className="text-sm text-slate-500 mb-4">请在您的 WooCommerce 后台 → 设置 → REST API 中创建 API 密钥，然后填入以下信息。</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">网站名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="例如：My Store" required /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">网站 URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="https://your-store.com" required /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Consumer Key</label>
            <input value={form.consumer_key} onChange={e => setForm(f => ({ ...f, consumer_key: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="ck_..." required /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Consumer Secret</label>
            <input value={form.consumer_secret} onChange={e => setForm(f => ({ ...f, consumer_secret: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="cs_..." required /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">{saving ? '添加中...' : '添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
