import { Router, Request, Response } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js'
import { generateOrderNumber } from '../services/order-number.js'
import {
  extractCustomerWhatsappFromWooOrder,
  fetchOrders,
  updateOrderStatus as wooUpdateStatus,
  WooSite,
} from '../services/woo-client.js'

export const orderRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

function logStatusChange(orderId: number, field: string, fromValue: string | null, toValue: string, changedBy: string, note?: string) {
  const db = getDb()
  db.run(
    'INSERT INTO order_status_log (order_id, field, from_value, to_value, changed_by, note, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [orderId, field, fromValue, toValue, changedBy, note || null, now()]
  )
}

function userTag(req: Request): string {
  if (!req.user) return 'system'
  return `${req.user.role}:${req.user.userId}`
}

// GET /orders - list with role-based filtering
orderRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, status, order_status, delivery_status, keyword, page = '1', page_size = '20', distributor_id } = req.query as Record<string, string>

  const conditions: string[] = []
  const params: unknown[] = []

  // Role-based filtering: distributors only see their own
  if (req.user!.role === 'distributor') {
    conditions.push('o.distributor_id = ?')
    params.push(req.user!.distributorId)
  } else if (distributor_id) {
    conditions.push('o.distributor_id = ?')
    params.push(distributor_id)
  }

  if (site_id) { conditions.push('o.site_id = ?'); params.push(site_id) }
  if (status) { conditions.push('o.status = ?'); params.push(status) }
  if (order_status) { conditions.push('o.order_status = ?'); params.push(order_status) }
  if (delivery_status) { conditions.push('o.delivery_status = ?'); params.push(delivery_status) }
  if (keyword) {
    const kw = `%${keyword}%`
    conditions.push(
      `(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.customer_whatsapp LIKE ?
 OR o.line_items LIKE ? OR IFNULL(o.item_summary, '') LIKE ?)`
    )
    params.push(kw, kw, kw, kw, kw, kw)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(page_size) || 20))
  const offset = (pageNum - 1) * pageSize

  const totalRow = db.get(`SELECT COUNT(*) as count FROM orders o ${where}`, params)
  const total = (totalRow as any)?.count ?? 0

  const items = db.all(
    `SELECT o.*, s.name as site_name,
            COALESCE(NULLIF(TRIM(d.name), ''), d.code) as distributor_name,
            d.code as distributor_code
     FROM orders o
     LEFT JOIN sites s ON o.site_id = s.id
     LEFT JOIN distributors d ON o.distributor_id = d.id
     ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  // Status counts with same role filter
  const baseConditions: string[] = []
  const baseParams: unknown[] = []
  if (req.user!.role === 'distributor') {
    baseConditions.push('distributor_id = ?')
    baseParams.push(req.user!.distributorId)
  }
  const baseWhere = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : ''

  const orderStatusCounts = db.all(`SELECT order_status, COUNT(*) as count FROM orders ${baseWhere} GROUP BY order_status`, baseParams)
  const deliveryStatusCounts = db.all(`SELECT delivery_status, COUNT(*) as count FROM orders ${baseWhere} GROUP BY delivery_status`, baseParams)

  const osCounts: Record<string, number> = {}
  let totalCount = 0
  for (const r of orderStatusCounts) { osCounts[r.order_status as string] = r.count as number; totalCount += r.count as number }
  const dsCounts: Record<string, number> = {}
  for (const r of deliveryStatusCounts) { dsCounts[r.delivery_status as string] = r.count as number }

  respond(res, {
    items,
    pagination: { page: pageNum, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    order_status_counts: { all: totalCount, ...osCounts },
    delivery_status_counts: dsCounts,
  })
})

// POST /orders/batch-delete — 须放在 /:id 之前，避免被当成订单 id
orderRouter.post('/batch-delete', requireAuth, requireRole('operator'), (req: Request, res: Response) => {
  const db = getDb()
  const raw = req.body?.ids
  if (!Array.isArray(raw) || raw.length === 0) {
    return respondError(res, 'ids 必须为非空数组')
  }
  let deleted = 0
  for (const v of raw) {
    const id = parseInt(String(v), 10)
    if (!Number.isFinite(id)) continue
    const row = db.get('SELECT id FROM orders WHERE id = ?', [id])
    if (!row) continue
    db.run('DELETE FROM orders WHERE id = ?', [id])
    deleted++
  }
  respond(res, { deleted })
})

// GET /orders/:id
orderRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const order = db.get(
    `SELECT o.*, s.name as site_name, s.url as site_url,
            COALESCE(NULLIF(TRIM(d.name), ''), d.code) as distributor_name,
            d.code as distributor_code
     FROM orders o
     LEFT JOIN sites s ON o.site_id = s.id
     LEFT JOIN distributors d ON o.distributor_id = d.id
     WHERE o.id = ?`,
    [req.params.id]
  ) as any
  if (!order) return respondError(res, '订单不存在', 404)

  // Distributors can only see their own
  if (req.user!.role === 'distributor' && order.distributor_id !== req.user!.distributorId) {
    return respondError(res, '无权查看此订单', 403)
  }

  // Include status log
  const statusLog = db.all(
    'SELECT * FROM order_status_log WHERE order_id = ? ORDER BY changed_at DESC',
    [req.params.id]
  )

  respond(res, { ...order, status_log: statusLog })
})

// DELETE /orders/:id — 仅操作员；级联删除 order_status_log
orderRouter.delete('/:id', requireAuth, requireRole('operator'), (req: Request, res: Response) => {
  const db = getDb()
  const row = db.get('SELECT id FROM orders WHERE id = ?', [req.params.id])
  if (!row) return respondError(res, '订单不存在', 404)
  db.run('DELETE FROM orders WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

// POST /orders - Create manual order
orderRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const user = req.user!

  let distributorId: number
  if (user.role === 'distributor') {
    distributorId = user.distributorId!
  } else {
    distributorId = req.body.distributor_id
    if (!distributorId) return respondError(res, '操作员录单需指定 distributor_id')
  }

  // Verify distributor exists
  const dist = db.get('SELECT * FROM distributors WHERE id = ?', [distributorId]) as any
  if (!dist) return respondError(res, '分销商不存在', 404)

  const {
    customer_name, customer_phone, customer_whatsapp, customer_city, customer_address,
    line_items, item_summary, expedited_fee, note, site_id,
    order_status: reqOrderStatus,
  } = req.body

  const orderNumber = generateOrderNumber(distributorId)
  const orderStatus = reqOrderStatus === 'customer_confirmed' ? 'customer_confirmed' : 'unconfirmed'

  // Use negative timestamp as woo_order_id for manual orders to avoid UNIQUE conflict
  const manualWooId = -Date.now()

  // Calculate total from line items
  let total = 0
  const parsedItems = Array.isArray(line_items) ? line_items : []
  for (const item of parsedItems) {
    total += (Number(item.price) || 0) * (Number(item.quantity) || 1)
  }
  total += Number(expedited_fee) || 0

  db.run(
    `INSERT INTO orders (
      site_id, woo_order_id, order_number, status,
      customer_name, customer_email, customer_phone, customer_whatsapp,
      customer_city, customer_address,
      payment_method, total, currency,
      line_items, shipping_address, billing_address,
      date_created, date_modified, pulled_at,
      distributor_id, source, created_by_role, created_by_id,
      order_status, delivery_status,
      item_summary, expedited_fee, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      site_id || '', manualWooId, orderNumber, 'manual',
      customer_name || '', '', customer_phone || '', customer_whatsapp || '',
      customer_city || '', customer_address || '',
      '', String(total), 'AED',
      JSON.stringify(parsedItems), '{}', '{}',
      now(), now(), now(),
      distributorId, 'manual', user.role, user.userId,
      orderStatus, 'not_submitted',
      item_summary || '', Number(expedited_fee) || 0, note || ''
    ]
  )

  const created = db.get(
    'SELECT * FROM orders WHERE order_number = ?', [orderNumber]
  )

  logStatusChange((created as any).id, 'order_status', null, orderStatus, userTag(req), '创建订单')

  respond(res, created, 201)
})

