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

/** 与后端 catalogTags.dedupeGenderCatalogTags 一致：性别标签 canonical 化，多枚时保留最后一枚 */
export function dedupeGenderCatalogTags(tags: unknown): string[] {
  const list = normalizeCatalogTagNames(tags)
  let lastIdx = -1
  let lastCanon: string | null = null
  for (let i = 0; i < list.length; i++) {
    const k = tagCompareKey(list[i])
    if (k === KEY_HIM) {
      lastIdx = i
      lastCanon = CATALOG_TAG_HIM
    } else if (k === KEY_HER) {
      lastIdx = i
      lastCanon = CATALOG_TAG_HER
    }
  }
  if (lastCanon === null) {
    return list.map(t => {
      const k = tagCompareKey(t)
      if (k === KEY_HIM) return CATALOG_TAG_HIM
      if (k === KEY_HER) return CATALOG_TAG_HER
      return t
    })
  }
  const out: string[] = []
  for (let i = 0; i < list.length; i++) {
    const k = tagCompareKey(list[i])
    if (k === KEY_HIM || k === KEY_HER) {
      if (i === lastIdx) out.push(lastCanon)
      continue
    }
    out.push(list[i])
  }
  return out
}

/** 用于 UI 与 canonical 标签比较（含大小写、空格差异） */
export function tagKeyEquals(a: string, b: string): boolean {
  return tagCompareKey(a) === tagCompareKey(b)
}

export function applyCatalogTagToggle(current: string[], tag: string): string[] {
  const has = current.some(t => tagKeyEquals(t, tag))
  if (!has) {
    const canon = tagCompareKey(tag) === KEY_HIM ? CATALOG_TAG_HIM : tagCompareKey(tag) === KEY_HER ? CATALOG_TAG_HER : tag
    const other = OPPOSITE[canon] ?? OPPOSITE[tag]
    const next = other ? current.filter(t => !tagKeyEquals(t, other)) : [...current]
    return [...next, tagCompareKey(tag) === KEY_HIM || tagCompareKey(tag) === KEY_HER ? canon : tag]
  }
  return current.filter(t => !tagKeyEquals(t, tag))
}
