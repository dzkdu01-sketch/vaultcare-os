import { Router, Request, Response } from 'express'
import { getDb } from '../db/index.js'
import { fetchOrders, updateOrderStatus as wooUpdateStatus, WooSite } from '../services/woo-client.js'

export const orderRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

// GET /orders
orderRouter.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, status, keyword, page = '1', page_size = '20' } = req.query as Record<string, string>

  const conditions: string[] = []
  const params: unknown[] = []

  if (site_id) { conditions.push('o.site_id = ?'); params.push(site_id) }
  if (status) { conditions.push('o.status = ?'); params.push(status) }
  if (keyword) {
    conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)')
    const kw = `%${keyword}%`
    params.push(kw, kw, kw)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(page_size) || 20))
  const offset = (pageNum - 1) * pageSize

  const totalRow = db.get(`SELECT COUNT(*) as count FROM orders o ${where}`, params)
  const total = (totalRow as any)?.count ?? 0

  const items = db.all(
    `SELECT o.*, s.name as site_name FROM orders o
     LEFT JOIN sites s ON o.site_id = s.id
     ${where} ORDER BY o.date_created DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  // 状态统计
  const counts = db.all('SELECT status, COUNT(*) as count FROM orders GROUP BY status')
  const statusCounts: Record<string, number> = {}
  let totalCount = 0
  for (const row of counts) {
    statusCounts[row.status as string] = row.count as number
    totalCount += row.count as number
  }

  respond(res, {
    items,
    pagination: { page: pageNum, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    status_counts: { all: totalCount, ...statusCounts },
  })
})

// GET /orders/:id
orderRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const order = db.get(
    `SELECT o.*, s.name as site_name, s.url as site_url FROM orders o
     LEFT JOIN sites s ON o.site_id = s.id WHERE o.id = ?`,
    [req.params.id]
  )
  if (!order) return respondError(res, '订单不存在', 404)
  respond(res, order)
})

// POST /orders/pull - 从所有站点拉取订单
orderRouter.post('/pull', async (_req: Request, res: Response) => {
  const db = getDb()
  const sites = db.all("SELECT * FROM sites WHERE status = 'active'") as any[]
  if (sites.length === 0) return respondError(res, '没有已配置的活跃站点')

  const results: Array<{ site_id: string; site_name: string; pulled: number; error?: string }> = []

  for (const site of sites) {
    const wooSite: WooSite = { url: site.url, consumer_key: site.consumer_key, consumer_secret: site.consumer_secret }
    try {
      const orders = await fetchOrders(wooSite, { per_page: 50 })
      let pulled = 0

      for (const order of orders) {
        const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ')
        // Extract WhatsApp from meta_data (common plugin keys)
        const whatsapp = (order.meta_data || []).find((m: any) =>
          ['_billing_whatsapp', 'billing_whatsapp', 'whatsapp', '_whatsapp'].includes(m.key)
        )?.value || ''
        try {
          db.run(
            `INSERT INTO orders (site_id, woo_order_id, order_number, status, customer_name, customer_email, customer_phone, customer_whatsapp, payment_method, total, currency, line_items, shipping_address, billing_address, date_created, date_modified, pulled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(site_id, woo_order_id) DO UPDATE SET
               status = ?, customer_name = ?, total = ?, line_items = ?, date_modified = ?, pulled_at = ?`,
            [
              site.id, order.id, order.number, order.status,
              customerName, order.billing?.email || '', order.billing?.phone || '',
              whatsapp, order.payment_method_title || '',
              order.total, order.currency,
              JSON.stringify(order.line_items || []),
              JSON.stringify(order.shipping || {}),
              JSON.stringify(order.billing || {}),
              order.date_created, order.date_modified, now(),
              // ON CONFLICT UPDATE values
              order.status, customerName, order.total,
              JSON.stringify(order.line_items || []),
              order.date_modified, now(),
            ]
          )
          pulled++
        } catch { /* skip individual order errors */ }
      }

      results.push({ site_id: site.id, site_name: site.name, pulled })
    } catch (err: any) {
      results.push({ site_id: site.id, site_name: site.name, pulled: 0, error: err.message })
    }
  }

  respond(res, { results })
})

// PUT /orders/:id/status - 更新订单状态（同步到 WooCommerce）
orderRouter.put('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body
  if (!status) return respondError(res, '缺少 status 字段')

  const db = getDb()
  const order = db.get('SELECT o.*, s.url, s.consumer_key, s.consumer_secret FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = ?', [req.params.id]) as any
  if (!order) return respondError(res, '订单不存在', 404)

  try {
    const wooSite: WooSite = { url: order.url, consumer_key: order.consumer_key, consumer_secret: order.consumer_secret }
    await wooUpdateStatus(wooSite, order.woo_order_id, status)
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, order.id])
    respond(res, { updated: true })
  } catch (err: any) {
    respondError(res, `同步失败: ${err.message}`, 500)
  }
})
