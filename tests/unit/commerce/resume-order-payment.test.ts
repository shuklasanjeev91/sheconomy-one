import { describe, expect, it } from 'vitest'

import { isAppPayUBridgeUrl, toInAppPayUHref } from '~/commerce/lib/checkout-payment-route'

describe('resume order payment', () => {
  it('resumes through the in-app PayU bridge path', () => {
    const href = toInAppPayUHref('https://sheconomy.in/orders/payu?action=x&payload=%7B%7D')
    expect(href).toBe('/orders/payu?action=x&payload=%7B%7D')
    expect(isAppPayUBridgeUrl(href)).toBe(true)
  })
})
