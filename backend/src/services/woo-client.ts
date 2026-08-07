/**
 * WooCommerce REST API v3 客户端
 * 使用 Basic Auth (consumer_key:consumer_secret)
 */

export interface WooSite {
  url: string
  consumer_key: string
  consumer_secret: string
}

export interface WooProduct {
  id?: number
  name: string
  sku: string
  regular_price?: string
  sale_price?: string
  description?: string
  short_description?: string
  images?: Array<{ src: string; name?: string }>
  /**
   * 从 WC 拉取时常见 `{ id, name, slug }`；写入时须带 **id**；仅传 `{ name }` 对商品常无效。
   */
  categories?: Array<{ id: number; name?: string; slug?: string }>
  tags?: Array<{ id?: number; name?: string; slug?: string }>
  status?: string
}

export interface WooProductCategoryTerm {
  id: number
  name: string
  slug?: string
}

export interface WooProductTagTerm {
  id: number
  name: string
  slug?: string
}

function normalizeCategorySlugCandidate(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const slug = trimmed
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/['"]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || trimmed.toLowerCase()
}

function parseTermExistsResourceId(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/"resource_id"\s*:\s*(\d+)/)
  if (!m) return null
  const id = Number.parseInt(m[1], 10)
  return Number.isFinite(id) ? id : null
}

async function findCategoryBySlug(site: WooSite, slug: string): Promise<WooProductCategoryTerm | null> {
  const list = await wooFetch<WooProductCategoryTerm[]>(
    site,
    `/products/categories?slug=${encodeURIComponent(slug)}&per_page=100`,
  )
  const target = slug.toLowerCase()
  const exact = list.find((c) => (c.slug || '').toLowerCase() === target)
  return exact || null
}

async function findTagBySlug(site: WooSite, slug: string): Promise<WooProductTagTerm | null> {
  const list = await wooFetch<WooProductTagTerm[]>(
    site,
    `/products/tags?slug=${encodeURIComponent(slug)}&per_page=100`,
  )
  const target = slug.toLowerCase()
  const exact = list.find((t) => (t.slug || '').toLowerCase() === target)
  return exact || null
}

export interface WooOrder {
  id: number
  number: string
  status: string
  total: string
  currency: string
  payment_method_title?: string
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address_1: string
    city: string
    country: string
  }
  shipping: {
    first_name: string
    last_name: string
    address_1: string
    city: string
    country: string
  }
  line_items: Array<{
    id: number
    name: string
    product_id: number
    sku: string
    quantity: number
    total: string
  }>
  meta_data?: Array<{ key: string; value: unknown }>
  date_created: string
  date_modified: string
}

/**
 * WhatsApp：常见 checkout 插件写入 meta；若无专用字段，多数店铺会用 billing.phone 作为联系电话（与 WhatsApp 同号）。
 */
export function extractCustomerWhatsappFromWooOrder(order: WooOrder): string {
  const meta = order.meta_data || []
  const exact = new Set([
    '_billing_whatsapp',
    'billing_whatsapp',
    'whatsapp',
    '_whatsapp',
  ])
  for (const m of meta) {
    const k = String(m?.key ?? '')
    if (!k) continue
    const raw = m?.value
    const v = raw != null && typeof raw === 'object' ? JSON.stringify(raw) : String(raw ?? '')
    const trimmed = v.trim()
    if (!trimmed) continue
    if (exact.has(k) || /whatsapp/i.test(k)) return trimmed
  }
  const billingPhone = (order.billing?.phone || '').trim()
  if (billingPhone) return billingPhone
  const shipPhone = String((order.shipping as { phone?: string })?.phone ?? '').trim()
  if (shipPhone) return shipPhone
  return ''
}

function authHeader(site: WooSite): string {
  const token = Buffer.from(`${site.consumer_key}:${site.consumer_secret}`).toString('base64')
  return `Basic ${token}`
}

