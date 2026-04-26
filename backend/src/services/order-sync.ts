import { getDb, type DbWrapper } from '../db/index.js'
import {
  type WooOrder,
  extractCustomerWhatsappFromWooOrder,
  fetchOrders,
  fetchOrdersModifiedSince,
  WooSite,
} from './woo-client.js'
import { generateOrderNumber } from './order-number.js'

/**
 * 默认关闭：不启动定时拉单、/orders/pull 与 Woo 订单 webhook 不写入/更新。
 * 部署需从 Woo 拉单或收 webhook 时设置环境变量 `ORDER_INBOUND_FROM_WOO=1`。
 */
export const ORDER_INBOUND_FROM_WOO_ENABLED = process.env.ORDER_INBOUND_FROM_WOO === '1'

/** 小机/低单量：仅当 ORDER_INBOUND_FROM_WOO_ENABLED 时每 24h 全站增量拉取 */
const POLL_INTERVAL = 24 * 60 * 60 * 1000 // 24 小时
let timer: ReturnType<typeof setInterval> | null = null

/** settings.value 中 JSON：各站点「上次已处理」的最大 modified 时间（ISO） */
const CURSOR_SETTINGS_KEY = 'order_sync_modified_cursors'

/** 首同步：按 modified 回溯窗口（与 Woo 增量参数一致） */
const FIRST_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000

function now() { return new Date().toISOString() }

function readCursors(db: DbWrapper): Record<string, string> {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [CURSOR_SETTINGS_KEY]) as { value?: string } | undefined
  if (!row?.value) return {}
  try {
    return JSON.parse(row.value) as Record<string, string>
  } catch {
    return {}
  }
}

function writeCursors(db: DbWrapper, cursors: Record<string, string>) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [CURSOR_SETTINGS_KEY, JSON.stringify(cursors)])
}

export type OrderPullSiteResult = {
  site_id: string
  site_name: string
  /** 本趟新插入本地库的订单数 */
  pulled: number
  /** 本趟在本地更新的已有订单数（Woo 有变更） */
  updated: number
  error?: string
}

type PullCount = { pulled: number; updated: number }

async function pullOrdersFromSite(site: any): Promise<PullCount> {
  const db = getDb()
  const cursors: Record<string, string> = { ...readCursors(db) }
  const prev = cursors[site.id]
  const defaultLookback = new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS).toISOString()
  const modifiedAfter = prev ?? defaultLookback

  const wooSite: WooSite = {
    url: site.url,
    consumer_key: site.consumer_key,
    consumer_secret: site.consumer_secret,
  }

  let orders: WooOrder[] = []
  try {
    orders = await fetchOrdersModifiedSince(wooSite, modifiedAfter, { per_page: 50, maxPages: 30 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[order-sync] 增量拉单失败，回退单页(50)最近订单: ${site.name} — ${msg}`)
    orders = await fetchOrders(wooSite, { per_page: 50, page: 1 })
  }

  let pulled = 0
  let updated = 0

  // 用 BEGIN/COMMIT 包裹写入，不依赖 db/index 的 withTransaction，避免旧部署缺导出导致 tsc 失败
  db.exec('BEGIN')
  try {
    for (const order of orders) {
      const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ')
      const whatsapp = extractCustomerWhatsappFromWooOrder(order)
      const customerCity = order.billing?.city || order.shipping?.city || ''
      const customerAddress = [
        order.shipping?.address_1 || order.billing?.address_1,
        (order.shipping as any)?.address_2 || (order.billing as any)?.address_2,
      ].filter(Boolean).join(', ')

      try {
        const existing = db.get(
          'SELECT id FROM orders WHERE site_id = ? AND woo_order_id = ?',
          [site.id, order.id]
        )

        if (existing) {
          db.run(
            `UPDATE orders SET status = ?, customer_name = ?, customer_email = ?, customer_phone = ?, customer_whatsapp = ?,
             total = ?, line_items = ?, customer_city = ?, customer_address = ?, date_modified = ?, pulled_at = ?
             WHERE site_id = ? AND woo_order_id = ?`,
            [
              order.status, customerName, order.billing?.email || '', order.billing?.phone || '', whatsapp,
              order.total, JSON.stringify(order.line_items || []),
              customerCity, customerAddress, order.date_modified, now(),
              site.id, order.id,
            ]
          )
          updated++
        } else {
          let orderNumber = order.number
          if (site.distributor_id) {
            try { orderNumber = generateOrderNumber(site.distributor_id) } catch { /* use woo number */ }
          }
          db.run(
            `INSERT INTO orders (
              site_id, woo_order_id, order_number, status,
              customer_name, customer_email, customer_phone, customer_whatsapp,
              customer_city, customer_address,
              payment_method, total, currency, line_items, shipping_address, billing_address,
              date_created, date_modified, pulled_at,
              distributor_id, source, created_by_role, order_status, delivery_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              site.id, order.id, orderNumber, order.status,
              customerName, order.billing?.email || '', order.billing?.phone || '', whatsapp,
              customerCity, customerAddress,
              order.payment_method_title || '', order.total, order.currency,
              JSON.stringify(order.line_items || []),
              JSON.stringify(order.shipping || {}),
              JSON.stringify(order.billing || {}),
              order.date_created, order.date_modified, now(),
              site.distributor_id || null, 'woo_api', 'system',
              'unconfirmed', 'not_submitted'
            ]
          )
          pulled++
        }
      } catch { /* skip individual order errors */ }
    }
    db.exec('COMMIT')
  } catch (e) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw e
  }

  if (orders.length > 0) {
    const maxT = Math.max(...orders.map(o => new Date(o.date_modified).getTime()))
    cursors[site.id] = new Date(maxT).toISOString()
  } else if (!prev) {
    cursors[site.id] = new Date().toISOString()
  }
  writeCursors(db, cursors)

  return { pulled, updated }
}

