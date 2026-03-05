export interface Category {
  id: number
  code: string
  name_en: string
  name_zh: string
  is_active: boolean
}

export interface OperationalTag {
  id: number
  name: string
  is_active: boolean
}

export interface Brand {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

export interface MasterSKU {
  id: number
  master_code: string
  legacy_code: string
  region: 'u' | 't' | 'a'
  primary_category: number | null
  primary_category_name: string
  primary_category_info?: Category
  category: string
  title_en: string
  title_ar: string
  title_th: string
  short_description: string
  description: string
  image_urls: string[]
  video_urls: Array<{ url: string; width: number; height: number }>
  regular_price: string | null
  selling_price: string
  best_cost_price: string | null
  audience_tags: string[]
  operational_tags?: number[]
  operational_tag_names?: string[]
  is_featured: boolean
  is_active: boolean
  review_status: 'draft' | 'pending_review' | 'publishable' | 'inactive_delisted'
  review_note: string
  emergency_override_at?: string | null
  emergency_override_reason?: string
  ai_assisted?: 'none' | 'ocr' | 'optimize' | 'both'
  availability: 'available' | 'low_stock' | 'unavailable'
  supplier_skus?: SupplierSKU[]
  created_at: string
  updated_at: string
}

export interface ProductStats {
  total: number
  active: number
  inactive: number
  uncategorized: number
  missing_title_ar: number
  missing_image: number
  missing_short_desc: number
}

export interface Supplier {
  id: number
  name: string
  code_prefix: string
  settlement_cycle: string
  is_active: boolean
  circuit_breaker: boolean
  priority: number
  created_at: string
}

export interface SupplierSKU {
  id: number
  supplier: number
  supplier_name: string
  master_sku: number
  supplier_code: string
  cost_price: string
  stock_status: 'in_stock' | 'out_of_stock'
  last_stock_check: string | null
}

export interface Distributor {
  id: number
  name: string
  type: 'self_operated' | 'distributor'
  user: number | null
  is_active: boolean
  created_at: string
  site_environment?: SiteEnvironment
}

export interface SiteEnvironment {
  id: number
  distributor: number
  domain_a: string
  domain_b: string
  pixel_id: string
  whatsapp_number: string
  payment_method: string
  cloaker_config: Record<string, unknown>
}

export interface DistributorSelection {
  id: number
  distributor: number
  master_sku: number
  sku_code?: string
  sku_title?: string
}

export interface SiteSelectionStatusItem {
  site_id: number
  site_url: string
  site_active: boolean
  selected: boolean
  mapping_exists: boolean
  sync_status: 'not_created' | 'pending' | 'syncing' | 'synced' | 'failed' | 'draft'
  last_synced_at: string | null
  sync_error: string
}

export interface DistributorSiteSelectionStatus {
  distributor_id: number
  distributor_name: string
  master_sku_id: number
  selected: boolean
  sites: SiteSelectionStatusItem[]
}

export interface Order {
  id: number
  order_number: string
  distributor: number
  distributor_name: string
  source: 'website' | 'whatsapp' | 'manual'
  customer_name: string
  customer_phone: string
  customer_address: string
  city: string
  total_amount: string
  routed_supplier: number | null
  supplier_name: string | null
  status: OrderStatus
  delivery_fee: string
  rejection_fee: string
  profit: string
  notes: string
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export type OrderStatus =
  | 'pending'
  | 'reviewed'
  | 'pushed'
  | 'shipped'
  | 'delivered'
  | 'rejected'
  | 'returned'

export interface OrderItem {
  id: number
  order: number
  master_sku: number
  sku_code: string
  sku_title: string
  quantity: number
  unit_price: string
  cost_price: string
  subtotal: string
}

export interface WPSite {
  id: number
  distributor: number
  distributor_name: string
  site_url: string
  consumer_key: string
  is_active: boolean
  last_sync: string | null
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface FinanceSummary {
  total_orders: number
  delivered_orders: number
  rejected_orders: number
  pending_orders: number
  total_revenue: number
  total_profit: number
  total_delivery_fees: number
  avg_order_value: number
}

export interface ReviewMetrics {
  approved_count: number
  first_pass_approved_count: number
  first_pass_rate: number
  rework_count: number
  emergency_override_count: number
  pending_review_count: number
}

export interface Phase1Metrics {
  review_ready_daily_count: number
  review_ready_window_count: number
  median_hours_to_review_ready: number
  review_processed_daily_count: number
  daily_trend: Array<{
    date: string
    review_ready_count: number
    review_processed_count: number
  }>
}

// S2-W3-3: 脏词字典类型
export interface BannedWord {
  id: number
  word: string
  category: 'profanity' | 'fraud' | 'contraband' | 'adult' | 'political' | 'other'
  is_active: boolean
  created_at: string
  updated_at: string
}
