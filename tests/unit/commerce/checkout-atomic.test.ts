import { describe, expect, it } from 'vitest'

import {
  firstCheckoutUrlFromSteps,
  parseAtomicCheckoutPayload,
} from '~/commerce/lib/checkout-utils'

describe('parseAtomicCheckoutPayload', () => {
  it('maps a successful multi-shop checkout payload', () => {
    const result = parseAtomicCheckoutPayload({
      success: true,
      checkout_group_id: 'grp-1',
      status: 'awaiting_payment',
      order_ids: ['o1', 'o2'],
      order_numbers: ['100', '101'],
      subtotal_amount: 50,
      discount_amount: 5,
      shipping_amount: 10,
      platform_fee_amount: 0,
      total_amount: 55,
      payment_steps: [
        {
          id: 'ps1',
          order_id: 'o1',
          shop_id: 's1',
          collection: 'shepay',
          provider: 'razorpay',
          status: 'pending',
          amount: 20,
          checkout_url: 'https://pay.example/1',
        },
        {
          id: 'ps2',
          order_id: 'o2',
          shop_id: 's2',
          collection: 'shepay',
          provider: 'razorpay',
          status: 'pending',
          amount: 25,
          checkout_url: null,
        },
      ],
    })

    expect(result.error).toBeNull()
    expect(result.data?.checkoutGroupId).toBe('grp-1')
    expect(result.data?.orderIds).toEqual(['o1', 'o2'])
    expect(result.data?.paymentSteps).toHaveLength(2)
    expect(result.data?.paymentSteps[0]?.checkoutUrl).toBe('https://pay.example/1')
    expect(result.data?.shippingAmount).toBe(10)
    expect(result.data?.platformFeeAmount).toBe(0)
    expect(result.data?.totalAmount).toBe(55)
  })

  it('defaults shipping and platform fee to zero when omitted', () => {
    const result = parseAtomicCheckoutPayload({
      success: true,
      checkout_group_id: 'grp-2',
      status: 'awaiting_payment',
      order_ids: ['o1'],
      order_numbers: ['200'],
      subtotal_amount: 20,
      total_amount: 20,
      payment_steps: [],
    })
    expect(result.error).toBeNull()
    expect(result.data?.shippingAmount).toBe(0)
    expect(result.data?.platformFeeAmount).toBe(0)
  })

  it('rejects failed or incomplete payloads', () => {
    expect(parseAtomicCheckoutPayload({ success: false, message: 'Coupon exhausted' }).error).toBe(
      'Coupon exhausted',
    )
    expect(parseAtomicCheckoutPayload({ success: true }).error).toBe(
      'Checkout could not be created',
    )
    expect(parseAtomicCheckoutPayload(null).error).toBe('Checkout could not be created')
  })
})

describe('firstCheckoutUrlFromSteps', () => {
  it('prefers client camelCase then snake_case URLs', () => {
    expect(
      firstCheckoutUrlFromSteps([{ checkoutUrl: 'https://a.example' }, { checkout_url: 'https://b.example' }]),
    ).toBe('https://a.example')
    expect(firstCheckoutUrlFromSteps([{ checkout_url: 'https://b.example' }])).toBe(
      'https://b.example',
    )
    expect(firstCheckoutUrlFromSteps([{ checkout_url: null }, {}])).toBeNull()
  })
})