async function runPullForSites(sites: any[]): Promise<OrderPullSiteResult[]> {
  if (sites.length === 0) return []

  const ts = new Date().toLocaleTimeString()
  console.log(`[${ts}] 订单拉取(增量): ${sites.length} 个站点...`)

  const out: OrderPullSiteResult[] = []

  for (const site of sites) {
    try {
      const { pulled, updated } = await pullOrdersFromSite(site)
      if (pulled > 0) console.log(`[${ts}]   ${site.name}: 新增 ${pulled} 条`)
      if (updated > 0) console.log(`[${ts}]   ${site.name}: 更新 ${updated} 条`)
      out.push({ site_id: site.id, site_name: site.name, pulled, updated })
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.log(`[${ts}]   ${site.name}: 拉取失败 - ${msg}`)
      out.push({ site_id: site.id, site_name: site.name, pulled: 0, updated: 0, error: msg })
    }
  }

  return out
}

/**
 * 全部活跃站点（操作员/定时任务）
 */
export async function pollAllSites(): Promise<OrderPullSiteResult[]> {
  const db = getDb()
  const sites = db.all("SELECT * FROM sites WHERE status = 'active'") as any[]
  return runPullForSites(sites)
}

/**
 * 仅该分销商在 sites 上绑定的活跃站点
 */
export async function pollSitesForDistributor(distributorId: number): Promise<OrderPullSiteResult[]> {
  const db = getDb()
  const sites = db.all(
    "SELECT * FROM sites WHERE status = 'active' AND distributor_id = ?",
    [String(distributorId)]
  ) as any[]
  return runPullForSites(sites)
}

export function startOrderSync() {
  if (!ORDER_INBOUND_FROM_WOO_ENABLED) {
    console.log('订单从 Woo 入站已关闭（未设置 ORDER_INBOUND_FROM_WOO=1），不启动定时拉单')
    return
  }
  const hours = POLL_INTERVAL / 1000 / 60 / 60
  console.log(`订单自动同步: 每 ${hours}h 全站增量拉取（modified_after 游标）`)
  pollAllSites().catch(() => {})
  timer = setInterval(() => { pollAllSites().catch(() => {}) }, POLL_INTERVAL)
}

export function stopOrderSync() {
  if (timer) {
    clearInterval(timer)
    timer = null
    console.log('订单自动同步已停止')
  }
}
