import { useEffect, useMemo, useState } from 'react'
import { Building2, ChevronRight, Globe, Layers, Unlink } from 'lucide-react'
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_TAGS,
  linesToTaxonomyJson,
  parseTaxonomyJson,
  taxonomyToLines,
} from '../../lib/productTaxonomy'
import { replaceSiteTerm, resolveSiteTerm } from '../../lib/distributorTerminology'
import { getSessionUser } from '../../app/store/auth-store'
import { distributorApi, operatorApi, settingsApi, siteApi } from '../../services/app-services'
import type { Distributor, DistributorInput, Site, SiteInput } from '../../services/types'

type ManagedSite = Site & {
  distributor_id?: string
  distributor_name?: string
  distributor_code?: string
  webhook_secret?: string
}

type DistributorRecord = Distributor & {
  site_display_name?: string
}

type OperatorTabKey = 'distributors' | 'operators' | 'config'
type DistributorSelection = number | 'unbound' | null
type DistributorTabKey = 'organization' | 'sites' | 'terminology'

export function SiteSettingsPage() {
  const currentUser = getSessionUser()

  if (currentUser?.role === 'distributor') {
    return <DistributorManagementCenter />
  }

  return <OperatorManagementCenter />
}

function SectionTabs<T extends string>({ tabs, activeTab, onChange }: {
  tabs: Array<{ key: T; label: string }>
  activeTab: T
  onChange: (tab: T) => void
}) {
  return (
    <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function OperatorManagementCenter() {
  const [tab, setTab] = useState<OperatorTabKey>('distributors')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">管理中心</h2>
        <p className="text-sm text-slate-500">统一管理分销商及其站点资产、内部账号和系统配置。</p>
      </header>

      <SectionTabs
        tabs={[
          { key: 'distributors', label: '分销商管理' },
          { key: 'operators', label: '内部账号' },
          { key: 'config', label: '系统配置' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === 'distributors' && <DistributorManagementTab />}
      {tab === 'operators' && <OperatorAccountsTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  )
}

function DistributorManagementCenter() {
  const [tab, setTab] = useState<DistributorTabKey>('organization')
  const [organization, setOrganization] = useState<DistributorRecord | null>(null)
  const [sites, setSites] = useState<ManagedSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ManagedSite | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [siteDisplayNameDraft, setSiteDisplayNameDraft] = useState('')
  const [savingTerm, setSavingTerm] = useState(false)

  const siteTerm = useMemo(() => resolveSiteTerm(organization?.site_display_name), [organization?.site_display_name])

  const load = async () => {
    setLoading(true)
    try {
      const [org, mySites] = await Promise.all([
        distributorApi.myOrganization(),
        distributorApi.mySites(),
      ])
      setOrganization(org)
      setSiteDisplayNameDraft(org.site_display_name || '')
      setSites(mySites)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const result = await distributorApi.testMySite(id)
      setTestResult(prev => ({ ...prev, [id]: { ok: result.connected, error: result.error } }))
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [id]: { ok: false, error: err.message } }))
    } finally {
      setTesting(null)
    }
  }

  const handleToggle = async (site: ManagedSite) => {
    await distributorApi.updateMySite(site.id, {
      status: site.status === 'active' ? 'inactive' : 'active',
    })
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(replaceSiteTerm('确定删除该站点？有订单的站点无法删除。', siteTerm))) return
    try {
      await distributorApi.deleteMySite(id)
      await load()
    } catch (err: any) {
      alert(err.message || replaceSiteTerm('删除站点失败', siteTerm))
    }
  }

  const handleSaveTerminology = async () => {
    setSavingTerm(true)
    try {
      const updated = await distributorApi.updateMyOrganization({ site_display_name: siteDisplayNameDraft })
      setOrganization(updated)
      setSiteDisplayNameDraft(updated.site_display_name || '')
    } finally {
      setSavingTerm(false)
    }
  }

  if (loading) return <div className="p-4 text-slate-500">加载中...</div>

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">管理中心</h2>
        <p className="text-sm text-slate-500">围绕您的组织、账号和 {siteTerm} 资产进行自助管理。</p>
      </header>

      <SectionTabs
        tabs={[
          { key: 'organization', label: '组织与账号' },
          { key: 'sites', label: `${siteTerm}资产` },
          { key: 'terminology', label: '显示术语' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === 'organization' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="组织名称" value={organization?.name || '-'} />
          <InfoCard label="成员代码" value={organization?.code || '-'} mono />
          <InfoCard label="登录账号" value={organization?.username || '-'} mono />
          <InfoCard label={`${siteTerm}术语`} value={siteTerm} />
        </section>
      )}

      {tab === 'sites' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{`我的${siteTerm}`}</h3>
              <p className="text-sm text-slate-500">{replaceSiteTerm('管理您的 WooCommerce 站点，用于接收订单自动同步。', siteTerm)}</p>
            </div>
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
            >
              {`添加${siteTerm}`}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {sites.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mb-2 text-slate-500">{replaceSiteTerm('暂无站点', siteTerm)}</div>
                <p className="mb-4 text-sm text-slate-400">{replaceSiteTerm('添加您的 WooCommerce 站点以自动接收和同步订单。', siteTerm)}</p>
                <button
                  onClick={() => { setEditing(null); setShowForm(true) }}
                  className="text-sm font-medium text-primary hover:text-primary-hover"
                >
                  {`点击添加第一个${siteTerm}`}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sites.map(site => (
                  <div key={site.id} className="flex items-start justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-slate-900">{site.name}</h4>
                        <button
                          type="button"
                          onClick={() => void handleToggle(site)}
                          className={`rounded-full px-2 py-0.5 text-xs ${site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {site.status === 'active' ? '启用' : '停用'}
                        </button>
                        {testResult[site.id] && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${testResult[site.id].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {testResult[site.id].ok ? '连接成功' : '连接失败'}
                          </span>
                        )}
                      </div>
                      <a href={site.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:text-primary-hover">
                        {site.url}
                      </a>
                      {testResult[site.id]?.error && <p className="mt-1 max-w-md break-words text-xs text-red-600">{testResult[site.id].error}</p>}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void handleTest(site.id)}
                        disabled={testing === site.id}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                      >
                        {testing === site.id ? '测试中...' : '测试连接'}
                      </button>
                      <button
                        onClick={() => { setEditing(site); setShowForm(true) }}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => void handleDelete(site.id)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showForm && (
            <DistributorSiteFormDialog
              site={editing}
              siteTerm={siteTerm}
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); void load() }}
            />
          )}
        </section>
      )}

      {tab === 'terminology' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">显示术语</h3>
            <p className="text-sm text-slate-500">仅影响您的前台显示文案，不改变系统内部数据模型。</p>
          </div>

          <div className="max-w-sm">
            <label className="mb-1 block text-sm font-medium text-slate-700">站点显示名称</label>
            <input
              value={siteDisplayNameDraft}
              onChange={e => setSiteDisplayNameDraft(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例如：门店 / 店铺 / 网站"
            />
          </div>

          <div className="text-sm text-slate-500">
            当前预览：{replaceSiteTerm('我的站点 / 添加站点 / 站点资产', siteDisplayNameDraft)}
          </div>

          <button
            onClick={() => void handleSaveTerminology()}
            disabled={savingTerm}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {savingTerm ? '保存中...' : '保存术语'}
          </button>
        </section>
      )}
    </div>
  )
}

function DistributorManagementTab() {
  const [distributors, setDistributors] = useState<DistributorRecord[]>([])
  const [sites, setSites] = useState<ManagedSite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DistributorSelection>(null)
  const [showDistributorForm, setShowDistributorForm] = useState(false)
  const [editingDistributor, setEditingDistributor] = useState<DistributorRecord | null>(null)
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSite, setEditingSite] = useState<ManagedSite | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [siteRows, distributorRows] = await Promise.all([siteApi.list(), distributorApi.list()])
      setSites(siteRows)
      setDistributors(distributorRows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const unboundCount = useMemo(
    () => sites.filter(s => !s.distributor_id || s.distributor_id === '').length,
    [sites],
  )

  useEffect(() => {
    if (loading) return
    if (selected === null) {
      if (distributors.length > 0) setSelected(distributors[0].id)
      else if (unboundCount > 0) setSelected('unbound')
    }
  }, [loading, distributors, unboundCount, selected])

  useEffect(() => {
    if (typeof selected !== 'number') return
    const exists = distributors.some(d => d.id === selected)
    if (!exists) {
      if (distributors.length > 0) setSelected(distributors[0].id)
      else if (unboundCount > 0) setSelected('unbound')
      else setSelected(null)
    }
  }, [distributors, selected, unboundCount])

  const filteredSites = useMemo(() => {
    if (selected === null) return []
    if (selected === 'unbound') return sites.filter(s => !s.distributor_id || s.distributor_id === '')
    return sites.filter(s => String(s.distributor_id) === String(selected))
  }, [sites, selected])

  const selectedDistributor = useMemo(
    () => (typeof selected === 'number' ? distributors.find(d => d.id === selected) : undefined),
    [distributors, selected],
  )

  const siteCountByDistributorId = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of sites) {
      if (s.distributor_id === undefined || s.distributor_id === '' || s.distributor_id === null) continue
      const id = Number(s.distributor_id)
      if (Number.isNaN(id)) continue
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [sites])

  const defaultDistributorIdForNewSite =
    typeof selected === 'number' ? String(selected) : ''

  const handleDeleteDistributor = async (id: number) => {
    if (!confirm('确定删除该分销商？有订单时无法删除。')) return
    try {
      await distributorApi.remove(id)
      await load()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  const handleToggleDistributor = async (distributor: DistributorRecord) => {
    await distributorApi.update(distributor.id, {
      status: distributor.status === 'active' ? 'disabled' : 'active',
    } as any)
    await load()
  }

  const handleTestSite = async (id: string) => {
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

  const handleToggleSite = async (site: ManagedSite) => {
    await siteApi.update(site.id, { status: site.status === 'active' ? 'inactive' : 'active' })
    await load()
  }

  const handleDeleteSite = async (id: string) => {
    if (!confirm('确定删除该站点？关联的订单和同步记录存在时无法删除。')) return
    try {
      await siteApi.remove(id)
      await load()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  if (loading) return <div className="p-4 text-slate-500">加载中...</div>

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-500 to-sky-600" aria-hidden />
        <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6 sm:pl-7">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-md shadow-sky-500/25">
              <Layers className="h-6 w-6" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">配置模块</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">分销商管理</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                维护<strong className="font-medium text-slate-800">分销商组织</strong>及其下属的
                <strong className="font-medium text-slate-800"> WooCommerce 站点</strong>接入；右侧站点随左侧选中组织联动。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 text-[10px] font-bold text-slate-600">1</span>
                  选组织
                </span>
                <span className="hidden text-slate-300 sm:inline" aria-hidden>
                  →
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-950">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-200 text-[10px] font-bold text-sky-800">2</span>
                  管站点
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/50 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
            <Building2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate font-medium text-slate-800">组织</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
            <Globe className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            <span className="truncate font-medium text-slate-800">站点</span>
          </div>
          <span className="text-xs text-slate-500">一对多</span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,24rem)_1fr] lg:divide-x lg:divide-slate-100">
          {/* 父级：分销商 */}
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-900">组织列表</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">点击一行以切换右侧站点范围</p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingDistributor(null); setShowDistributorForm(true) }}
                className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
              >
                添加分销商
              </button>
            </div>

            {distributors.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-8 text-center text-sm text-slate-500">
                还没有分销商，请先添加。
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/80">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">组织与账号</th>
                      <th className="hidden w-[4.5rem] sm:table-cell px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">站点</th>
                      <th className="w-[7.5rem] px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributors.map(d => {
                      const isSel = selected === d.id
                      const subCount = siteCountByDistributorId.get(d.id) ?? 0
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelected(d.id)}
                          aria-current={isSel ? 'true' : undefined}
                          className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 ${isSel ? 'bg-sky-50/90' : 'hover:bg-slate-50/90'}`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isSel ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                                aria-hidden
                              >
                                <Building2 className="h-4 w-4" strokeWidth={2} />
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium leading-snug text-slate-900">{d.name}</div>
                                <div className="mt-0.5 truncate text-[11px] leading-tight text-slate-500 font-mono">{d.username} · {d.code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-1 py-3 text-center align-middle">
                            <span
                              className="inline-flex min-w-[2.5rem] justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700"
                              title="该组织下站点数量"
                            >
                              {subCount}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right align-middle" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void handleToggleDistributor(d)}
                                className={`rounded-full px-2 py-1 text-[11px] font-medium ${d.status === 'active' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-800 ring-1 ring-rose-100'}`}
                              >
                                {d.status === 'active' ? '启用' : '停用'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingDistributor(d); setShowDistributorForm(true) }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteDistributor(d.id)}
                                className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {unboundCount > 0 && (
              <button
                type="button"
                onClick={() => setSelected('unbound')}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition ${selected === 'unbound' ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
                  <Unlink className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">未绑定组织的站点</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-500">共 {unboundCount} 个 · 可选中后在右侧管理</div>
                </div>
              </button>
            )}
          </div>

          {/* 子级：站点 */}
          <div className="min-h-[14rem] space-y-4 border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5 lg:border-t-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-slate-900">站点列表</h4>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selected !== null && selected !== 'unbound' && selectedDistributor && (
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-sky-200/80 bg-white px-3 py-1 text-xs text-sky-950 shadow-sm">
                      <span className="text-slate-500">当前组织</span>
                      <span className="font-semibold">{selectedDistributor.name}</span>
                      <span className="font-mono text-slate-500">{selectedDistributor.code}</span>
                    </span>
                  )}
                  {selected === 'unbound' && (
                    <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-950">
                      当前：未绑定到任何组织
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {selected === null
                    ? '请先在左侧选择一个组织，或选中上方「未绑定组织的站点」。'
                    : '以下为当前组织范围内的 WooCommerce 站点，可进行连接测试与启停。'}
                </p>
              </div>
              <button
                type="button"
                disabled={selected === null}
                onClick={() => { setEditingSite(null); setShowSiteForm(true) }}
                className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                添加站点
              </button>
            </div>

            {selected === null ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm leading-relaxed text-slate-500">
                请先在左侧选择<strong className="font-medium text-slate-700">一个组织</strong>
                {unboundCount > 0 ? '，或选择「未绑定组织的站点」。' : '。'}
              </div>
            ) : filteredSites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm leading-relaxed text-slate-500">
                当前范围内暂无站点
                {selected !== 'unbound' && (
                  <>
                    <br />
                    <span className="text-slate-400">使用右上角「添加站点」可归属到当前组织。</span>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-3" aria-label="站点列表">
                {filteredSites.map(site => (
                  <li key={site.id}>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/80">
                      <div className="border-l-[3px] border-l-sky-500 px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              <h4 className="text-base font-semibold text-slate-900">{site.name}</h4>
                              <button
                                type="button"
                                onClick={() => void handleToggleSite(site)}
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${site.status === 'active' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {site.status === 'active' ? '启用' : '停用'}
                              </button>
                              {testResult[site.id] && (
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${testResult[site.id].ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                  {testResult[site.id].ok ? '连接成功' : '连接失败'}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 truncate text-sm text-slate-600">{site.url}</p>
                            {site.webhook_secret && (
                              <p className="mt-1 font-mono text-[11px] text-slate-400">Webhook: {site.webhook_secret.slice(0, 8)}...</p>
                            )}
                            {testResult[site.id]?.error && (
                              <p className="mt-2 max-w-xl break-words text-xs leading-relaxed text-red-600">{testResult[site.id].error}</p>
                            )}
                          </div>
                          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[12rem] sm:flex-row sm:flex-wrap sm:justify-end">
                            <button
                              type="button"
                              onClick={() => void handleTestSite(site.id)}
                              disabled={testing === site.id}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                            >
                              {testing === site.id ? '测试中...' : '测试连接'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingSite(site); setShowSiteForm(true) }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSite(site.id)}
                              className="w-full rounded-lg border border-red-100 bg-white px-3 py-2 text-center text-xs font-medium text-red-600 hover:bg-red-50 sm:w-auto"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showDistributorForm && (
        <DistributorFormDialog
          distributor={editingDistributor}
          onClose={() => setShowDistributorForm(false)}
          onSaved={() => { setShowDistributorForm(false); void load() }}
        />
      )}

      {showSiteForm && (
        <SiteFormDialog
          site={editingSite}
          distributors={distributors}
          defaultDistributorId={editingSite ? undefined : defaultDistributorIdForNewSite}
          onClose={() => setShowSiteForm(false)}
          onSaved={() => { setShowSiteForm(false); void load() }}
        />
      )}
    </section>
  )
}

function SiteFormDialog({ site, distributors, defaultDistributorId, onClose, onSaved }: {
  site: ManagedSite | null
  distributors: DistributorRecord[]
  /** 新建站点时预选的绑定分销商（总部从「分销商管理」右侧打开时传入） */
  defaultDistributorId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<SiteInput & { webhook_secret?: string; distributor_id?: string }>({
    name: site?.name || '',
    url: site?.url || '',
    consumer_key: site?.consumer_key || '',
    consumer_secret: site?.consumer_secret || '',
    webhook_secret: site?.webhook_secret || '',
    distributor_id: site?.distributor_id || defaultDistributorId || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (site) {
        await siteApi.update(site.id, form as any)
      } else {
        await siteApi.create(form)
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{site ? '编辑站点' : '添加站点'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium text-slate-700">站点名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">站点 URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://your-store.com" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Consumer Key</label>
            <input value={form.consumer_key} onChange={e => setForm(f => ({ ...f, consumer_key: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="ck_..." required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Consumer Secret</label>
            <input value={form.consumer_secret} onChange={e => setForm(f => ({ ...f, consumer_secret: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="cs_..." required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Webhook Secret <span className="font-normal text-slate-400">(可选)</span></label>
            <input value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="用于验证 Webhook 推送签名" /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">绑定分销商 <span className="font-normal text-slate-400">(可选)</span></label>
            <select value={form.distributor_id} onChange={e => setForm(f => ({ ...f, distributor_id: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">未绑定</option>
              {distributors.map(distributor => <option key={distributor.id} value={String(distributor.id)}>{distributor.name} ({distributor.code})</option>)}
            </select></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DistributorSiteFormDialog({ site, siteTerm, onClose, onSaved }: {
  site: ManagedSite | null
  siteTerm: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: site?.name || '',
    url: site?.url || '',
    consumer_key: site?.consumer_key || '',
    consumer_secret: site?.consumer_secret || '',
    status: site?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (site) {
        await distributorApi.updateMySite(site.id, form)
      } else {
        await distributorApi.createMySite(form)
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || replaceSiteTerm('保存站点失败', siteTerm))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{site ? `编辑${siteTerm}` : `添加${siteTerm}`}</h3>
        <p className="mb-4 text-sm text-slate-500">请在您的 WooCommerce 后台创建 API 密钥，然后填入以下信息。</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium text-slate-700">{`${siteTerm}名称`}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">{`${siteTerm} URL`}</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://your-store.com" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Consumer Key</label>
            <input value={form.consumer_key} onChange={e => setForm(f => ({ ...f, consumer_key: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="ck_..." required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Consumer Secret</label>
            <input value={form.consumer_secret} onChange={e => setForm(f => ({ ...f, consumer_secret: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="cs_..." required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">状态</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Site['status'] }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OperatorAccountsTab() {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpForm, setShowOpForm] = useState(false)
  const [editingOp, setEditingOp] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setOperators(await operatorApi.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleDeleteOp = async (id: number) => {
    if (!confirm('确定删除该操作员？至少需保留一个。')) return
    try {
      await operatorApi.remove(id)
      await load()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  if (loading) return <div className="p-4 text-slate-500">加载中...</div>

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">内部账号</h3>
          <p className="text-sm text-slate-500">单独维护总部操作员账号，避免与分销商组织账号混用。</p>
        </div>
        <button onClick={() => { setEditingOp(null); setShowOpForm(true) }} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
          添加操作员
        </button>
      </div>

      {operators.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">还没有操作员</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">名称</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">用户名</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">状态</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {operators.map(operator => (
                <tr key={operator.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{operator.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{operator.username}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${operator.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {operator.status === 'active' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditingOp(operator); setShowOpForm(true) }} className="mr-1 rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">编辑</button>
                    <button onClick={() => void handleDeleteOp(operator.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showOpForm && <OperatorFormDialog operator={editingOp} onClose={() => setShowOpForm(false)} onSaved={() => { setShowOpForm(false); void load() }} />}
    </section>
  )
}

function DistributorFormDialog({ distributor, onClose, onSaved }: {
  distributor: DistributorRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: distributor?.name || '',
    code: distributor?.code || '',
    username: distributor?.username || '',
    password: '',
    site_display_name: distributor?.site_display_name || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (distributor) {
        const updates: any = {
          name: form.name,
          code: form.code,
          username: form.username,
          site_display_name: form.site_display_name,
        }
        if (form.password) updates.password = form.password
        await distributorApi.update(distributor.id, updates)
      } else {
        if (!form.password) {
          setError('请设置密码')
          setSaving(false)
          return
        }
        await distributorApi.create(form as DistributorInput & { site_display_name?: string })
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{distributor ? '编辑分销商' : '添加分销商'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium text-slate-700">名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">成员代码 <span className="text-xs font-normal text-orange-500">(用于订单编号，如 K → VC0416K)</span></label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase" required maxLength={5} placeholder="1-5位字母" /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">登录用户名</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" required /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">站点显示术语 <span className="font-normal text-slate-400">(可选)</span></label>
            <input value={form.site_display_name} onChange={e => setForm(f => ({ ...f, site_display_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="例如：门店 / 店铺 / 网站" /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">{distributor ? '新密码 (留空不修改)' : '密码'}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required={!distributor} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OperatorFormDialog({ operator, onClose, onSaved }: { operator: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: operator?.name || '', username: operator?.username || '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (operator) {
        const updates: any = { name: form.name, username: form.username }
        if (form.password) updates.password = form.password
        await operatorApi.update(operator.id, updates)
      } else {
        if (!form.password) { setError('请设置密码'); setSaving(false); return }
        await operatorApi.create(form)
      }
      onSaved()
    } catch (err: any) { setError(err.message || '保存失败') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{operator ? '编辑操作员' : '添加操作员'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">名称</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" required /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">登录用户名</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" required /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">{operator ? '新密码 (留空不修改)' : '密码'}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" required={!operator} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfigTab() {
  const [exchangeRate, setExchangeRate] = useState('1.95')
  const [savedRate, setSavedRate] = useState('1.95')
  const [savingRate, setSavingRate] = useState(false)
  const [categoryLines, setCategoryLines] = useState(() => taxonomyToLines(DEFAULT_PRODUCT_CATEGORIES))
  const [tagLines, setTagLines] = useState(() => taxonomyToLines(DEFAULT_PRODUCT_TAGS))
  const [savingTaxonomy, setSavingTaxonomy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    settingsApi.get().then(settings => {
      if (settings.exchange_rate) { setExchangeRate(settings.exchange_rate); setSavedRate(settings.exchange_rate) }
      setCategoryLines(taxonomyToLines(parseTaxonomyJson(settings.product_categories_json, DEFAULT_PRODUCT_CATEGORIES)))
      setTagLines(taxonomyToLines(parseTaxonomyJson(settings.product_tags_json, DEFAULT_PRODUCT_TAGS)))
    })
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const handleSaveRate = async () => {
    const val = parseFloat(exchangeRate)
    if (isNaN(val) || val <= 0) return
    setSavingRate(true)
    try { await settingsApi.update('exchange_rate', String(val)); setSavedRate(String(val)); showToast('汇率已保存') }
    finally { setSavingRate(false) }
  }

  const handleSaveTaxonomy = async () => {
    setSavingTaxonomy(true)
    try {
      await Promise.all([
        settingsApi.update('product_categories_json', linesToTaxonomyJson(categoryLines)),
        settingsApi.update('product_tags_json', linesToTaxonomyJson(tagLines)),
      ])
      showToast('分类与标签已保存')
    } finally { setSavingTaxonomy(false) }
  }

  return (
    <div className="space-y-8 relative">
      {toast && <div className="fixed top-20 right-6 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">{toast}</div>}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">汇率设置</h2>
          <p className="text-sm text-slate-500">用于计算利润率，当前 1 AED ≈ {savedRate} CNY</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">AED → CNY 汇率</label>
              <input type="number" step="0.01" min="0" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
            <button onClick={handleSaveRate} disabled={savingRate || exchangeRate === savedRate}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">
              {savingRate ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">商品分类与标签</h2>
          <p className="text-sm text-slate-500">每行一项；保存后产品编辑页与列表筛选下拉将使用此处配置。</p>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
            <textarea value={categoryLines} onChange={e => setCategoryLines(e.target.value)} rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="每行一个分类名称" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">标签</label>
            <textarea value={tagLines} onChange={e => setTagLines(e.target.value)} rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono" placeholder="每行一个标签" /></div>
          <button onClick={() => void handleSaveTaxonomy()} disabled={savingTaxonomy}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50">
            {savingTaxonomy ? '保存中...' : '保存分类与标签'}</button>
        </div>
      </section>
    </div>
  )
}
