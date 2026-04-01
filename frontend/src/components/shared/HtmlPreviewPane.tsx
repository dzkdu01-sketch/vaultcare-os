import { sanitizeProductHtml } from '../../lib/sanitizeProductHtml'

/** 与商品详情等处的富文本展示一致 */
export const PRODUCT_HTML_PREVIEW_CLASSES =
  'product-html-preview max-w-none whitespace-pre-wrap break-words [&_img]:max-w-full [&_img]:h-auto [&_video]:max-w-full [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5'

type Props = {
  html: string
  label?: string
  className?: string
}

/** 一期：只读预览（保存内容仍以 textarea 为准，此处仅展示消毒后的效果） */
export function HtmlPreviewPane({ html, label = '预览', className = '' }: Props) {
  const safe = sanitizeProductHtml(html)
  const empty = !html?.trim()
  const raw = html || ''
  const hasMediaHint = /<(img|video|iframe|source)\b/i.test(raw) || /\bhttps?:\/\//i.test(raw)
  const strippedHeavily =
    !empty &&
    hasMediaHint &&
    safe.length > 0 &&
    safe.length < raw.length * 0.45 &&
    raw.length > 80

  return (
    <div className={`flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="shrink-0 border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">{label}</div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-slate-800">
        {empty ? (
          <p className="text-slate-400">暂无内容</p>
        ) : (
          <div
            className={PRODUCT_HTML_PREVIEW_CLASSES}
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        )}
        {strippedHeavily && (
          <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
            部分内容可能被白名单或消毒规则移除；可在环境变量 VITE_MEDIA_HOST_WHITELIST 中追加允许的媒体域名。
          </p>
        )}
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          未写 HTML 时，每行单独粘贴视频/图片链接会自动转成预览；若仍不显示，多为域名不在白名单，可在 .env 配置 VITE_MEDIA_HOST_WHITELIST（见 .env.example）。
        </p>
      </div>
    </div>
  )
}