async function wooFetch<T>(site: WooSite, endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${site.url.replace(/\/$/, '')}/wp-json/wc/v3${endpoint}`
  const method = (options.method || 'GET').toUpperCase()
  const startedAt = Date.now()
  // [TEMP-DIAG] 同步失败根因定位：打印每次 Woo 请求的 URL/方法/耗时/错误详情
  console.log(`[wooFetch] → ${method} ${url}`)
  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader(site),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (err: any) {
    // undici 的 "fetch failed" 实际根因藏在 err.cause，必须打全才能定位
    const cause = err?.cause
    const causeInfo = cause && typeof cause === 'object' ? {
      message: cause.message,
      code: cause.code,         // e.g. ENOTFOUND / ETIMEDOUT / ECONNREFUSED
      errno: cause.errno,
      syscall: cause.syscall,   // e.g. getaddrinfo / connect
      address: cause.address,   // 解析失败的域名
      port: cause.port,
      stack: cause.stack?.split('\n').slice(0, 3).join('\n'),
    } : cause
    console.error(`[wooFetch] ✗ FAILED ${method} ${url} (${Date.now() - startedAt}ms)`, {
      errMessage: err?.message,
      errCode: err?.code,
      errName: err?.name,
      cause: causeInfo,
    })
    throw err
  }
  const elapsed = Date.now() - startedAt
  console.log(`[wooFetch] ← ${res.status} ${method} ${url} (${elapsed}ms)`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WooCommerce API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/** 测试站点连接（用商品列表接口，与常见「只读」API 密钥权限一致；避免 system_status 需管理员权限导致误报失败） */
export async function testConnection(site: WooSite): Promise<{ ok: boolean; error?: string }> {
  try {
    await wooFetch<unknown[]>(site, '/products?per_page=1')
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message || String(err)
    return { ok: false, error: msg }
  }
}

/** 创建产品 */
export async function createProduct(site: WooSite, product: WooProduct): Promise<WooProduct> {
  return wooFetch<WooProduct>(site, '/products', {
    method: 'POST',
    body: JSON.stringify(product),
  })
}

/** 更新产品 */
export async function updateProduct(site: WooSite, wooId: number, product: Partial<WooProduct>): Promise<WooProduct> {
  return wooFetch<WooProduct>(site, `/products/${wooId}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  })
}

/** 按 SKU 查找产品 */
export async function findProductBySku(site: WooSite, sku: string): Promise<WooProduct | null> {
  const results = await wooFetch<WooProduct[]>(site, `/products?sku=${encodeURIComponent(sku)}`)
  return results.length > 0 ? results[0] : null
}

/**
 * 将中台分类「名称」解析为 Woo **产品分类 term id**。
 * WC REST 在 PUT/POST 商品时，categories 应使用 `{ id }`；只传 `name` 常会被静默忽略，前台一直 Uncategorized。
 * 先按名称搜索，没有则 `POST /products/categories` 创建（需密钥具备写分类权限）。
 */
export async function resolveProductCategoryId(
  site: WooSite,
  name: string,
  cache?: Map<string, number>,
): Promise<number | null> {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  const nameKey = `name:${trimmed.toLowerCase()}`
  if (cache?.has(nameKey)) {
    return cache.get(nameKey)!
  }
  const isLikelySlugInput = /^[a-z0-9_-]+$/i.test(trimmed)
  const slugCandidates = new Set<string>()
  if (isLikelySlugInput) slugCandidates.add(trimmed.toLowerCase().replace(/_/g, '-'))
  const derivedSlug = normalizeCategorySlugCandidate(trimmed)
  if (derivedSlug) slugCandidates.add(derivedSlug)

  for (const slug of slugCandidates) {
    const slugKey = `slug:${slug}`
    if (cache?.has(slugKey)) return cache.get(slugKey)!
  }

  for (const slug of slugCandidates) {
    const bySlug = await findCategoryBySlug(site, slug)
    if (bySlug?.id) {
      cache?.set(nameKey, bySlug.id)
      cache?.set(`slug:${slug}`, bySlug.id)
      return bySlug.id
    }
  }

  const list = await wooFetch<WooProductCategoryTerm[]>(
    site,
    `/products/categories?search=${encodeURIComponent(trimmed)}&per_page=100`,
  )
  const exact = list.find((c) => {
    const nameMatched = Boolean(c.name && c.name.toLowerCase() === trimmed.toLowerCase())
    const slugMatched = Boolean(c.slug && slugCandidates.has(c.slug.toLowerCase()))
    return nameMatched || slugMatched
  })
  if (exact?.id) {
    cache?.set(nameKey, exact.id)
    if (exact.slug) cache?.set(`slug:${exact.slug.toLowerCase()}`, exact.id)
    return exact.id
  }
  try {
    const createPayload =
      isLikelySlugInput
        ? { name: trimmed, slug: Array.from(slugCandidates)[0] }
        : { name: trimmed }
    const created = await wooFetch<WooProductCategoryTerm>(site, '/products/categories', {
      method: 'POST',
      body: JSON.stringify(createPayload),
    })
    if (created?.id) {
      cache?.set(nameKey, created.id)
      if (created.slug) cache?.set(`slug:${created.slug.toLowerCase()}`, created.id)
      return created.id
    }
  } catch (e) {
    const existedId = parseTermExistsResourceId(e)
    if (existedId != null) {
      cache?.set(nameKey, existedId)
      for (const slug of slugCandidates) cache?.set(`slug:${slug}`, existedId)
      return existedId
    }
    for (const slug of slugCandidates) {
      const bySlug = await findCategoryBySlug(site, slug)
      if (bySlug?.id) {
        cache?.set(nameKey, bySlug.id)
        cache?.set(`slug:${slug}`, bySlug.id)
        return bySlug.id
      }
    }
    const after = await wooFetch<WooProductCategoryTerm[]>(
      site,
      `/products/categories?search=${encodeURIComponent(trimmed)}&per_page=100`,
    )
    const again = after.find((c) => {
      const nameMatched = Boolean(c.name && c.name.toLowerCase() === trimmed.toLowerCase())
      const slugMatched = Boolean(c.slug && slugCandidates.has(c.slug.toLowerCase()))
      return nameMatched || slugMatched
    })
    if (again?.id) {
      cache?.set(nameKey, again.id)
      if (again.slug) cache?.set(`slug:${again.slug.toLowerCase()}`, again.id)
      return again.id
    }
    throw e
  }
  return null
}

