/** 图册分册标签（与后端 catalogTags.ts 保持一致） */
export const CATALOG_TAG_HIM = 'for him'
export const CATALOG_TAG_HER = 'for her'

const OPPOSITE: Record<string, string> = {
  [CATALOG_TAG_HIM]: CATALOG_TAG_HER,
  [CATALOG_TAG_HER]: CATALOG_TAG_HIM,
}

function tagCompareKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

const KEY_HIM = tagCompareKey(CATALOG_TAG_HIM)
const KEY_HER = tagCompareKey(CATALOG_TAG_HER)

/** 与后端一致：支持 `string[]`、单枚 `{ name }`、Woo `{ name }` / `{ slug }` */
export function normalizeCatalogTagNames(tags: unknown): string[] {
  if (tags == null) return []
  if (typeof tags === 'string') {
    const s = tags.trim()
    return s ? [s] : []
  }
  if (!Array.isArray(tags)) {
    if (typeof tags === 'object') return normalizeCatalogTagNames([tags])
    return []
  }
  const out: string[] = []
  for (const t of tags) {
    if (typeof t === 'string') {
      const s = t.trim()
      if (s) out.push(s)
    } else if (t && typeof t === 'object') {
      const o = t as { name?: unknown; slug?: unknown }
      if (typeof o.name === 'string' && o.name.trim()) {
        out.push(o.name.trim())
      } else if (typeof o.slug === 'string') {
        const slug = o.slug.trim().toLowerCase()
        if (slug === 'for-him' || slug === 'for_him') out.push(CATALOG_TAG_HIM)
        else if (slug === 'for-her' || slug === 'for_her') out.push(CATALOG_TAG_HER)
      }
    }
  }
  return out
}

/** 切换标签时移除互斥的另一枚 */
export function hasGenderCatalogTag(tags: unknown): boolean {
  const list = normalizeCatalogTagNames(tags)
  return list.some(t => {
    const k = tagCompareKey(t)
    return k === KEY_HIM || k === KEY_HER
  })
}

export function applyCatalogTagToggle(current: string[], tag: string): string[] {
  if (!current.includes(tag)) {
    const other = OPPOSITE[tag]
    const next = other ? current.filter(t => t !== other) : [...current]
    return [...next, tag]
  }
  return current.filter(t => t !== tag)
}
