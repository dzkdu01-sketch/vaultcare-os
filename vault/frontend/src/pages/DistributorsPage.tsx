import { useEffect, useState, useCallback } from 'react'
import { distributorsAPI, siteEnvsAPI } from '@/api/endpoints'
import type { Distributor, SiteEnvironment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Plus, Edit2, Globe, RefreshCw, Settings } from 'lucide-react'

interface DistributorForm {
  name: string
  type: 'self_operated' | 'distributor'
  is_active: boolean
}

interface SiteEnvForm {
  domain_a: string
  domain_b: string
  pixel_id: string
  whatsapp_number: string
  payment_method: string
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Distributor | null>(null)
  const [form, setForm] = useState<DistributorForm>({ name: '', type: 'distributor', is_active: true })
  const [saving, setSaving] = useState(false)

  // Site env editing
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const [envForm, setEnvForm] = useState<SiteEnvForm>({
    domain_a: '', domain_b: '', pixel_id: '', whatsapp_number: '', payment_method: '',
  })
  const [envDistributor, setEnvDistributor] = useState<Distributor | null>(null)
  const [envSaving, setEnvSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await distributorsAPI.list()
      setDistributors(res.data.results ?? res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', type: 'distributor', is_active: true })
    setDialogOpen(true)
  }

  const openEdit = (d: Distributor) => {
    setEditing(d)
    setForm({ name: d.name, type: d.type, is_active: d.is_active })
    setDialogOpen(true)
  }

  const openEnv = (d: Distributor) => {
    setEnvDistributor(d)
    const env = d.site_environment
    setEnvForm({
      domain_a: env?.domain_a ?? '',
      domain_b: env?.domain_b ?? '',
      pixel_id: env?.pixel_id ?? '',
      whatsapp_number: env?.whatsapp_number ?? '',
      payment_method: env?.payment_method ?? '',
    })
    setEnvDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await distributorsAPI.update(editing.id, form)
      } else {
        await distributorsAPI.create(form)
      }
      setDialogOpen(false)
      load()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleEnvSave = async () => {
    if (!envDistributor) return
    setEnvSaving(true)
    try {
      const env = envDistributor.site_environment
      if (env) {
        await siteEnvsAPI.update(env.id, envForm)
      }
      setEnvDialogOpen(false)
      load()
    } catch (e) { console.error(e) }
    finally { setEnvSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分销商管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理自营站点与亲友分销商</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />添加分销商</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {loading && (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        )}
        {!loading && distributors.length === 0 && (
          <div className="text-center py-8 text-gray-400">暂无分销商</div>
        )}
        {!loading && distributors.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{d.name}</h3>
                      <div className="flex gap-2 mt-0.5">
                        <Badge variant={d.type === 'self_operated' ? 'default' : 'secondary'}>
                          {d.type === 'self_operated' ? '自营' : '分销商'}
                        </Badge>
                        <Badge variant={d.is_active ? 'success' : 'outline'}>
                          {d.is_active ? '活跃' : '停用'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Site environment info */}
                  {d.site_environment && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {d.site_environment.domain_a && (
                        <div>
                          <p className="text-xs text-gray-400">特货域名(A站)</p>
                          <p className="text-blue-600 truncate">{d.site_environment.domain_a}</p>
                        </div>
                      )}
                      {d.site_environment.domain_b && (
                        <div>
                          <p className="text-xs text-gray-400">白页域名(B站)</p>
                          <p className="text-purple-600 truncate">{d.site_environment.domain_b}</p>
                        </div>
                      )}
                      {d.site_environment.whatsapp_number && (
                        <div>
                          <p className="text-xs text-gray-400">WhatsApp</p>
                          <p className="text-green-600">{d.site_environment.whatsapp_number}</p>
                        </div>
                      )}
                      {d.site_environment.pixel_id && (
                        <div>
                          <p className="text-xs text-gray-400">FB Pixel</p>
                          <p className="font-mono text-xs text-gray-600">{d.site_environment.pixel_id}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">注册时间：{formatDate(d.created_at)}</p>
                </div>

                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEnv(d)}>
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    站点资产
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Distributor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑分销商' : '添加分销商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：自营1组 / 分销商A" />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <select
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'self_operated' | 'distributor' })}
              >
                <option value="self_operated">自营</option>
                <option value="distributor">分销商</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active_d" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="is_active_d">启用</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site Env Dialog */}
      <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Globe className="inline h-4 w-4 mr-2 text-blue-500" />
              站点资产 — {envDistributor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>特货域名 (A站)</Label>
              <Input value={envForm.domain_a} onChange={(e) => setEnvForm({ ...envForm, domain_a: e.target.value })} placeholder="https://shop.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>白页域名 (B站)</Label>
              <Input value={envForm.domain_b} onChange={(e) => setEnvForm({ ...envForm, domain_b: e.target.value })} placeholder="https://whitepage.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp 号码</Label>
              <Input value={envForm.whatsapp_number} onChange={(e) => setEnvForm({ ...envForm, whatsapp_number: e.target.value })} placeholder="+971500000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Facebook Pixel ID</Label>
              <Input value={envForm.pixel_id} onChange={(e) => setEnvForm({ ...envForm, pixel_id: e.target.value })} placeholder="123456789012345" />
            </div>
            <div className="space-y-1.5">
              <Label>广告支付方式备注</Label>
              <Input value={envForm.payment_method} onChange={(e) => setEnvForm({ ...envForm, payment_method: e.target.value })} placeholder="虚拟卡 **** 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvDialogOpen(false)}>取消</Button>
            <Button onClick={handleEnvSave} disabled={envSaving}>{envSaving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