/**
 * 将中台标签名称/slug 解析为 Woo 产品标签 term id。
 * 为了保证“覆盖同步”生效，商品写入 tags 时应使用 `{ id }`，而不是仅 `{ name }`。
 */
export async function resolveProductTagId(
  site: WooSite,
  nameOrSlug: string,
  cache?: Map<string, number>,
): Promise<number | null> {
  const trimmed = (nameOrSlug || '').trim()
  if (!trimmed) return null
  const nameKey = `name:${trimmed.toLowerCase()}`
  if (cache?.has(nameKey)) return cache.get(nameKey)!

  const isLikelySlugInput = /^[a-z0-9_-]+$/i.test(trimmed)
  const slugCandidates = new Set<string>()
  if (isLikelySlugInput) slugCandidates.add(trimmed.toLowerCase().replace(/_/g, '-'))
  const derivedSlug = normalizeCategorySlugCandidate(trimmed)
  if (derivedSlug) slugCandidates.add(derivedSlug)

  for (const slug of slugCandidates) {
    const slugKey = `slug:${slug}`
    if (cache?.has(slugKey)) return cache.get(slugKey)!
  }

  for (const slug of slugCandidates) {
    const bySlug = await findTagBySlug(site, slug)
    if (bySlug?.id) {
      cache?.set(nameKey, bySlug.id)
      cache?.set(`slug:${slug}`, bySlug.id)
      return bySlug.id
    }
  }

  const list = await wooFetch<WooProductTagTerm[]>(
    site,
    `/products/tags?search=${encodeURIComponent(trimmed)}&per_page=100`,
  )
  const exact = list.find((t) => {
    const nameMatched = Boolean(t.name && t.name.toLowerCase() === trimmed.toLowerCase())
    const slugMatched = Boolean(t.slug && slugCandidates.has(t.slug.toLowerCase()))
    return nameMatched || slugMatched
  })
  if (exact?.id) {
    cache?.set(nameKey, exact.id)
    if (exact.slug) cache?.set(`slug:${exact.slug.toLowerCase()}`, exact.id)
    return exact.id
  }

  try {
    const createPayload =
      isLikelySlugInput
        ? { name: trimmed, slug: Array.from(slugCandidates)[0] }
        : { name: trimmed }
    const created = await wooFetch<WooProductTagTerm>(site, '/products/tags', {
      method: 'POST',
      body: JSON.stringify(createPayload),
    })
    if (created?.id) {
      cache?.set(nameKey, created.id)
      if (created.slug) cache?.set(`slug:${created.slug.toLowerCase()}`, created.id)
      return created.id
    }
  } catch (e) {
    const existedId = parseTermExistsResourceId(e)
    if (existedId != null) {
      cache?.set(nameKey, existedId)
      for (const slug of slugCandidates) cache?.set(`slug:${slug}`, existedId)
      return existedId
    }
    for (const slug of slugCandidates) {
      const bySlug = await findTagBySlug(site, slug)
      if (bySlug?.id) {
        cache?.set(nameKey, bySlug.id)
        cache?.set(`slug:${slug}`, bySlug.id)
        return bySlug.id
      }
    }
    const after = await wooFetch<WooProductTagTerm[]>(
      site,
      `/products/tags?search=${encodeURIComponent(trimmed)}&per_page=100`,
    )
    const again = after.find((t) => {
      const nameMatched = Boolean(t.name && t.name.toLowerCase() === trimmed.toLowerCase())
      const slugMatched = Boolean(t.slug && slugCandidates.has(t.slug.toLowerCase()))
      return nameMatched || slugMatched
    })
    if (again?.id) {
      cache?.set(nameKey, again.id)
      if (again.slug) cache?.set(`slug:${again.slug.toLowerCase()}`, again.id)
      return again.id
    }
    throw e
  }

  return null
}

