import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { generateOrderNumber } from '../services/order-number.js'
import { extractCustomerWhatsappFromWooOrder } from '../services/woo-client.js'
import { ORDER_INBOUND_FROM_WOO_ENABLED } from '../services/order-sync.js'

export const webhookRouter = Router()

function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }
function now() { return new Date().toISOString() }

// POST /webhooks/woo/:siteId
webhookRouter.post('/woo/:siteId', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.siteId]) as any
  if (!site) return respondError(res, 'Site not found', 404)

  if (!ORDER_INBOUND_FROM_WOO_ENABLED) {
    return respond(res, { message: 'Order webhook inbound disabled' })
  }

  // Verify webhook signature if secret is configured
  if (site.webhook_secret) {
    const signature = req.headers['x-wc-webhook-signature'] as string
    if (!signature) return respondError(res, 'Missing webhook signature', 401)

    const body = JSON.stringify(req.body)
    const expected = crypto
      .createHmac('sha256', site.webhook_secret)
      .update(body, 'utf8')
      .digest('base64')

    if (signature !== expected) {
      return respondError(res, 'Invalid webhook signature', 401)
    }
  }

  const order = req.body
  if (!order || !order.id) {
    // WooCommerce sends a ping with empty body on webhook creation
    return respond(res, { message: 'Webhook received (ping)' })
  }

  if (!site.distributor_id) {
    return respondError(res, 'Site has no distributor assigned', 400)
  }

  try {
    const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ')
    const whatsapp = extractCustomerWhatsappFromWooOrder(order)

    const customerCity = order.billing?.city || order.shipping?.city || ''
    const customerAddress = [
      order.shipping?.address_1 || order.billing?.address_1,
      order.shipping?.address_2 || order.billing?.address_2,
    ].filter(Boolean).join(', ')
    const customerNote = String(order.customer_note || '').trim()
    const websiteOrderNumber = String(order.number || order.id || '')
    const receivedAmount = Number(order.total) || 0

    // Check if order already exists
    const existing = db.get(
      'SELECT id, delivery_status FROM orders WHERE site_id = ? AND woo_order_id = ?',
      [site.id, order.id]
    ) as any

    if (existing) {
      // Only update if not locked (delivery_status = not_submitted)
      if (existing.delivery_status && existing.delivery_status !== 'not_submitted') {
        return respond(res, { message: 'Order already locked, skipping update' })
      }
      db.run(
        `UPDATE orders SET
          status = ?, customer_name = ?, customer_email = ?, customer_phone = ?, customer_whatsapp = ?,
          customer_city = ?, customer_address = ?, customer_note = ?, total = ?, received_amount = ?, currency = ?,
          line_items = ?, shipping_address = ?, billing_address = ?,
          date_modified = ?, pulled_at = ?, woo_raw_data = ?, website_order_number = ?
        WHERE id = ?`,
        [
          order.status, customerName, order.billing?.email || '', order.billing?.phone || '', whatsapp,
          customerCity, customerAddress, customerNote, order.total, receivedAmount, order.currency,
          JSON.stringify(order.line_items || []),
          JSON.stringify(order.shipping || {}),
          JSON.stringify(order.billing || {}),
          order.date_modified, now(), JSON.stringify(order), websiteOrderNumber,
          existing.id
        ]
      )
      return respond(res, { message: 'Order updated', order_id: existing.id })
    }

    // Generate local order number
    const orderNumber = generateOrderNumber(site.distributor_id)

    db.run(
      `INSERT INTO orders (
        site_id, woo_order_id, order_number, status,
        customer_name, customer_email, customer_phone, customer_whatsapp,
        customer_city, customer_address, customer_note,
        payment_method, total, received_amount, currency,
        line_items, shipping_address, billing_address,
        date_created, date_modified, pulled_at,
        distributor_id, source, created_by_role, created_by_id,
        order_status, delivery_status, woo_raw_data, website_order_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        site.id, order.id, orderNumber, order.status,
        customerName, order.billing?.email || '', order.billing?.phone || '', whatsapp,
        customerCity, customerAddress, customerNote,
        order.payment_method_title || '', order.total, receivedAmount, order.currency,
        JSON.stringify(order.line_items || []),
        JSON.stringify(order.shipping || {}),
        JSON.stringify(order.billing || {}),
        order.date_created, order.date_modified, now(),
        site.distributor_id, 'woo_webhook', 'system', null,
        'unconfirmed', 'not_submitted', JSON.stringify(order), websiteOrderNumber
      ]
    )

    respond(res, { message: 'Order created', order_number: orderNumber })
  } catch (err: any) {
    respondError(res, `Webhook processing error: ${err.message}`, 500)
  }
})