// PUT /orders/:id - Edit order (only when delivery_status = not_submitted)
orderRouter.put('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const order = db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any
  if (!order) return respondError(res, '订单不存在', 404)

  // Check permission
  if (req.user!.role === 'distributor') {
    if (order.distributor_id !== req.user!.distributorId) return respondError(res, '无权编辑此订单', 403)
  }

  // Check if order is locked
  if (order.delivery_status && order.delivery_status !== 'not_submitted') {
    return respondError(res, '订单已提交，无法编辑')
  }

  const {
    customer_name, customer_phone, customer_whatsapp, customer_city, customer_address,
    line_items, item_summary, expedited_fee, note, site_id,
  } = req.body

  const sets: string[] = []
  const params: unknown[] = []

  if (customer_name !== undefined) { sets.push('customer_name = ?'); params.push(customer_name) }
  if (customer_phone !== undefined) { sets.push('customer_phone = ?'); params.push(customer_phone) }
  if (customer_whatsapp !== undefined) { sets.push('customer_whatsapp = ?'); params.push(customer_whatsapp) }
  if (customer_city !== undefined) { sets.push('customer_city = ?'); params.push(customer_city) }
  if (customer_address !== undefined) { sets.push('customer_address = ?'); params.push(customer_address) }
  if (note !== undefined) { sets.push('note = ?'); params.push(note) }
  if (item_summary !== undefined) { sets.push('item_summary = ?'); params.push(item_summary) }
  if (expedited_fee !== undefined) { sets.push('expedited_fee = ?'); params.push(Number(expedited_fee) || 0) }
  if (site_id !== undefined) { sets.push('site_id = ?'); params.push(site_id || null) }
  if (line_items !== undefined) {
    const parsedItems = Array.isArray(line_items) ? line_items : []
    sets.push('line_items = ?'); params.push(JSON.stringify(parsedItems))
    // Recalculate total
    let total = 0
    for (const item of parsedItems) {
      total += (Number(item.price) || 0) * (Number(item.quantity) || 1)
    }
    total += Number(expedited_fee ?? order.expedited_fee) || 0
    sets.push('total = ?'); params.push(String(total))
  }

  if (sets.length === 0) return respondError(res, '没有可更新的字段')

  sets.push('date_modified = ?'); params.push(now())
  params.push(req.params.id)
  db.run(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, params)

  const updated = db.get(
    `SELECT o.*, s.name as site_name,
            COALESCE(NULLIF(TRIM(d.name), ''), d.code) as distributor_name,
            d.code as distributor_code
     FROM orders o LEFT JOIN sites s ON o.site_id = s.id LEFT JOIN distributors d ON o.distributor_id = d.id
     WHERE o.id = ?`,
    [req.params.id]
  )
  respond(res, updated)
})

