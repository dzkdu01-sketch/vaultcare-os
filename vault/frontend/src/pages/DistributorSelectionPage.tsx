import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { distributorsAPI, productsAPI, selectionsAPI } from '@/api/endpoints'
import type { Distributor, DistributorSiteSelectionStatus, MasterSKU } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const USE_SITE_OPERATION_SIMULATE_SUCCESS =
  import.meta.env.VITE_SITE_OPERATION_SIMULATE_SUCCESS === '1'

export default function DistributorSelectionPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [products, setProducts] = useState<MasterSKU[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState('')
  const [siteStatusLoading, setSiteStatusLoading] = useState(false)
  const [siteOperatingId, setSiteOperatingId] = useState<number | null>(null)
  const [siteStatus, setSiteStatus] = useState<DistributorSiteSelectionStatus | null>(null)
  const [siteStatusSku, setSiteStatusSku] = useState<MasterSKU | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const [productRes, distributorRes] = await Promise.all([
        productsAPI.list({ page_size: 200, is_active: true }),
        distributorsAPI.list(),
      ])
      setProducts(productRes.data.results ?? productRes.data ?? [])
      const allDistributors: Distributor[] = distributorRes.data.results ?? distributorRes.data ?? []
      setDistributors(allDistributors.filter((d) => d.is_active))
      setSelectedDistributorIds((prev) => prev.filter((id) => allDistributors.some((d) => d.id === id && d.is_active)))
      setSiteStatus(null)
      setSiteStatusSku(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredProducts = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return products
    return products.filter((p) =>
      p.master_code.toLowerCase().includes(kw) ||
      p.title_en.toLowerCase().includes(kw) ||
      (p.title_ar || '').toLowerCase().includes(kw)
    )
  }, [products, keyword])

  const toggleDistributor = (id: number) => {
    setSelectedDistributorIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ))
  }

  const handleQuickSelect = (mode: 'all' | 'clear') => {
    if (mode === 'all') {
      setSelectedDistributorIds(distributors.map((d) => d.id))
      return
    }
    setSelectedDistributorIds([])
  }

  const handleSelectProduct = async (sku: MasterSKU) => {
    if (!selectedDistributorIds.length) {
      setMessage('请先选择至少一个分销商，再执行选品。')
      return
    }
    setSubmitting(sku.id)
    setMessage('')
    try {
      const res = await selectionsAPI.bulkCreate({
        distributor_ids: selectedDistributorIds,
        master_sku_id: sku.id,
      })
      const { created_count, existing_count } = res.data
      setMessage(`已处理 ${sku.master_code}：新增 ${created_count} 条，已存在 ${existing_count} 条。`)
      if (selectedDistributorIds.length === 1) {
        await loadSiteStatus(selectedDistributorIds[0], sku)
      }
    } catch (error) {
      console.error(error)
      setMessage('选品提交失败，请重试。')
    } finally {
      setSubmitting(null)
    }
  }

  const loadSiteStatus = async (distributorId: number, sku: MasterSKU) => {
    setSiteStatusLoading(true)
    try {
      const res = await distributorsAPI.getSiteSelectionStatus(distributorId, sku.id)
      setSiteStatus(res.data)
      setSiteStatusSku(sku)
    } catch (error) {
      console.error(error)
      setMessage('加载站点状态失败，请重试。')
    } finally {
      setSiteStatusLoading(false)
    }
  }

  const handleSiteOperation = async (
    action: 'publish' | 'revoke' | 'retry_sync',
    siteId: number
  ) => {
    if (!siteStatus || !siteStatusSku) return
    setSiteOperatingId(siteId)
    setMessage('')
    try {
      await distributorsAPI.siteOperation(siteStatus.distributor_id, {
        master_sku_id: siteStatusSku.id,
        site_id: siteId,
        action,
        ...(USE_SITE_OPERATION_SIMULATE_SUCCESS ? { simulate_success: true } : {}),
      })
      const actionText: Record<typeof action, string> = {
        publish: '发布',
        revoke: '撤销',
        retry_sync: '重试同步',
      }
      setMessage(`站点操作成功：${actionText[action]}。`)
      await loadSiteStatus(siteStatus.distributor_id, siteStatusSku)
    } catch (error) {
      console.error(error)
      const axiosError = error as AxiosError<{ detail?: string }>
      const detail = axiosError.response?.data?.detail
      setMessage(detail || '站点操作失败，请稍后重试。')
    } finally {
      setSiteOperatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分销商选品</h1>
          <p className="text-gray-500 text-sm mt-1">支持一次选品推送到多个分销商站点（F8 最小闭环）</p>
          {USE_SITE_OPERATION_SIMULATE_SUCCESS && (
            <p className="text-amber-600 text-xs mt-1">
              当前启用站点操作测试通道：发布/撤销将跳过真实 WP 调用，仅用于本地证据回归。
            </p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={load} title="刷新">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">目标分销商</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickSelect('all')}>全选</Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickSelect('clear')}>清空</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {distributors.map((d) => {
              const checked = selectedDistributorIds.includes(d.id)
              return (
                <label key={d.id} className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleDistributor(d.id)} />
                  <span>{d.name}</span>
                  {checked && <Badge variant="success">已选</Badge>}
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="搜索 SKU / 英文标题 / 阿语标题"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Badge variant="secondary">商品数：{filteredProducts.length}</Badge>
          </div>
          {message && <div className="text-sm text-blue-600">{message}</div>}
          {loading ? (
            <div className="text-sm text-gray-400 py-4">加载中...</div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{p.master_code}</div>
                    <div className="text-sm text-gray-600 truncate">{p.title_en}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDistributorIds.length === 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSiteStatus(selectedDistributorIds[0], p)}
                        disabled={siteStatusLoading}
                      >
                        站点状态
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleSelectProduct(p)}
                      disabled={submitting === p.id}
                    >
                      {submitting === p.id ? '处理中...' : '选品到已选分销商'}
                    </Button>
                  </div>
                </div>
              ))}
              {!filteredProducts.length && <div className="text-sm text-gray-400 py-4">暂无匹配商品</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDistributorIds.length === 1 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">站点上下文状态</h2>
              {siteStatusSku && <Badge variant="secondary">{siteStatusSku.master_code}</Badge>}
            </div>
            {!siteStatus && !siteStatusLoading && (
              <div className="text-sm text-gray-400">先点击商品行的“站点状态”查看该分销商多站点同步状态。</div>
            )}
            {siteStatusLoading && <div className="text-sm text-gray-400">加载站点状态中...</div>}
            {siteStatus && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  分销商：<span className="font-medium text-gray-900">{siteStatus.distributor_name}</span>
                </div>
                {siteStatus.sites.map((s) => (
                  <div key={s.site_id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-blue-600 truncate">{s.site_url}</div>
                      <div className="text-xs text-gray-500">
                        最后同步：{s.last_synced_at ? formatDate(s.last_synced_at) : '暂无'}
                      </div>
                      {s.sync_error && <div className="text-xs text-red-500 mt-1 truncate">{s.sync_error}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.site_active ? 'success' : 'secondary'}>{s.site_active ? '站点启用' : '站点停用'}</Badge>
                      <Badge variant={s.mapping_exists ? 'success' : 'secondary'}>
                        {s.mapping_exists ? `映射:${s.sync_status}` : '未建映射'}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSiteOperation('publish', s.site_id)}
                        disabled={siteOperatingId === s.site_id || !s.site_active}
                      >
                        发布
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSiteOperation('revoke', s.site_id)}
                        disabled={siteOperatingId === s.site_id || !s.mapping_exists}
                      >
                        撤销
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSiteOperation('retry_sync', s.site_id)}
                        disabled={siteOperatingId === s.site_id || s.sync_status !== 'failed'}
                      >
                        重试
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
