import { describe, expect, it } from 'vitest'

import {
  buildPayUHashString,
  buildPayUReverseHashString,
  formatPayUAmount,
  payURequestHash,
} from '~/commerce/lib/payu-hash'
import {
  toPickrrCreateBody,
  toShiprocketCreateOrderBody,
  type CreateShipmentInput,
} from '~/commerce/lib/shedelivery'

describe('payu-hash', () => {
  const params = {
    key: 'gtKFFx',
    txnid: 'txn123',
    amount: '10.00',
    productinfo: 'SHEPay',
    firstname: 'Ada',
    email: 'ada@example.com',
    udf1: 'step-1',
  }

  it('builds the request hash string in PayU order', () => {
    const salt = 'salt'
    expect(buildPayUHashString(params, salt)).toBe(
      'gtKFFx|txn123|10.00|SHEPay|Ada|ada@example.com|step-1||||||||||salt',
    )
  })

  it('builds reverse hash string for response verification', () => {
    const salt = 'salt'
    expect(buildPayUReverseHashString({ ...params, status: 'success' }, salt)).toBe(
      'salt|success||||||||||step-1|ada@example.com|Ada|SHEPay|10.00|txn123|gtKFFx',
    )
  })

  it('formats amounts with two decimals', () => {
    expect(formatPayUAmount(10)).toBe('10.00')
    expect(formatPayUAmount(10.5)).toBe('10.50')
  })

  it('produces a stable sha-512 hex hash', async () => {
    const hash = await payURequestHash(params, 'eCwWELxi')
    expect(hash).toMatch(/^[a-f0-9]{128}$/)
  })
})

describe('shedelivery mappers', () => {
  const input: CreateShipmentInput = {
    orderId: 'ord-1',
    orderNumber: 'SO-1',
    shopId: 'shop-1',
    pickupPostcode: '110001',
    deliveryPostcode: '400001',
    weightKg: 0.5,
    paymentMethod: 'prepaid',
    customerName: 'Buyer',
    customerPhone: '9999999999',
    customerEmail: 'b@example.com',
    addressLine1: 'Line 1',
    city: 'Mumbai',
    state: 'MH',
    items: [{ name: 'Item', units: 1, sellingPrice: 100 }],
  }

  it('maps Shiprocket create body', () => {
    const body = toShiprocketCreateOrderBody(input)
    expect(body.order_id).toBe('SO-1')
    expect(body.billing_pincode).toBe('400001')
    expect(body.order_items).toHaveLength(1)
  })

  it('maps Pickrr create body', () => {
    const body = toPickrrCreateBody(input)
    expect(body.client_order_id).toBe('SO-1')
    expect(body.to_pincode).toBe('400001')
    expect(body.cod_amount).toBe(0)
  })
})
