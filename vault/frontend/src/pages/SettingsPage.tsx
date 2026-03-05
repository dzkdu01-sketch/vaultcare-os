import { useEffect, useState } from 'react'
import { aiConfigAPI } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, RotateCcw, Settings } from 'lucide-react'

interface AIConfig {
  id: number
  ocr_enabled: boolean
  copywriting_enabled: boolean
  review_assistant_enabled: boolean
  primary_model: string
  fallback_model: string
  enable_fallback: boolean
  max_retries: number
  timeout_seconds: number
}

const MODEL_OPTIONS = [
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (快/便宜)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (平衡)' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (最强/贵)' },
]

export default function SettingsPage() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<AIConfig>>({})

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await aiConfigAPI.current()
      setConfig(res.data)
      setForm(res.data)
    } catch (e) {
      console.error('Failed to load AI config:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (config?.id) {
        await aiConfigAPI.update(config.id, form)
      } else {
        await aiConfigAPI.create(form)
      }
      await loadConfig()
      alert('配置已保存')
    } catch (e) {
      console.error('Failed to save AI config:', e)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-gray-900">AI 配置</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">管理 AI 模型、功能开关和降级策略</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>功能开关</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>OCR 功能</Label>
              <p className="text-sm text-gray-500">启用图片文字识别</p>
            </div>
            <input
              type="checkbox"
              checked={form.ocr_enabled ?? true}
              onChange={(e) => setForm({ ...form, ocr_enabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>文案优化</Label>
              <p className="text-sm text-gray-500">启用 AI 文案生成和优化</p>
            </div>
            <input
              type="checkbox"
              checked={form.copywriting_enabled ?? true}
              onChange={(e) => setForm({ ...form, copywriting_enabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>审核助手</Label>
              <p className="text-sm text-gray-500">启用 AI 辅助审核</p>
            </div>
            <input
              type="checkbox"
              checked={form.review_assistant_enabled ?? true}
              onChange={(e) => setForm({ ...form, review_assistant_enabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>主模型</Label>
            <Select
              value={form.primary_model}
              onValueChange={(v) => setForm({ ...form, primary_model: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>降级模型</Label>
            <Select
              value={form.fallback_model}
              onValueChange={(v) => setForm({ ...form, fallback_model: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>降级策略</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用自动降级</Label>
              <p className="text-sm text-gray-500">主模型失败时自动切换到降级模型</p>
            </div>
            <input
              type="checkbox"
              checked={form.enable_fallback ?? true}
              onChange={(e) => setForm({ ...form, enable_fallback: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label>最大重试次数</Label>
            <Input
              type="number"
              value={form.max_retries ?? 2}
              onChange={(e) => setForm({ ...form, max_retries: parseInt(e.target.value) || 2 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>超时时间 (秒)</Label>
            <Input
              type="number"
              value={form.timeout_seconds ?? 30}
              onChange={(e) => setForm({ ...form, timeout_seconds: parseInt(e.target.value) || 30 })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? '保存中...' : '保存配置'}
        </Button>
        <Button variant="outline" onClick={loadConfig}>
          <RotateCcw className="h-4 w-4 mr-1" />
          重置
        </Button>
      </div>
    </div>
  )
}
