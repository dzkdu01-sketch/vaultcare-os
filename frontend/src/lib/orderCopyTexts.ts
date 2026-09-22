export type OrderCopyLine = {
  sku?: string
  name?: string
  quantity?: number
  price?: number
}

export type OrderCopyInput = {
  website_order_number?: string | null
  order_number?: string | null
  site_url?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_whatsapp?: string | null
  customer_city?: string | null
  customer_address?: string | null
  customer_note?: string | null
  note?: string | null
  received_amount?: number | string | null
  total?: number | string | null
  currency?: string | null
  line_items?: OrderCopyLine[] | string | null
}

export function digitsOnly(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '')
}

/** 0508123334 ↔ 971508123334 */
export function toWhatsappE164(phone: string | null | undefined): string {
  const d = digitsOnly(phone)
  if (!d) return ''
  if (d.startsWith('971')) return d
  if (d.startsWith('0') && d.length >= 9) return `971${d.slice(1)}`
  if (d.startsWith('5') && d.length === 9) return `971${d}`
  return d
}

export function toLocalAePhone(phone: string | null | undefined): string {
  const d = digitsOnly(phone)
  if (!d) return ''
  if (d.startsWith('971')) return `0${d.slice(3)}`
  if (d.startsWith('5') && d.length === 9) return `0${d}`
  return d.startsWith('0') ? d : d
}

export function parseOrderLineItems(raw: OrderCopyInput['line_items']): OrderCopyLine[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function goodsTotal(items: OrderCopyLine[]): number {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
}

export function websiteOrderNo(order: OrderCopyInput): string {
  return String(order.website_order_number || '').trim() || String(order.order_number || '').trim()
}

function money(value: number | string | null | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** 供应商下单表单可直接粘贴 */
export function buildSupplierPasteText(order: OrderCopyInput): string {
  const items = parseOrderLineItems(order.line_items)
  const wa = toWhatsappE164(order.customer_whatsapp || order.customer_phone)
  const phone = toLocalAePhone(order.customer_phone || order.customer_whatsapp)
  const total = order.received_amount ?? order.total ?? goodsTotal(items)
  const lines = [
    `Order number: ${websiteOrderNo(order)}`,
    `Source: ${order.site_url || ''}`.trim(),
    '',
    `name: ${order.customer_name || ''}`,
    `phone: ${phone}`,
    `whatsapp: ${wa}`,
    `city: ${order.customer_city || ''}`,
    `address: ${order.customer_address || ''}`,
    '',
    ...items.map((item) => {
      const code = item.sku || item.name || ''
      const qty = Number(item.quantity) || 1
      const lineTotal = (Number(item.price) || 0) * qty
      return `${code}  ${qty}  ${money(lineTotal)}`
    }),
    '',
    `Total Price: ${money(total)}`,
    `note: ${order.note || ''}`,
  ]
  return lines.join('\n').trim()
}

/** 发给客户的英文确认函（代码在前、数量在后） */
export function buildConfirmationLetter(order: OrderCopyInput): string {
  const items = parseOrderLineItems(order.line_items)
  const wa = toWhatsappE164(order.customer_whatsapp || order.customer_phone)
  const total = order.received_amount ?? order.total ?? goodsTotal(items)
  const currency = order.currency || 'AED'
  const itemLines = items.length
    ? items.map((item) => `${item.sku || item.name || 'ITEM'} x ${Number(item.quantity) || 1}`).join('\n')
    : '-'
  return [
    'Order Confirmation',
    '',
    `Order number: ${websiteOrderNo(order)}`,
    `Name: ${order.customer_name || ''}`,
    `WhatsApp: ${wa}`,
    `Note: ${order.customer_note || ''}`,
    '',
    'Items:',
    itemLines,
    '',
    `Total: ${currency} ${money(total)}`,
    '',
    'Cash on delivery. We will contact you before delivery.',
  ].join('\n')
}
