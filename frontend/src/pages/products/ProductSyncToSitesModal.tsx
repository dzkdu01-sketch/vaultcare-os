import type { Site } from '../../services/types'

type Props = {
  open: boolean
  sites: Site[]
  selectedIds: string[]
  onToggle: (siteId: string) => void
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

export function ProductSyncToSitesModal({
  open,
  sites,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  loading,
}: Props) {
  if (!open) return null

  const active = sites.filter(s => s.status === 'active')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sync-modal-title"
      >
        <h3 id="sync-modal-title" className="text-lg font-semibold text-slate-900">
          同步至网站
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          将当前商品推送到已选 WooCommerce / 自建站。会先保存本地修改再执行同步。
        </p>

        {active.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            暂无可用站点，请先在「站点设置」中添加并启用站点。
          </p>
        ) : (
          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            {active.map(site => {
              const checked = selectedIds.includes(site.id)
              return (
                <li key={site.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-white">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={checked}
                      onChange={() => onToggle(site.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{site.name}</span>
                      <span className="block truncate text-xs text-slate-500" title={site.url}>
                        {site.url}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading || active.length === 0 || selectedIds.length === 0}
          >
            {loading ? '处理中…' : '保存并同步'}
          </button>
        </div>
      </div>
    </div>
  )
}
