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
