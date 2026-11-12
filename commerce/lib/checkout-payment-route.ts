/**
 * Checkout payment UX helpers: partner-aware copy + post-place-order routing
 * (SHEPay → PayU Hosted bridge vs seller-direct gateway).
 */

export type OnlinePaymentCopy = {
  title: string
  subtitle: string
}

export type CheckoutOnlineProvider = 'shepay' | 'platform_payu'

/**
 * Marketplace online checkout always uses SHEPay (PayU Automate absolute split).
 * `platform_payu` remains only for legacy unpaid order resume / sponsored ads.
 */
export function resolveCheckoutOnlineProvider(_multiShop?: boolean): CheckoutOnlineProvider {
  return 'shepay'
}

export type DirectPaymentShop = {
  shopId: string
  shopName: string
  gateway: string
}

/** Buyer-facing online radio label from who collects payment. */
export function onlinePaymentOptionCopy(input: {
  shepayShops: { shopName: string }[]
  directShops: DirectPaymentShop[]
}): OnlinePaymentCopy {
  const hasShepay = input.shepayShops.length > 0
  const hasDirect = input.directShops.length > 0

  if (hasDirect && !hasShepay) {
    if (input.directShops.length === 1) {
      const shop = input.directShops[0]
      return {
        title: `Pay ${shop.shopName}`,
        subtitle: `Via ${shop.gateway} · paid directly to the seller · 0% commission`,
      }
    }
    return {
      title: 'Pay sellers directly',
      subtitle: input.directShops.map((shop) => `${shop.shopName} (${shop.gateway})`).join(' · '),
    }
  }

  if (hasShepay && !hasDirect) {
    return {
      title: 'Online payment',
      subtitle: 'Pay with UPI, card, net banking, or wallet · SHEPay (PayU) · 0% commission',
    }
  }

  return {
    title: 'Online payment',
    subtitle: 'SHEPay for some shops · other sellers via their own gateway · 0% commission',
  }
}

/** Shipping line for a shop: connected partner label or vendor self-ship default. */
export function checkoutShippingLabel(info: {
  shippingLabel?: string | null
  shippingConnected?: boolean
} | null | undefined): string {
  const label = info?.shippingLabel?.trim()
  if (label && label.toLowerCase() !== 'shedelivery') return label
  return 'Seller ships'
}

export type PostCheckoutNext =
  | { kind: 'payu_inline'; actionUrl: string; fields: Record<string, string>; txnid: string; paymentStepId: string }
  | { kind: 'payu_bridge'; href: string }
  | { kind: 'external_pay'; url: string }
  | { kind: 'success' }
  | { kind: 'cancel_and_stay'; error: string }

/** True when URL points at our in-app PayU form-POST bridge (not payu-return). */
export function isAppPayUBridgeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://sheconomy.local')
    return /\/orders\/payu\/?$/.test(parsed.pathname)
  } catch {
    const path = url.split('?')[0] ?? url
    return /\/orders\/payu\/?$/.test(path)
  }
}

export type OrderPaymentLike = {
  payment_status?: string | null
  payment_mode?: string | null
  order_status?: string | null
}

/** Paid or cancelled — no further online payment action required. */
export function isOrderPaymentSettled(order: OrderPaymentLike): boolean {
  if (order.order_status === 'cancelled') return true
  const status = (order.payment_status ?? '').toLowerCase()
  return status === 'completed' || status === 'paid'
}

/**
 * Online holds still needing payment. COD and settled/cancelled orders are excluded.
 * Driven by DB payment_status — not session flags.
 */
export function ordersAwaitingOnlinePayment(orders: OrderPaymentLike[]): boolean {
  if (!orders.length) return false
  return orders.some((order) => {
    const mode = (order.payment_mode ?? '').toLowerCase()
    if (mode === 'cod' || mode === 'cash_on_delivery') return false
    return !isOrderPaymentSettled(order)
  })
}

export function orderSuccessHeadline(input: {
  orders: OrderPaymentLike[]
  awaitingPayment: boolean
}): string {
  if (input.awaitingPayment) return 'Complete your payment'
  return input.orders.length > 1 ? 'Your packages are confirmed' : 'Order confirmed'
}

export function orderSuccessSubtitle(input: { awaitingPayment: boolean }): string {
  if (input.awaitingPayment) {
    return 'Your order is reserved until payment is confirmed. Complete your payment or cancel to release the reserved stock.'
  }
  return 'Save your order numbers. You can track every package from Your orders.'
}

/** Prefer a same-origin path+query for One router navigation. */
export function toInAppPayUHref(checkoutUrl: string): string {
  try {
    const parsed = new URL(checkoutUrl, 'https://sheconomy.local')
    return `${parsed.pathname}${parsed.search}`
  } catch {
    const idx = checkoutUrl.indexOf('/orders/payu')
    return idx >= 0 ? checkoutUrl.slice(idx) : checkoutUrl
  }
}

/**
 * Decide where checkout goes after atomic order create for online/COD.
 * Online SHEPay must not land on success before PayU; failures cancel and stay.
 * Prefer on-checkout merchant-hosted panel (payu_inline) when a payment step is ready.
 */
export function resolvePostCheckoutNext(input: {
  mode: 'online' | 'cod'
  checkoutUrl: string | null
  shepayError: string | null
  hasShepaySteps: boolean
  /** On-checkout PayU panel — Pay click runs seamless curl / form post. */
  payuInline?: {
    actionUrl: string
    fields: Record<string, string>
    txnid: string
    paymentStepId: string
  } | null
}): PostCheckoutNext {
  if (input.mode === 'cod') return { kind: 'success' }

  if (input.hasShepaySteps) {
    if (input.shepayError && !input.payuInline?.paymentStepId) {
      return {
        kind: 'cancel_and_stay',
        error: input.shepayError ?? 'Payment setup incomplete. Please try again.',
      }
    }
    if (input.payuInline?.paymentStepId) {
      return {
        kind: 'payu_inline',
        actionUrl: input.payuInline.actionUrl || '',
        fields: input.payuInline.fields || {},
        txnid: input.payuInline.txnid || '',
        paymentStepId: input.payuInline.paymentStepId,
      }
    }
    if (!input.checkoutUrl) {
      return {
        kind: 'cancel_and_stay',
        error: input.shepayError ?? 'Payment setup incomplete. Please try again.',
      }
    }
    if (isAppPayUBridgeUrl(input.checkoutUrl)) {
      return { kind: 'payu_bridge', href: toInAppPayUHref(input.checkoutUrl) }
    }
    return { kind: 'external_pay', url: input.checkoutUrl }
  }

  if (!input.checkoutUrl) {
    return {
      kind: 'cancel_and_stay',
      error:
        input.shepayError ??
        'Seller payment link is not ready. Please try again or contact the shop.',
    }
  }
  if (isAppPayUBridgeUrl(input.checkoutUrl)) {
    return { kind: 'payu_bridge', href: toInAppPayUHref(input.checkoutUrl) }
  }
  return { kind: 'external_pay', url: input.checkoutUrl }
}