// PUT /orders/:id/order-status - Update order confirmation status
orderRouter.put('/:id/order-status', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const { order_status: newStatus } = req.body
  if (!newStatus || !['unconfirmed', 'customer_confirmed'].includes(newStatus)) {
    return respondError(res, 'order_status 必须是 unconfirmed 或 customer_confirmed')
  }

  const order = db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any
  if (!order) return respondError(res, '订单不存在', 404)

  if (req.user!.role === 'distributor') {
    if (order.distributor_id !== req.user!.distributorId) return respondError(res, '无权操作此订单', 403)
    if (newStatus !== 'customer_confirmed') return respondError(res, '分销商只能确认订单')
  }

  if (order.delivery_status !== 'not_submitted') {
    return respondError(res, '订单已提交，无法修改确认状态')
  }

  const oldStatus = order.order_status
  db.run('UPDATE orders SET order_status = ?, date_modified = ? WHERE id = ?', [newStatus, now(), req.params.id])
  logStatusChange(order.id, 'order_status', oldStatus, newStatus, userTag(req))

  respond(res, { updated: true, order_status: newStatus })
})

// PUT /orders/:id/delivery-status - Update delivery status (operator only)
orderRouter.put('/:id/delivery-status', requireAuth, requireRole('operator'), (req: Request, res: Response) => {
  const db = getDb()
  const { delivery_status: newStatus, note } = req.body

  const validStatuses = ['not_submitted', 'submitted', 'delivery_exception', 'settled', 'cancelled']
  if (!newStatus || !validStatuses.includes(newStatus)) {
    return respondError(res, `delivery_status 必须是: ${validStatuses.join(', ')}`)
  }

  const order = db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any
  if (!order) return respondError(res, '订单不存在', 404)

  // Rule: can only submit if order_status = customer_confirmed
  if (newStatus === 'submitted' && order.order_status !== 'customer_confirmed') {
    return respondError(res, '只有"客户已确认"的订单才能提交')
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    'not_submitted': ['submitted', 'cancelled'],
    'submitted': ['delivery_exception', 'settled', 'cancelled'],
    'delivery_exception': ['settled', 'cancelled'],
    'settled': [],
    'cancelled': [],
  }

  const currentStatus = order.delivery_status || 'not_submitted'
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return respondError(res, `无法从 "${currentStatus}" 转为 "${newStatus}"`)
  }

  const oldStatus = order.delivery_status
  db.run('UPDATE orders SET delivery_status = ?, reviewed_by = ?, date_modified = ? WHERE id = ?',
    [newStatus, req.user!.userId, now(), req.params.id])
  logStatusChange(order.id, 'delivery_status', oldStatus, newStatus, userTag(req), note)

  respond(res, { updated: true, delivery_status: newStatus })
})

