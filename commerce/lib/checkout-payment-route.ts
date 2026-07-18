/**
 * Checkout payment UX helpers: partner-aware copy + post-place-order routing
 * (SHEPay → PayU Hosted bridge vs seller-direct gateway).
 */

/** Amazon-style instruments shown on checkout (SHEPay → PayU `pg`). */
export type CheckoutPaymentInstrument = 'upi' | 'card' | 'netbanking' | 'wallet'

export const CHECKOUT_PAYMENT_INSTRUMENTS: ReadonlyArray<{
  id: CheckoutPaymentInstrument
  title: string
  subtitle: string
  /** PayU `_payment` `pg` value for Hosted / preferred mode. */
  payuPg: string
}> = [
  {
    id: 'upi',
    title: 'UPI',
    subtitle: 'Google Pay, PhonePe, Paytm & other UPI apps',
    payuPg: 'UPI',
  },
  {
    id: 'card',
    title: 'Credit / Debit card',
    subtitle: 'Visa, Mastercard, RuPay & more',
    payuPg: 'CC',
  },
  {
    id: 'netbanking',
    title: 'Net banking',
    subtitle: 'All major banks',
    payuPg: 'NB',
  },
  {
    id: 'wallet',
    title: 'Wallets',
    subtitle: 'Paytm, Amazon Pay & other wallets',
    payuPg: 'CASH',
  },
]

export function payuPgForInstrument(instrument: CheckoutPaymentInstrument): string {
  return CHECKOUT_PAYMENT_INSTRUMENTS.find((row) => row.id === instrument)?.payuPg ?? 'CC'
}

export type OnlinePaymentCopy = {
  title: string
  subtitle: string
}

export type DirectPaymentShop = {
  shopId: string
  shopName: string
  gateway: string
}

/** Buyer-facing online radio label from who collects payment (seller-direct only carts). */
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
      title: 'Pay online with SHEPay',
      subtitle: "You'll complete payment securely on PayU",
    }
  }

  return {
    title: 'Pay online',
    subtitle: 'SHEPay (PayU) for some shops · pay other sellers via their own gateway',
  }
}

/**
 * Show Amazon-style UPI / card / NB / wallet when SHEPay is in the cart
 * (or when there is no seller-direct-only path).
 */
export function shouldShowCheckoutInstruments(input: {
  shepayShops: unknown[]
  directShops: unknown[]
}): boolean {
  return input.shepayShops.length > 0
}

/** Shipping line for a shop: connected partner label or SHEDelivery default. */
export function checkoutShippingLabel(info: {
  shippingLabel?: string | null
  shippingConnected?: boolean
} | null | undefined): string {
  const label = info?.shippingLabel?.trim()
  if (label) return label
  return 'SHEDelivery'
}

export type PostCheckoutNext =
  | { kind: 'payu_bridge'; href: string }
  | { kind: 'external_pay'; url: string }
  | { kind: 'success' }
  | { kind: 'cancel_and_stay'; error: string }

/** True when URL points at our in-app PayU form-POST bridge. */
export function isAppPayUBridgeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://sheconomy.local')
    return /\/orders\/payu\/?$/.test(parsed.pathname) || parsed.pathname.includes('/orders/payu')
  } catch {
    return url.includes('/orders/payu')
  }
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
 */
export function resolvePostCheckoutNext(input: {
  mode: 'online' | 'cod'
  checkoutUrl: string | null
  shepayError: string | null
  hasShepaySteps: boolean
}): PostCheckoutNext {
  if (input.mode === 'cod') return { kind: 'success' }

  if (input.hasShepaySteps) {
    if (input.shepayError || !input.checkoutUrl) {
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
      error: 'Seller payment link is not ready. Please try again or contact the shop.',
    }
  }
  if (isAppPayUBridgeUrl(input.checkoutUrl)) {
    return { kind: 'payu_bridge', href: toInAppPayUHref(input.checkoutUrl) }
  }
  return { kind: 'external_pay', url: input.checkoutUrl }
}
