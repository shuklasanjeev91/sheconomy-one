import { describe, expect, it } from 'vitest'

import { toInAppPayUHref } from '~/commerce/lib/checkout-payment-route'

describe('resume order payment bridge href', () => {
  it('keeps in-app PayU bridge paths relative for live PayU actions', () => {
    expect(
      toInAppPayUHref(
        'https://sheconomy.in/orders/payu?action=https%3A%2F%2Fsecure.payu.in%2F_payment',
      ),
    ).toBe('/orders/payu?action=https%3A%2F%2Fsecure.payu.in%2F_payment')
  })
})
