import { useEffect, useState, useCallback } from 'react'
import { suppliersAPI } from '@/api/endpoints'
import type { Supplier } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Plus, Edit2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

interface SupplierForm {
  name: string
  code_prefix: string
  settlement_cycle: string
  priority: number
  is_active: boolean
}

const emptyForm: SupplierForm = {
  name: '', code_prefix: '', settlement_cycle: '', priority: 10, is_active: true,
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await suppliersAPI.list()
      setSuppliers(res.data.results ?? res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name,
      code_prefix: s.code_prefix,
      settlement_cycle: s.settlement_cycle,
      priority: s.priority,
      is_active: s.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await suppliersAPI.update(editing.id, form)
      } else {
        await suppliersAPI.create(form)
      }
      setDialogOpen(false)
      load()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleCircuitBreaker = async (s: Supplier) => {
    const msg = s.circuit_breaker
      ? `解除 ${s.name} 的熔断？路由将恢复使用此供应商。`
      : `触发 ${s.name} 熔断？所有新订单将切至其他供应商！`
    if (!confirm(msg)) return
    await suppliersAPI.toggleCircuitBreaker(s.id, !s.circuit_breaker)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">供应商管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理 QR、VIP 等货盘供应商</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />添加供应商</Button>
        </div>
      </div>

      {/* Circuit breaker warning */}
      {suppliers.some((s) => s.circuit_breaker) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">熔断告警</p>
            <p className="text-sm text-red-600 mt-0.5">
              {suppliers.filter((s) => s.circuit_breaker).map((s) => s.name).join('、')} 已触发熔断，路由引擎将跳过这些供应商。
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {loading && <div className="text-center py-8 text-gray-400">加载中...</div>}
        {!loading && suppliers.length === 0 && <div className="text-center py-8 text-gray-400">暂无供应商</div>}
        {!loading && suppliers.map((s) => (
          <Card key={s.id} className={s.circuit_breaker ? 'border-red-300 bg-red-50' : ''}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold ${s.circuit_breaker ? 'bg-red-500' : 'bg-blue-600'}`}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{s.name}</h3>
                        {s.circuit_breaker && (
                          <Badge variant="destructive">⚡ 熔断中</Badge>
                        )}
                        {!s.circuit_breaker && s.is_active && (
                          <Badge variant="success">正常</Badge>
                        )}
                        {!s.is_active && (
                          <Badge variant="secondary">停用</Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1">
                        <span>前缀：<code className="text-blue-600">{s.code_prefix}</code></span>
                        <span>优先级：{s.priority}</span>
                        {s.settlement_cycle && <span>结算：{s.settlement_cycle}</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">创建：{formatDate(s.created_at)}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={s.circuit_breaker ? 'default' : 'destructive'}
                    size="sm"
                    onClick={() => handleCircuitBreaker(s)}
                  >
                    {s.circuit_breaker ? (
                      <><CheckCircle className="h-3.5 w-3.5 mr-1" />解除熔断</>
                    ) : (
                      <><AlertTriangle className="h-3.5 w-3.5 mr-1" />触发熔断</>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑供应商' : '添加供应商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：QR / VIP" />
            </div>
            <div className="space-y-1.5">
              <Label>编码前缀 *</Label>
              <Input value={form.code_prefix} onChange={(e) => setForm({ ...form, code_prefix: e.target.value })} placeholder="qr- / vip-" />
            </div>
            <div className="space-y-1.5">
              <Label>结算周期说明</Label>
              <Input value={form.settlement_cycle} onChange={(e) => setForm({ ...form, settlement_cycle: e.target.value })} placeholder="每2周一次" />
            </div>
            <div className="space-y-1.5">
              <Label>路由优先级（数字越小越优先）</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 10 })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sup_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="sup_active">启用此供应商</Label>
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
