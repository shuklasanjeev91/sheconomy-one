import { describe, expect, it } from 'vitest'

import { toInAppPayUHref } from '~/commerce/lib/checkout-payment-route'

describe('resume order payment bridge href', () => {
  it('keeps in-app PayU bridge paths relative', () => {
    expect(toInAppPayUHref('https://sheconomy.in/orders/payu?action=https%3A%2F%2Fsecure.payu.in%2F_payment')).toBe(
      '/orders/payu?action=https%3A%2F%2Fsecure.payu.in%2F_payment',
    )
  })

  it('does not treat PayU test host as the bridge', () => {
    expect(toInAppPayUHref('https://test.payu.in/_payment')).toBe('https://test.payu.in/_payment')
  })
})