/** 分页拉取产品（query 不含前导 ?） */
async function fetchProductsPaged(site: WooSite, queryWithoutPage: string): Promise<WooProduct[]> {
  const all: WooProduct[] = []
  let page = 1
  while (true) {
    const endpoint = `/products?per_page=100&page=${page}&orderby=id&order=asc&${queryWithoutPage}`
    const batch = await wooFetch<WooProduct[]>(site, endpoint)
    all.push(...batch)
    if (batch.length < 100) break
    page++
  }
  return all
}

/**
 * 拉取所有产品（自动分页）。
 * - status=any + catalog_visibility=any：含 draft/private/pending 及目录隐藏等
 * - 另拉 status=trash：WC 的 any 通常不含回收站，下架进回收站的商品需单独请求
 */
export async function fetchAllProducts(site: WooSite): Promise<WooProduct[]> {
  const active = await fetchProductsPaged(site, 'status=any&catalog_visibility=any')
  let trashed: WooProduct[] = []
  try {
    trashed = await fetchProductsPaged(site, 'status=trash')
  } catch {
    // 部分 Key 权限或 WC 配置可能禁止列出 trash，不影响主列表导入
  }
  const byId = new Map<number, WooProduct>()
  for (const p of active) {
    if (p.id != null) byId.set(p.id, p)
  }
  for (const p of trashed) {
    if (p.id != null) byId.set(p.id, p)
  }
  return Array.from(byId.values())
}

/** 拉取订单（单页，兼容旧调用） */
export async function fetchOrders(site: WooSite, params: { after?: string; page?: number; per_page?: number } = {}): Promise<WooOrder[]> {
  const query = new URLSearchParams()
  if (params.after) query.set('after', params.after)
  query.set('page', String(params.page || 1))
  query.set('per_page', String(params.per_page || 50))
  query.set('orderby', 'date')
  query.set('order', 'desc')
  return wooFetch<WooOrder[]>(site, `/orders?${query.toString()}`)
}

/**
 * 按 `modified_after` 增量拉取多页（WooCommerce REST v3 需支持 modified_after，常见 WC 3.5+）。
 * @param modifiedAfter ISO8601，只拉取在 Woo 侧 **修改时间晚于** 此时间的订单（配合本地游标实现增量同步）
 */
export async function fetchOrdersModifiedSince(
  site: WooSite,
  modifiedAfter: string,
  options: { per_page?: number; maxPages?: number } = {},
): Promise<WooOrder[]> {
  const perPage = options.per_page ?? 50
  const maxPages = options.maxPages ?? 30
  const all: WooOrder[] = []
  for (let page = 1; page <= maxPages; page++) {
    const query = new URLSearchParams()
    query.set('modified_after', modifiedAfter)
    query.set('page', String(page))
    query.set('per_page', String(perPage))
    query.set('orderby', 'modified')
    query.set('order', 'asc')
    const batch = await wooFetch<WooOrder[]>(site, `/orders?${query.toString()}`)
    if (!batch || batch.length === 0) break
    all.push(...batch)
    if (batch.length < perPage) break
  }
  return all
}

/** 更新订单状态 */
export async function updateOrderStatus(site: WooSite, orderId: number, status: string): Promise<WooOrder> {
  return wooFetch<WooOrder>(site, `/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}
