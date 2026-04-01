import DOMPurify from 'dompurify'

const VIDEO_URL_RE = /\.(mp4|webm|ogg)(\?|#|$)/i
const IMAGE_URL_RE = /\.(webp|jpe?g|png|gif|avif)(\?|#|$)/i
/** 整行仅为 http(s) URL（可含查询参数） */
const LINE_IS_ONLY_URL_RE = /^https?:\/\/\S+$/i
/** 已含 HTML 标签时不做「纯链接 → 富媒体」展开，避免破坏手写结构 */
const LOOKS_LIKE_HTML_RE = /<\/?[a-z][a-z0-9]*\b/i

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * 业务侧常直接粘贴每行一个视频/图片 URL。若无任何 HTML 标签，则将独立成行的媒体链接展开为标签，便于预览与前台展示。
 * 已含标签的字符串原样返回。
 */
export function expandPlainMediaLinesToHtml(input: string): string {
  const raw = input ?? ''
  if (!raw.trim()) return raw
  if (LOOKS_LIKE_HTML_RE.test(raw)) return raw

  const lines = raw.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const trimmedEnd = line.trimEnd()
    const u = trimmedEnd.trim()
    if (u === '') {
      out.push('')
      continue
    }
    if (LINE_IS_ONLY_URL_RE.test(u)) {
      if (VIDEO_URL_RE.test(u)) {
        out.push(
          `<p><video controls preload="metadata" playsinline src="${escapeHtmlAttr(u)}"></video></p>`,
        )
      } else if (IMAGE_URL_RE.test(u)) {
        out.push(`<p><img src="${escapeHtmlAttr(u)}" alt="" loading="lazy" /></p>`)
      } else if (/^https?:\/\//i.test(u)) {
        out.push(
          `<p><a href="${escapeHtmlAttr(u)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(u)}</a></p>`,
        )
      } else {
        out.push(`<p>${escapeHtmlText(trimmedEnd)}</p>`)
      }
    } else {
      out.push(`<p>${escapeHtmlText(trimmedEnd)}</p>`)
    }
  }
  return out.join('\n')
}

const DEFAULT_MEDIA_HOSTS = [
  'vaultcare-d.com',
  'www.vaultcare-d.com',
  'ik.imagekit.io',
  'res.cloudinary.com',
  'i.ytimg.com',
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
]

function mediaHostWhitelist(): Set<string> {
  const s = new Set(DEFAULT_MEDIA_HOSTS)
  const extra = import.meta.env.VITE_MEDIA_HOST_WHITELIST
  if (typeof extra === 'string' && extra.trim()) {
    for (const p of extra.split(',')) {
      const t = p.trim().toLowerCase()
      if (t) s.add(t)
    }
  }
  return s
}

function isAllowedMediaUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    const whitelist = mediaHostWhitelist()
    if (whitelist.has(host)) return true
    return [...whitelist].some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

let hooksInstalled = false

function installMediaHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    const tag = node.nodeName?.toUpperCase()
    if (tag === 'VIDEO' || tag === 'SOURCE' || tag === 'IMG') {
      if (data.attrName === 'src' || data.attrName === 'poster') {
        if (!isAllowedMediaUrl(data.attrValue)) {
          data.keepAttr = false
        }
      }
    }
    if (tag === 'IMG' && data.attrName === 'srcset') {
      data.keepAttr = false
    }
  })
}

/** 商品描述预览用：消毒 HTML，媒体 src 仅允许白名单域名 */
export function sanitizeProductHtml(html: string): string {
  installMediaHooks()
  const expanded = expandPlainMediaLinesToHtml(html || '')
  return DOMPurify.sanitize(expanded, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['video', 'source'],
    ADD_ATTR: ['controls', 'preload', 'width', 'height', 'poster', 'playsinline', 'loading', 'decoding'],
  })
}
