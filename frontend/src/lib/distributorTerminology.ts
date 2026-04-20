const DEFAULT_SITE_TERM = '站点'

export function resolveSiteTerm(term?: string | null) {
  const normalized = term?.trim()
  return normalized ? normalized : DEFAULT_SITE_TERM
}

export function replaceSiteTerm(label: string, term?: string | null) {
  return label.split(DEFAULT_SITE_TERM).join(resolveSiteTerm(term))
}
