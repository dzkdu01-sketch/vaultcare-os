import { getDb } from '../db/index.js'
import { extractCustomerWhatsappFromWooOrder, fetchOrders, WooSite } from './woo-client.js'
import { generateOrderNumber } from './order-number.js'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
let timer: ReturnType<typeof setInterval> | null = null

function now() { return new Date().toISOString() }

async function pullOrdersFromSite(site: any): Promise<number> {
  const db = getDb()
  const wooSite: WooSite = {
    url: site.url,
    consumer_key: site.consumer_key,
    consumer_secret: site.consumer_secret,
  }

  const orders = await fetchOrders(wooSite, { per_page: 50 })
  let pulled = 0

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

  return pulled
}

async function pollAllSites() {
  const db = getDb()
  const sites = db.all("SELECT * FROM sites WHERE status = 'active'") as any[]
  if (sites.length === 0) return

  const ts = new Date().toLocaleTimeString()
  console.log(`[${ts}] 自动同步: 开始拉取 ${sites.length} 个活跃站点...`)

  for (const site of sites) {
    try {
      const pulled = await pullOrdersFromSite(site)
      if (pulled > 0) {
        console.log(`[${ts}]   ${site.name}: 新增 ${pulled} 个订单`)
      }
    } catch (err: any) {
      console.log(`[${ts}]   ${site.name}: 拉取失败 - ${err.message}`)
    }
  }
}

export function startOrderSync() {
  console.log(`订单自动同步已启动 (每 ${POLL_INTERVAL / 1000 / 60} 分钟)`)
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
