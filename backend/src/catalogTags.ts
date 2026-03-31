/** 图册分册标签（与前端 lib/catalogTags.ts 保持一致） */
export const CATALOG_TAG_HIM = 'for him'
export const CATALOG_TAG_HER = 'for her'

/** 折叠空白并小写，用于与 Woo 返回的 For Him / for  him 等对齐（SQLite LIKE 对 ASCII 不区分大小写，JS includes 区分） */
function tagCompareKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

const KEY_HIM = tagCompareKey(CATALOG_TAG_HIM)
const KEY_HER = tagCompareKey(CATALOG_TAG_HER)

/** 将 DB/API 中的标签统一为字符串（支持 `string[]`、单枚 `{ name }`、Woo `{ name }[]` / `{ slug }[]`） */
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

export function hasCatalogTagConflict(tags: unknown): boolean {
  const list = normalizeCatalogTagNames(tags)
  let hasHim = false
  let hasHer = false
  for (const raw of list) {
    const k = tagCompareKey(raw)
    if (k === KEY_HIM) hasHim = true
    if (k === KEY_HER) hasHer = true
  }
  return hasHim && hasHer
}

export function catalogTagMessage(): string {
  return `标签 "${CATALOG_TAG_HIM}" 与 "${CATALOG_TAG_HER}" 不能同时选择`
}

/** 是否已打男士或女士图册标签（用于「进图册」校验） */
export function hasGenderCatalogTag(tags: unknown): boolean {
  const list = normalizeCatalogTagNames(tags)
  return list.some(t => {
    const k = tagCompareKey(t)
    return k === KEY_HIM || k === KEY_HER
  })
}
