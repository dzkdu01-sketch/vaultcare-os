import api from './client'

// Auth
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/token/', { username, password }),
  refresh: (refresh: string) =>
    api.post('/token/refresh/', { refresh }),
}

// PIM
export const productsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/products/', { params }),
  get: (id: number) => api.get(`/products/${id}/`),
  create: (data: unknown) => api.post('/products/', data),
  createAIDraft: (data: unknown) => api.post('/products/create-ai-draft/', data),
  createManualDraft: (data: unknown) => api.post('/products/create-manual-draft/', data),
  update: (id: number, data: unknown) => api.patch(`/products/${id}/`, data),
  delete: (id: number) => api.delete(`/products/${id}/`),
  stats: () => api.get('/products/stats/'),
  bulkAction: (data: {
    ids?: number[]
    filter?: Record<string, unknown>
    action:
      | 'activate'
      | 'deactivate'
      | 'delete'
      | 'set_category'
      | 'set_region'
      | 'submit_review'
      | 'add_audience_tags'
      | 'remove_audience_tags'
      | 'add_operational_tags'
      | 'remove_operational_tags'
      // S2-W3-7 批量管理升级新增
      | 'set_supplier'
      | 'set_price'
      | 'set_sales_region'
    params?: Record<string, unknown>
  }) => api.post('/products/bulk-action/', data),
  upgradCode: (id: number) => api.post(`/products/${id}/upgrade_code/`),
  priceLogs: (id: number) => api.get(`/products/${id}/price_logs/`),
  wpMappings: (id: number) => api.get(`/products/${id}/wp_mappings/`),
  submitReview: (id: number) => api.post(`/products/${id}/submit_review/`),
  approveReview: (id: number) => api.post(`/products/${id}/approve_review/`),
  rejectReview: (id: number, review_note: string) =>
    api.post(`/products/${id}/reject_review/`, { review_note }),
  emergencyPublish: (id: number, reason: string) =>
    api.post(`/products/${id}/emergency_publish/`, { reason }),
  delist: (id: number) => api.post(`/products/${id}/delist/`),
  reviewMetrics: () => api.get('/products/review_metrics/'),
  phase1Metrics: () => api.get('/products/phase1_metrics/'),
  exportCsv: (params?: Record<string, unknown>) =>
    api.get('/products/export/', { params, responseType: 'blob' }),
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/products/upload-image/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/products/import-csv/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getImportBatches: () => api.get('/products/import-batches/'),
  retryFailedRows: (batchId: number) =>
    api.post(`/products/import-batches/${batchId}/retry-failed/`, {}),
  createWorkorder: (batchId: number) =>
    api.post(`/products/import-batches/${batchId}/create-workorder/`, {}),
  sendAlert: (batchId: number, channels: string[], emailRecipients?: string[]) =>
    api.post(`/products/import-batches/${batchId}/send-alert/`, {
      channels,
      email_recipients: emailRecipients || [],
    }),
}

export const categoriesAPI = {
  list: (params?: Record<string, unknown>) => api.get('/categories/', { params }),
  create: (data: unknown) => api.post('/categories/', data),
  update: (id: number, data: unknown) => api.patch(`/categories/${id}/`, data),
  deactivateWithReplacement: (id: number, replacementId: number) =>
    api.post(`/categories/${id}/deactivate-with-replacement/`, { replacement_id: replacementId }),
}

export const operationalTagsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/operational-tags/', { params }),
  create: (data: unknown) => api.post('/operational-tags/', data),
  update: (id: number, data: unknown) => api.patch(`/operational-tags/${id}/`, data),
  deactivateWithReplacement: (id: number, replacementId: number) =>
    api.post(`/operational-tags/${id}/deactivate-with-replacement/`, { replacement_id: replacementId }),
}

export const brandsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/brands/', { params }),
  create: (data: unknown) => api.post('/brands/', data),
  update: (id: number, data: unknown) => api.patch(`/brands/${id}/`, data),
  deactivateWithReplacement: (id: number, replacementId: number) =>
    api.post(`/brands/${id}/deactivate-with-replacement/`, { replacement_id: replacementId }),
}

