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
  toShiprocketReturnBody,
  type CreateReturnInput,
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

describe('shedelivery reverse pickup mapper', () => {
  const input: CreateReturnInput = {
    orderId: 'ord-1',
    orderNumber: 'SO-1',
    // Pickup = buyer.
    pickupCustomerName: 'Buyer',
    pickupPhone: '9999999999',
    pickupEmail: 'b@example.com',
    pickupAddressLine1: 'Buyer Line 1',
    pickupCity: 'Mumbai',
    pickupState: 'MH',
    pickupPostcode: '400001',
    // Delivery = seller return address.
    sellerName: 'Shop',
    sellerPhone: '8888888888',
    sellerAddressLine1: 'Seller Line 1',
    sellerCity: 'Delhi',
    sellerState: 'DL',
    sellerPostcode: '110001',
    weightKg: 0.5,
    items: [{ name: 'Item', units: 1, sellingPrice: 100 }],
  }

  it('swaps pickup (buyer) and shipping (seller) fields', () => {
    const body = toShiprocketReturnBody(input)
    // Pickup is the buyer.
    expect(body.pickup_customer_name).toBe('Buyer')
    expect(body.pickup_pincode).toBe('400001')
    expect(body.pickup_address).toBe('Buyer Line 1')
    // Shipping is the seller return address.
    expect(body.shipping_customer_name).toBe('Shop')
    expect(body.shipping_pincode).toBe('110001')
    expect(body.shipping_address).toBe('Seller Line 1')
    // Return orders are marked prepaid and carry a RET- prefixed id.
    expect(body.order_id).toBe('RET-SO-1')
    expect(body.payment_method).toBe('PREPAID')
    expect(body.order_items).toHaveLength(1)
  })
})
