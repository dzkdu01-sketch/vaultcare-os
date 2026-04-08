import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../services/api-client'
import { productApi } from '../../services/app-services'
import { CATALOG_TAG_HER, CATALOG_TAG_HIM } from '../../lib/catalogTags'

export function CatalogBrochurePage() {
  const [loading, setLoading] = useState<'him' | 'her' | null>(null)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<{ him: number; her: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [himData, herData] = await Promise.all([
          productApi.list({ page: 1, page_size: 1, tag: CATALOG_TAG_HIM, catalog_in: '1', status: '1' }),
          productApi.list({ page: 1, page_size: 1, tag: CATALOG_TAG_HER, catalog_in: '1', status: '1' }),
        ])
        if (!cancelled) {
          setCounts({ him: himData.pagination.total, her: herData.pagination.total })
        }
      } catch {
        if (!cancelled) setCounts({ him: 0, her: 0 })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const download = async (audience: 'him' | 'her') => {
    setError('')
    setLoading(audience)
    try {
      const blob = await productApi.downloadCatalogPng(audience)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = audience === 'him' ? 'catalog-for-him.png' : 'catalog-for-her.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      let msg = '下载失败'
      if (e instanceof ApiError) {
        const raw = e.message || ''
        if (e.status === 404 && raw.includes('Cannot GET') && raw.includes('catalog')) {
          msg =
            '图册接口不可用（404）。当前连接的 API 可能不是本仓库最新后端（缺 /product/catalog）。请在 vault-os1.1/backend 执行 npm run dev（默认端口 3002，与 Vite 代理一致）；若仍占用端口，可设置 PORT=3003 并同步修改 frontend/vite.config.ts 的 proxy.target。'
        } else if (raw.trimStart().startsWith('<')) {
          msg = raw.includes('Cannot GET')
            ? '接口返回 404（后端未注册该路由或代理未指向当前后端）。请重启 vault-os1.1 后端后再试。'
            : '服务器返回了 HTML 错误页，请检查后端日志与 API 地址。'
        } else {
          try {
            const j = JSON.parse(raw) as { message?: string }
            if (j?.message) msg = j.message
            else msg = raw || msg
          } catch {
            msg = raw || msg
          }
        }
      }
      setError(msg)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/products"
          className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          ← 返回产品列表
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">客户图册</h1>
      <p className="text-sm text-slate-600 leading-relaxed mb-8">
        仅包含<strong>已上架（Active）</strong>、已在产品列表中<strong>勾选进图册</strong>，且带有对应性别标签
        <strong> {CATALOG_TAG_HIM}</strong> 或 <strong>{CATALOG_TAG_HER}</strong> 的商品（两标签互斥）。
        草稿/下线商品可勾选进图册，但不会出现在本页统计与下载的长图中。
        下载为 <strong>PNG</strong>（无损、无 JPEG 块状伪影，文件较大）；竖版长图宽 1500px、<strong>四列</strong>白卡展陈；商品按<strong>分类名称</strong>排序，同分类内按 SKU。
        卡内共<strong>两行</strong>：①标题左对齐（单行）；②<strong>左为 SKU · 供应商绑定码（弱化）/ 右为现价 AED</strong>（同一行两端对齐），数字与 SKU 为 24px，价为<strong>主价橙</strong>（#FF6700）；<strong>不展示</strong>划线原价。
        页底浅灰、白卡轻阴影；顶栏为浅色承诺条与分册标题；分类为<strong>大字 + 留白</strong>。长图含<strong>图册生成日期</strong>（迪拜时区）；不改变商品内容与顺序。
      </p>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">下载长图</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void download('him')}
            className="flex-1 rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white px-5 py-3.5 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:shadow disabled:opacity-50"
          >
            {loading === 'him' ? '生成中…' : `下载 ${CATALOG_TAG_HIM} 图册${counts !== null ? `（${counts.him} 款）` : ''}`}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void download('her')}
            className="flex-1 rounded-xl border border-fuchsia-200 bg-gradient-to-b from-fuchsia-50 to-white px-5 py-3.5 text-sm font-semibold text-fuchsia-950 shadow-sm transition hover:border-fuchsia-300 hover:shadow disabled:opacity-50"
          >
            {loading === 'her' ? '生成中…' : `下载 ${CATALOG_TAG_HER} 图册${counts !== null ? `（${counts.her} 款）` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