export const suppliersAPI = {
  list: () => api.get('/suppliers/'),
  get: (id: number) => api.get(`/suppliers/${id}/`),
  create: (data: unknown) => api.post('/suppliers/', data),
  update: (id: number, data: unknown) => api.patch(`/suppliers/${id}/`, data),
  deactivateWithReplacement: (id: number, replacementId: number) =>
    api.post(`/suppliers/${id}/deactivate-with-replacement/`, { replacement_id: replacementId }),
  toggleCircuitBreaker: (id: number, value: boolean) =>
    api.patch(`/suppliers/${id}/`, { circuit_breaker: value }),
}

// S2-W3-3: 脏词字典管理
export const bannedWordsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/banned-words/', { params }),
  create: (data: unknown) => api.post('/banned-words/', data),
  update: (id: number, data: unknown) => api.patch(`/banned-words/${id}/`, data),
  delete: (id: number) => api.delete(`/banned-words/${id}/`),
}

export const supplierSKUsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/supplier-skus/', { params }),
  create: (data: unknown) => api.post('/supplier-skus/', data),
  update: (id: number, data: unknown) => api.patch(`/supplier-skus/${id}/`, data),
  delete: (id: number) => api.delete(`/supplier-skus/${id}/`),
}

// OMS
export const ordersAPI = {
  list: (params?: Record<string, unknown>) => api.get('/orders/', { params }),
  get: (id: number) => api.get(`/orders/${id}/`),
  update: (id: number, data: unknown) => api.patch(`/orders/${id}/`, data),
  route: (id: number) => api.post(`/orders/${id}/route/`),
  quickEntry: (data: unknown) => api.post('/orders/quick-entry/', data),
}

// Sites
export const distributorsAPI = {
  list: () => api.get('/distributors/'),
  get: (id: number) => api.get(`/distributors/${id}/`),
  create: (data: unknown) => api.post('/distributors/', data),
  update: (id: number, data: unknown) => api.patch(`/distributors/${id}/`, data),
  getSelections: (id: number) => api.get(`/distributors/${id}/selections/`),
  getSiteSelectionStatus: (id: number, masterSkuId: number) =>
    api.get(`/distributors/${id}/site_selection_status/`, { params: { master_sku_id: masterSkuId } }),
  siteOperation: (
    id: number,
    data: {
      master_sku_id: number
      site_id: number
      action: 'publish' | 'revoke' | 'retry_sync'
      simulate_success?: boolean
    }
  ) => api.post(`/distributors/${id}/site_operation/`, data),
}

export const siteEnvsAPI = {
  list: () => api.get('/site-environments/'),
  update: (id: number, data: unknown) => api.patch(`/site-environments/${id}/`, data),
}

export const selectionsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/distributor-selections/', { params }),
  create: (data: unknown) => api.post('/distributor-selections/', data),
  bulkCreate: (data: { distributor_ids: number[]; master_sku_id: number }) =>
    api.post('/distributor-selections/bulk_create/', data),
  delete: (id: number) => api.delete(`/distributor-selections/${id}/`),
}

// WP Sync
export const wpSitesAPI = {
  list: () => api.get('/wp-sites/'),
  create: (data: unknown) => api.post('/wp-sites/', data),
  update: (id: number, data: unknown) => api.patch(`/wp-sites/${id}/`, data),
  delete: (id: number) => api.delete(`/wp-sites/${id}/`),
  pushSku: (skuId: number) => api.post(`/wp-sync/push/${skuId}/`),
}

// AI 辅助上线
export const aiAPI = {
  analyzeImages: (formData: FormData) =>
    api.post('/ai/analyze-images/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  generateArabic: (data: { title_en: string; description?: string }) =>
    api.post('/ai/generate-arabic/', data),
  // Task 3: OCR 识别和文案优化
  ocrAnalyze: (formData: FormData) =>
    api.post('/ai/ocr-analyze/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  optimizeText: (data: { title_en: string; description?: string }) =>
    api.post('/ai/optimize-text/', data),
}

// AI 配置
export const aiConfigAPI = {
  list: () => api.get('/ai-config/'),
  get: (id: number) => api.get(`/ai-config/${id}/`),
  create: (data: unknown) => api.post('/ai-config/', data),
  update: (id: number, data: unknown) => api.patch(`/ai-config/${id}/`, data),
  current: () => api.get('/ai-config/current/'),
}

// Finance
export const financeAPI = {
  summary: (period?: string) => api.get('/finance/summary/', { params: { period } }),
  byDistributor: () => api.get('/finance/by-distributor/'),
  bySupplier: () => api.get('/finance/by-supplier/'),
  daily: () => api.get('/finance/daily/'),
}
