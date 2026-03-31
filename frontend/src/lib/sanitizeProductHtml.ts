import DOMPurify from 'dompurify'

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
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['video', 'source'],
    ADD_ATTR: ['controls', 'preload', 'width', 'height', 'poster'],
  })
}