// POST /orders/pull - Pull from WooCommerce (legacy, keep as fallback)
orderRouter.post('/pull', requireAuth, requireRole('operator'), async (_req: Request, res: Response) => {
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
        const whatsapp = extractCustomerWhatsappFromWooOrder(order)
        const customerCity = order.billing?.city || order.shipping?.city || ''
        const customerAddress = [
          order.shipping?.address_1 || order.billing?.address_1,
          (order.shipping as any)?.address_2 || (order.billing as any)?.address_2,
        ].filter(Boolean).join(', ')

        try {
          // Check if exists
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
                site.distributor_id || null, 'woo_webhook', 'system',
                'unconfirmed', 'not_submitted'
              ]
            )
          }
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

// PUT /orders/:id/woo-status - Update WooCommerce status (operator only)
orderRouter.put('/:id/woo-status', requireAuth, requireRole('operator'), async (req: Request, res: Response) => {
  const { status } = req.body
  if (!status) return respondError(res, '缺少 status 字段')

  const db = getDb()
  const order = db.get(
    'SELECT o.*, s.url, s.consumer_key, s.consumer_secret FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = ?',
    [req.params.id]
  ) as any
  if (!order) return respondError(res, '订单不存在', 404)
  if (!order.woo_order_id || order.woo_order_id === 0) return respondError(res, '非WooCommerce订单，无法同步状态')

  try {
    const wooSite: WooSite = { url: order.url, consumer_key: order.consumer_key, consumer_secret: order.consumer_secret }
    await wooUpdateStatus(wooSite, order.woo_order_id, status)
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, order.id])
    respond(res, { updated: true })
  } catch (err: any) {
    respondError(res, `同步失败: ${err.message}`, 500)
  }
})

// --- Reserved interfaces (v1 returns 501) ---

orderRouter.get('/:id/settlement', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ code: 501, message: '结算功能将在 v2 实现', data: null })
})

orderRouter.put('/:id/settlement', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ code: 501, message: '结算功能将在 v2 实现', data: null })
})

orderRouter.get('/:id/routing-options', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ code: 501, message: '订单路由功能将在 v2 实现', data: null })
})

orderRouter.put('/:id/route', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ code: 501, message: '订单路由功能将在 v2 实现', data: null })
})

orderRouter.post('/:id/auto-route', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ code: 501, message: '订单路由功能将在 v2 实现', data: null })
})
