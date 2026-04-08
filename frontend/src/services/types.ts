// === 站点 ===
export type Site = {
  id: string
  name: string
  url: string
  consumer_key: string
  consumer_secret: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type SiteInput = {
  name: string
  url: string
  consumer_key: string
  consumer_secret: string
}

// === 产品 ===
export type Product = {
  id: string
  sku: string
  name: string
  short_description?: string
  description?: string
  sale_price: number
  regular_price: number
  category?: string
  tags?: string[]
  images: string[]
  status: number
  /** 0/1 是否进客户图册（须已有 for him 或 for her） */
  catalog_in?: number
  supplier_codes?: string
  synced_count?: number
  failed_count?: number
  synced_site_names?: string
  created_at: string
  updated_at: string
}

export type ProductInput = {
  name: string
  /** 仅更新时传入；新建由后端自动生成 */
  sku?: string
  short_description?: string
  description?: string
  sale_price?: number
  regular_price?: number
  category?: string
  tags?: string[]
  images?: string[]
  status?: number
  catalog_in?: number
}

export type ProductSync = {
  product_id: string
  site_id: string
  site_name: string
  site_url: string
  woo_product_id?: number
  sync_status: 'pending' | 'synced' | 'failed'
  last_synced_at?: string
  error?: string
}

export type ProductDetail = Product & {
  sync: ProductSync[]
}

// === 订单 ===
export type WooOrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'trash'

export type Order = {
  id: number
  site_id: string
  site_name: string
  woo_order_id: number
  order_number: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_whatsapp: string
  payment_method: string
  total: string
  currency: string
  line_items: string
  shipping_address: string
  billing_address: string
  date_created: string
  date_modified: string
  pulled_at: string
}

// === 供应商 ===
export type Supplier = {
  id: string
  name: string
  code_prefix: string
  contact: string
  note: string
  created_at: string
  updated_at: string
}

export type SupplierInput = {
  name: string
  code_prefix?: string
  contact?: string
  note?: string
}

export type ProductSupplierMapping = {
  id: number
  product_id: string
  supplier_id: string
  supplier_name: string
  code_prefix: string
  supplier_code: string
  cost_price?: number
  note?: string
}

export type ProductSupplierInput = {
  product_id: string
  supplier_id: string
  supplier_code: string
  cost_price?: number
  note?: string
}

export type ImportedSupplierProduct = {
  id: number
  supplier_id: string
  supplier_name: string
  supplier_code: string
  product_name: string
  cost_price_aed?: number | null
  mapped_product_id?: string | null
  mapped_product_sku?: string | null
  mapped_product_name?: string | null
  created_at: string
  updated_at: string
}

export type SupplierProductImportResult = {
  total: number
  created: number
  updated: number
  failed: number
  import_batch_id: string
  rowErrors: Array<{ row: number; message: string }>
}

// === 通用 ===
export type Pagination = {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export type PaginatedList<T> = {
  items: T[]
  pagination: Pagination
}

export type SyncResult = {
  product_id: string
  results: Array<{
    site_id: string
    site_name: string
    success: boolean
    error?: string
  }>
  /** 编辑页填写但远程不可访问、已跳过未推送到 Woo 的图片 URL */
  skipped_images?: string[]
}

export type PullResult = {
  results: Array<{
    site_id: string
    site_name: string
    pulled: number
    error?: string
  }>
}
