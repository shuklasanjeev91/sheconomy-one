import { describe, expect, it } from 'vitest'

import { buildCustomerOrderInvoiceHtml } from '~/lib/orders/order-invoice'

describe('buildCustomerOrderInvoiceHtml', () => {
  it('renders a customer receipt with multiple line items', () => {
    const html = buildCustomerOrderInvoiceHtml({
      orderNumber: 'SO-1001',
      orderDate: '2026-07-01T10:00:00.000Z',
      currency: 'INR',
      shopName: 'Demo Shop',
      customerName: 'Ada',
      customerEmail: 'ada@example.com',
      customerPhone: '+91 98765 43210',
      shippingAddress: {
        address_line_1: '12 Market St',
        city: 'Bengaluru',
        state: 'KA',
        postal_code: '560001',
        country: 'IN',
      },
      subtotalAmount: 500,
      discountAmount: 50,
      shippingAmount: 40,
      taxAmount: 0,
      totalAmount: 490,
      paymentMode: 'cod',
      paymentStatus: 'pending',
      items: [
        {
          title: 'Scarf',
          sku: 'SCF-1',
          variation: 'Color: Red',
          unitPrice: 250,
          quantity: 1,
          totalPrice: 250,
        },
        {
          title: 'Tote',
          sku: 'TOTE-1',
          unitPrice: 250,
          quantity: 1,
          totalPrice: 250,
        },
      ],
    })

    expect(html).toContain('SHEconomy Customer Receipt')
    expect(html).toContain('SO-1001')
    expect(html).toContain('Scarf')
    expect(html).toContain('Tote')
    expect(html).toContain('12 Market St')
    expect(html).toContain('+91 98765 43210')
    expect(html).toContain('cod')
  })
})
