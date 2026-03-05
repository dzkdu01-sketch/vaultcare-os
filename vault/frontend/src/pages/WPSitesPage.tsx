import { useEffect, useState, useCallback } from 'react'
import { wpSitesAPI, distributorsAPI } from '@/api/endpoints'
import type { WPSite, Distributor } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Plus, RefreshCw, Globe, Trash2, Edit2, Upload } from 'lucide-react'

interface WPForm {
  distributor: string
  site_url: string
  consumer_key: string
  consumer_secret: string
  is_active: boolean
}

const emptyForm: WPForm = {
  distributor: '', site_url: '', consumer_key: '', consumer_secret: '', is_active: true,
}

export default function WPSitesPage() {
  const [sites, setSites] = useState<WPSite[]>([])
  const [loading, setLoading] = useState(true)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WPSite | null>(null)
  const [form, setForm] = useState<WPForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [pushing, setPushing] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sitesRes, distRes] = await Promise.all([
        wpSitesAPI.list(),
        distributorsAPI.list(),
      ])
      setSites(sitesRes.data.results ?? sitesRes.data)
      setDistributors(distRes.data.results ?? distRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: WPSite) => {
    setEditing(s)
    setForm({
      distributor: String(s.distributor),
      site_url: s.site_url,
      consumer_key: s.consumer_key,
      consumer_secret: '',
      is_active: s.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, distributor: parseInt(form.distributor) }
      if (editing) {
        await wpSitesAPI.update(editing.id, payload)
      } else {
        await wpSitesAPI.create(payload)
      }
      setDialogOpen(false)
      load()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleDelete = async (s: WPSite) => {
    if (!confirm(`确认删除站点 ${s.site_url}？`)) return
    await wpSitesAPI.delete(s.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WP 站点管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理 WordPress / WooCommerce 站点连接</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />添加站点</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {loading && <div className="text-center py-8 text-gray-400">加载中...</div>}
        {!loading && sites.length === 0 && <div className="text-center py-8 text-gray-400">暂无 WP 站点</div>}
        {!loading && sites.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="bg-orange-100 rounded-xl p-2 flex-shrink-0">
                    <Globe className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={s.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline truncate"
                      >
                        {s.site_url}
                      </a>
                      <Badge variant={s.is_active ? 'success' : 'secondary'}>
                        {s.is_active ? '活跃' : '停用'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">分销商：{s.distributor_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      最后同步：{s.last_sync ? formatDate(s.last_sync) : '从未同步'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="编辑">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s)} title="删除">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑 WP 站点' : '添加 WP 站点'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>分销商 *</Label>
              <select
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={form.distributor}
                onChange={(e) => setForm({ ...form, distributor: e.target.value })}
              >
                <option value="">选择分销商</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>站点 URL *</Label>
              <Input value={form.site_url} onChange={(e) => setForm({ ...form, site_url: e.target.value })} placeholder="https://shop.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Consumer Key *</Label>
              <Input value={form.consumer_key} onChange={(e) => setForm({ ...form, consumer_key: e.target.value })} placeholder="ck_xxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Consumer Secret {editing ? '（留空保持不变）' : '*'}</Label>
              <Input type="password" value={form.consumer_secret} onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })} placeholder="cs_xxxxxxxx" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="wp_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="wp_active">启用此站点</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
