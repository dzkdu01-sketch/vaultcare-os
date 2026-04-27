/** 未配置站点设置时的默认分类/标签 */
export const DEFAULT_PRODUCT_CATEGORIES = [
  'Vibrators', 'Dildos', 'Masturbators', 'Sexual Wellness',
  'Cock Rings & Enhancers', 'ButtPlay', 'Uncategorized',
  'Strap-Ons', 'Half Body Sex Doll', 'Full Body Sex Doll',
]

export const DEFAULT_PRODUCT_TAGS = [
  'best seller', 'For Couples', 'for her', 'for him',
  'high value', 'Limited', 'New Arrival', 'Vegan',
]

export function parseTaxonomyJson(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return [...fallback]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...fallback]
    const list = parsed.map(x => String(x).trim()).filter(Boolean)
    return list.length > 0 ? list : [...fallback]
  } catch {
    return [...fallback]
  }
}

export function taxonomyToLines(items: string[]): string {
  return items.join('\n')
}

export function linesToTaxonomyJson(lines: string): string {
  const items = lines
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  return JSON.stringify(items)
}

/**
 * 当商品已有 category，但该字符串不在「管理端配置的分类列表」里时，
 * 浏览器 `<select value>` 会无匹配行而显示为空白。把当前值补成一项即可。
 */
export function categoryOrphanInList(allowed: string[], current: string | undefined | null): string | null {
  const c = (current ?? '').trim()
  if (!c) return null
  return allowed.includes(c) ? null : c
}
