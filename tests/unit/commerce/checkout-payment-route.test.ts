import { describe, expect, it } from 'vitest'

import {
  checkoutShippingLabel,
  isAppPayUBridgeUrl,
  onlinePaymentOptionCopy,
  payuPgForInstrument,
  resolvePostCheckoutNext,
  shouldShowCheckoutInstruments,
  toInAppPayUHref,
} from '~/commerce/lib/checkout-payment-route'

describe('onlinePaymentOptionCopy', () => {
  it('uses seller gateway when only direct shops', () => {
    expect(
      onlinePaymentOptionCopy({
        shepayShops: [],
        directShops: [{ shopId: '1', shopName: 'Ada Shop', gateway: 'Razorpay' }],
      }),
    ).toEqual({
      title: 'Pay Ada Shop',
      subtitle: 'Via Razorpay · paid directly to the seller · 0% commission',
    })
  })

  it('uses SHEPay PayU hosted when no seller gateway', () => {
    const copy = onlinePaymentOptionCopy({
      shepayShops: [{ shopName: 'Platform Shop' }],
      directShops: [],
    })
    expect(copy.title).toBe('Pay online with SHEPay')
    expect(copy.subtitle.toLowerCase()).toContain('payu')
  })

  it('describes mixed carts', () => {
    const copy = onlinePaymentOptionCopy({
      shepayShops: [{ shopName: 'A' }],
      directShops: [{ shopId: '2', shopName: 'B', gateway: 'Stripe' }],
    })
    expect(copy.title).toBe('Pay online')
    expect(copy.subtitle.toLowerCase()).toContain('shepay')
  })
})

describe('checkoutShippingLabel', () => {
  it('defaults to SHEDelivery', () => {
    expect(checkoutShippingLabel(null)).toBe('SHEDelivery')
    expect(checkoutShippingLabel({ shippingLabel: 'Shiprocket' })).toBe('Shiprocket')
  })
})

describe('shouldShowCheckoutInstruments', () => {
  it('shows Amazon-style instruments when SHEPay shops are present', () => {
    expect(
      shouldShowCheckoutInstruments({
        shepayShops: [{ shopName: 'A' }],
        directShops: [],
      }),
    ).toBe(true)
  })

  it('hides instruments for seller-direct-only carts', () => {
    expect(
      shouldShowCheckoutInstruments({
        shepayShops: [],
        directShops: [{ shopId: '1' }],
      }),
    ).toBe(false)
  })
})

describe('payuPgForInstrument', () => {
  it('maps checkout instruments to PayU pg codes', () => {
    expect(payuPgForInstrument('upi')).toBe('UPI')
    expect(payuPgForInstrument('card')).toBe('CC')
    expect(payuPgForInstrument('netbanking')).toBe('NB')
    expect(payuPgForInstrument('wallet')).toBe('CASH')
  })
})

describe('resolvePostCheckoutNext', () => {
  it('sends COD straight to success', () => {
    expect(
      resolvePostCheckoutNext({
        mode: 'cod',
        checkoutUrl: null,
        shepayError: null,
        hasShepaySteps: false,
      }),
    ).toEqual({ kind: 'success' })
  })

  it('cancels when SHEPay session fails', () => {
    expect(
      resolvePostCheckoutNext({
        mode: 'online',
        checkoutUrl: null,
        shepayError: 'SHEPay is not configured',
        hasShepaySteps: true,
      }),
    ).toEqual({
      kind: 'cancel_and_stay',
      error: 'SHEPay is not configured',
    })
  })

  it('routes SHEPay to in-app PayU bridge', () => {
    const url = 'https://sheconomy.com/orders/payu?action=https%3A%2F%2Ftest.payu.in%2F_payment&payload=%7B%7D'
    expect(
      resolvePostCheckoutNext({
        mode: 'online',
        checkoutUrl: url,
        shepayError: null,
        hasShepaySteps: true,
      }),
    ).toEqual({
      kind: 'payu_bridge',
      href: toInAppPayUHref(url),
    })
    expect(isAppPayUBridgeUrl(url)).toBe(true)
  })

  it('opens seller gateway externally when direct-only', () => {
    expect(
      resolvePostCheckoutNext({
        mode: 'online',
        checkoutUrl: 'https://razorpay.com/pay/xyz',
        shepayError: null,
        hasShepaySteps: false,
      }),
    ).toEqual({ kind: 'external_pay', url: 'https://razorpay.com/pay/xyz' })
  })

  it('cancels direct-only without checkout URL', () => {
    expect(
      resolvePostCheckoutNext({
        mode: 'online',
        checkoutUrl: null,
        shepayError: null,
        hasShepaySteps: false,
      }).kind,
    ).toBe('cancel_and_stay')
  })
})
