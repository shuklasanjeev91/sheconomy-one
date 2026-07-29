import { describe, expect, it } from 'vitest'

import {
  checkoutShippingLabel,
  isAppPayUBridgeUrl,
  isOrderPaymentSettled,
  onlinePaymentOptionCopy,
  orderSuccessHeadline,
  orderSuccessSubtitle,
  ordersAwaitingOnlinePayment,
  resolvePostCheckoutNext,
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
    expect(copy.title).toBe('Pay online')
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

describe('isAppPayUBridgeUrl', () => {
  it('matches PayU bridge only, not payu-return', () => {
    expect(isAppPayUBridgeUrl('/orders/payu?action=x')).toBe(true)
    expect(isAppPayUBridgeUrl('https://sheconomy.in/orders/payu')).toBe(true)
    expect(isAppPayUBridgeUrl('/orders/payu-return?status=success')).toBe(false)
    expect(isAppPayUBridgeUrl('https://sheconomy.in/orders/payu-return')).toBe(false)
  })
})

describe('ordersAwaitingOnlinePayment', () => {
  it('detects unpaid online holds from DB status', () => {
    expect(
      ordersAwaitingOnlinePayment([
        { payment_mode: 'online', payment_status: 'pending', order_status: 'pending' },
      ]),
    ).toBe(true)
    expect(
      ordersAwaitingOnlinePayment([
        { payment_mode: 'online', payment_status: 'completed', order_status: 'confirmed' },
      ]),
    ).toBe(false)
    expect(
      ordersAwaitingOnlinePayment([
        { payment_mode: 'cod', payment_status: 'pending', order_status: 'pending' },
      ]),
    ).toBe(false)
  })

  it('treats cancelled as settled', () => {
    expect(
      isOrderPaymentSettled({
        payment_mode: 'online',
        payment_status: 'pending',
        order_status: 'cancelled',
      }),
    ).toBe(true)
  })
})

describe('orderSuccessHeadline', () => {
  it('never confirms while awaiting payment', () => {
    expect(
      orderSuccessHeadline({
        awaitingPayment: true,
        orders: [{ payment_status: 'pending' }],
      }),
    ).toBe('Complete your payment')
    expect(
      orderSuccessHeadline({
        awaitingPayment: false,
        orders: [{ payment_status: 'paid' }],
      }),
    ).toBe('Order confirmed')
    expect(orderSuccessSubtitle({ awaitingPayment: true }).toLowerCase()).toContain('reserved')
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
    const url = 'https://sheconomy.in/orders/payu?action=https%3A%2F%2Ftest.payu.in%2F_payment&payload=%7B%7D'
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
