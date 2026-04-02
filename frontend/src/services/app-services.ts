import { apiClient } from './api-client'
import type {
  Site, SiteInput,
  Product, ProductInput, ProductDetail,
  Order, PaginatedList, SyncResult, PullResult,
  Supplier, SupplierInput, ProductSupplierMapping, ProductSupplierInput,
  ImportedSupplierProduct, SupplierProductImportResult,
} from './types'

export const siteApi = {
  list: () => apiClient.get<Site[]>('/sites'),
  getById: (id: string) => apiClient.get<Site>(`/sites/${id}`),
  create: (input: SiteInput) => apiClient.post<Site>('/sites', input),
  update: (id: string, input: Partial<SiteInput & { status: string }>) => apiClient.put<Site>(`/sites/${id}`, input),
  remove: (id: string) => apiClient.del(`/sites/${id}`),
  test: (id: string) => apiClient.post<{ connected: boolean; error?: string }>(`/sites/${id}/test`),
}

export const productApi = {
  list: (params?: { keyword?: string; page?: number; page_size?: number; category?: string; status?: string; has_supplier?: string; tag?: string; catalog_in?: string }) => {
    const query = new URLSearchParams()
    if (params?.keyword) query.set('keyword', params.keyword)
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.category) query.set('category', params.category)
    if (params?.status !== undefined && params.status !== '') query.set('status', params.status)
    if (params?.has_supplier) query.set('has_supplier', params.has_supplier)
    if (params?.tag) query.set('tag', params.tag)
    if (params?.catalog_in !== undefined && params.catalog_in !== '') query.set('catalog_in', params.catalog_in)
    const qs = query.toString()
    return apiClient.get<
      PaginatedList<Product> & { total_sites: number; db_product_count?: number }
    >(`/product/items${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) => apiClient.get<ProductDetail>(`/product/items/${id}`),
  create: (input: ProductInput) => apiClient.post<Product>('/product/items', input),
  update: (id: string, input: Partial<ProductInput>) => apiClient.put<Product>(`/product/items/${id}`, input),
  remove: (id: string) => apiClient.del(`/product/items/${id}`),
  sync: (id: string, siteIds?: string[]) =>
    apiClient.post<SyncResult>(
      `/product/items/${id}/sync`,
      siteIds && siteIds.length > 0 ? { site_ids: siteIds } : {},
    ),
  /** 全部商品 id（sku 排序），用于分批全量同步 */
  listIds: () => apiClient.get<{ ids: string[] }>('/product/items/id-list'),
  /** 仅同步指定 id，与 sync-all 响应结构相同 */
  syncBatch: (product_ids: string[], site_ids?: string[]) =>
    apiClient.post<{
      products: number
      synced: number
      failed: number
      details?: Array<{
        product_id: string
        sku: string
        results: SyncResult['results']
        skipped_images?: string[]
      }>
    }>('/product/items/sync-batch', { product_ids, ...(site_ids && site_ids.length > 0 ? { site_ids } : {}) }),
  syncAll: (site_ids?: string[]) =>
    apiClient.post<{
      products: number
      synced: number
      failed: number
      details?: Array<{
        product_id: string
        sku: string
        results: SyncResult['results']
        skipped_images?: string[]
      }>
    }>('/product/items/sync-all', site_ids ? { site_ids } : {}),
  pullFromSite: (site_id: string) => apiClient.post<{ total: number; created: number; updated: number; skipped: number }>('/product/items/pull-from-site', { site_id }),
  /** 客户图册长图（PNG 无损），宽 1500px；仅上架 + 进图册 + 对应性别标签 */
  downloadCatalogPng: (audience: 'him' | 'her') => {
    const qs = new URLSearchParams({ audience })
    return apiClient.getBlob(`/product/catalog?${qs.toString()}`)
  },
  patchCatalogBatch: (ids: string[], catalog_in: 0 | 1) =>
    apiClient.patch<{ updated: string[]; failed: Array<{ id: string; reason: string }>; count: number }>(
      '/product/items/catalog-batch',
      { ids, catalog_in },
    ),
}

export const orderApi = {
  list: (params?: { site_id?: string; status?: string; keyword?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams()
    if (params?.site_id) query.set('site_id', params.site_id)
    if (params?.status) query.set('status', params.status)
    if (params?.keyword) query.set('keyword', params.keyword)
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    const qs = query.toString()
    return apiClient.get<PaginatedList<Order> & { status_counts: Record<string, number> }>(`/orders${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  pull: () => apiClient.post<PullResult>('/orders/pull'),
  updateStatus: (id: string, status: string) => apiClient.put(`/orders/${id}/status`, { status }),
}

export const supplierApi = {
  list: () => apiClient.get<Supplier[]>('/suppliers'),
  getById: (id: string) => apiClient.get<Supplier>(`/suppliers/${id}`),
  create: (input: SupplierInput) => apiClient.post<Supplier>('/suppliers', input),
  update: (id: string, input: Partial<SupplierInput>) => apiClient.put<Supplier>(`/suppliers/${id}`, input),
  remove: (id: string) => apiClient.del(`/suppliers/${id}`),
  getMappings: (productId: string) => apiClient.get<ProductSupplierMapping[]>(`/suppliers/mapping/by-product/${productId}`),
  getAllMappings: (supplierId?: string) => {
    const qs = supplierId ? `?supplier_id=${supplierId}` : ''
    return apiClient.get<(ProductSupplierMapping & { product_name: string; product_sku: string; sale_price: number })[]>(`/suppliers/mapping/all${qs}`)
  },
  addMapping: (input: ProductSupplierInput) => apiClient.post('/suppliers/mapping', input),
  updateMapping: (id: number, input: { supplier_code?: string; cost_price?: number; note?: string }) => apiClient.put(`/suppliers/mapping/${id}`, input),
  removeMapping: (id: number) => apiClient.del(`/suppliers/mapping/${id}`),
  importProducts: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<SupplierProductImportResult>('/suppliers/import-products', formData)
  },
  getImportedProducts: (params?: { supplier_id?: string; mapped?: 'yes' | 'no' | 'all'; keyword?: string }) => {
    const query = new URLSearchParams()
    if (params?.supplier_id) query.set('supplier_id', params.supplier_id)
    if (params?.mapped) query.set('mapped', params.mapped)
    if (params?.keyword) query.set('keyword', params.keyword)
    const qs = query.toString()
    return apiClient.get<ImportedSupplierProduct[]>(`/suppliers/imported-products${qs ? `?${qs}` : ''}`)
  },
  batchBindImportedProducts: (input: { supplier_product_ids: number[]; product_id: string }) => apiClient.post<{ updated: number }>('/suppliers/imported-products/bind', input),
  batchUnbindImportedProducts: (supplier_product_ids: number[]) => apiClient.post<{ updated: number }>('/suppliers/imported-products/unbind', { supplier_product_ids }),
}

export const settingsApi = {
  get: () => apiClient.get<Record<string, string>>('/settings'),
  update: (key: string, value: string) => apiClient.put<{ key: string; value: string }>(`/settings/${key}`, { value }),
}
