import { describe, expect, it } from 'vitest'
import {
  buildConfirmationLetter,
  buildSupplierPasteText,
  goodsTotal,
  toLocalAePhone,
  toWhatsappE164,
} from './orderCopyTexts'

const sample = {
  website_order_number: '6903',
  order_number: 'VC091601K',
  site_url: 'https://vaultcare-d.com',
  customer_name: 'Ahmed',
  customer_phone: '0508123334',
  customer_whatsapp: '971508123334',
  customer_city: 'Dubai',
  customer_address: 'Marina Walk',
  customer_note: 'Please call first',
  note: 'leave at door',
  received_amount: 250,
  currency: 'AED',
  line_items: [
    { sku: 'VC459', name: 'Spray', quantity: 1, price: 89 },
    { sku: 'VC460', name: 'Gel', quantity: 2, price: 89 },
  ],
}

describe('phone conversion', () => {
  it('converts local AE phone to WhatsApp E164', () => {
    expect(toWhatsappE164('0508123334')).toBe('971508123334')
  })

  it('converts E164 back to local phone', () => {
    expect(toLocalAePhone('971508123334')).toBe('0508123334')
  })
})

describe('supplier paste + confirmation letter', () => {
  it('uses website order number and source url', () => {
    const text = buildSupplierPasteText(sample)
    expect(text).toContain('Order number: 6903')
    expect(text).toContain('Source: https://vaultcare-d.com')
    expect(text).toContain('VC459  1  89')
    expect(text).toContain('VC460  2  178')
    expect(text).toContain('Total Price: 250')
  })

  it('puts code before quantity in the confirmation letter', () => {
    const letter = buildConfirmationLetter(sample)
    expect(letter).toContain('Order number: 6903')
    expect(letter).toContain('WhatsApp: 971508123334')
    expect(letter).toContain('Note: Please call first')
    expect(letter).toContain('VC459 x 1')
    expect(letter).toContain('VC460 x 2')
    expect(letter).not.toContain('VC091601K')
  })

  it('computes goods total from line items', () => {
    expect(goodsTotal(sample.line_items)).toBe(267)
  })
})
