import { supabase } from '~/lib/supabase/client'

/** Resolved payment + shipping partner display info for one shop. */
export type ShopPartnerInfo = {
  shopId: string
  paymentLabel: string
  paymentConnected: boolean
  shippingLabel: string
  shippingConnected: boolean
}

type CommerceSettingsRow = {
  shop_id: string
  payment_mode: string | null
  payment_gateway: string | null
  payment_account_label: string | null
  payment_connected: boolean | null
  shipping_mode: string | null
  shipping_partner: string | null
  shipping_account_label: string | null
  shipping_connected: boolean | null
}

const PAYMENT_LABELS: Record<string, string> = {
  shepay: 'SHEPay',
  razorpay: 'Razorpay',
  stripe: 'Stripe',
  payu: 'SHEPay',
  cashfree: 'Cashfree',
  breeze: 'Breeze',
  paytm: 'Paytm',
  phonepe: 'PhonePe',
}

const SHIPPING_LABELS: Record<string, string> = {
  shedelivery: 'Seller ships',
  shiprocket: 'Shiprocket',
  pickrr: 'Pickrr',
  delhivery: 'Delhivery',
  bluedart: 'BlueDart',
  dtdc: 'DTDC',
  xpressbees: 'Xpressbees',
  own: 'Seller ships',
  self: 'Seller ships',
  partner: 'Seller ships',
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function labelFor(map: Record<string, string>, key: string | null | undefined): string | null {
  if (!key) return null
  const normalized = key.trim().toLowerCase()
  if (!normalized) return null
  return map[normalized] ?? titleCase(normalized)
}

/** Platform defaults when a shop hasn't connected its own partners. */
const DEFAULT_PARTNERS = {
  paymentLabel: 'SHEPay',
  shippingLabel: 'Seller ships',
}

function resolvePartner(row: CommerceSettingsRow): ShopPartnerInfo {
  const paymentConnected = !!row.payment_connected && !!row.payment_gateway
  const paymentLabel = paymentConnected
    ? labelFor(PAYMENT_LABELS, row.payment_gateway) ??
      row.payment_account_label ??
      DEFAULT_PARTNERS.paymentLabel
    : labelFor(PAYMENT_LABELS, row.payment_mode) ?? DEFAULT_PARTNERS.paymentLabel

  const shippingConnected = !!row.shipping_connected && !!row.shipping_partner
  const shippingLabel = shippingConnected
    ? labelFor(SHIPPING_LABELS, row.shipping_partner) ??
      row.shipping_account_label ??
      DEFAULT_PARTNERS.shippingLabel
    : labelFor(SHIPPING_LABELS, row.shipping_mode) ?? DEFAULT_PARTNERS.shippingLabel

  return {
    shopId: row.shop_id,
    paymentLabel,
    paymentConnected,
    shippingLabel,
    shippingConnected,
  }
}

/** Identity for a shop's (shipping, payment) partner combination. */
export function partnerComboKey(info: ShopPartnerInfo): string {
  return `${info.shippingLabel}__${info.paymentLabel}`
}

/**
 * Who collects the buyer's payment for a shop.
 * Marketplace checkout always uses SHEPay (platform collect + Automate split).
 * Own-gateway / direct routing has been removed.
 */
export type PaymentCollection = 'direct' | 'shepay'

export function paymentCollectionFor(_info: ShopPartnerInfo | undefined): PaymentCollection {
  return 'shepay'
}

/** True when a shop has a connected PayU/SHEPay child merchant for Automate splits. */
export async function fetchShepayReadyShopIds(shopIds: string[]): Promise<{
  ready: Set<string>
  missing: string[]
}> {
  const unique = [...new Set(shopIds.filter(Boolean))]
  const ready = new Set<string>()
  if (!unique.length) return { ready, missing: [] }

  const { data } = await supabase
    .from('shop_payment_accounts')
    .select('shop_id, provider, status, metadata')
    .in('shop_id', unique)
    .eq('provider', 'payu')
    .eq('status', 'connected')

  for (const row of data ?? []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {}
    const childKey =
      (typeof meta.child_merchant_key === 'string' && meta.child_merchant_key.trim()) ||
      (meta.onboarded_via === 'sheconomy' && typeof meta.merchant_key === 'string'
        ? meta.merchant_key.trim()
        : '')
    const childMid = typeof meta.child_mid === 'string' && meta.child_mid.trim()
    // Child key + MID required so Automate split + release_settlement can run after capture.
    if (childKey && childMid && row.shop_id) ready.add(String(row.shop_id))
  }

  return {
    ready,
    missing: unique.filter((id) => !ready.has(id)),
  }
}

/**
 * True when every shop shares the same shipping + payment partner, meaning the
 * order can be placed together instead of split into shop-wise orders.
 */
export function arePartnersUniform(partners: Iterable<ShopPartnerInfo>): boolean {
  const keys = new Set<string>()
  for (const info of partners) keys.add(partnerComboKey(info))
  return keys.size <= 1
}

/**
 * Fetch each shop's payment gateway and shipping partner (shop-wise). Shops
 * without an explicit setting fall back to the platform defaults (SHEPay /
 * Seller ships). Only non-sensitive display fields are read.
 */
export async function fetchShopCommerceSettings(
  shopIds: string[],
): Promise<Map<string, ShopPartnerInfo>> {
  const result = new Map<string, ShopPartnerInfo>()
  const unique = [...new Set(shopIds.filter(Boolean))]
  if (unique.length === 0) return result

  const { data, error } = await supabase
    .from('shop_commerce_settings')
    .select(
      'shop_id, payment_mode, payment_gateway, payment_account_label, payment_connected, shipping_mode, shipping_partner, shipping_account_label, shipping_connected',
    )
    .in('shop_id', unique)

  if (!error && data) {
    for (const row of data as CommerceSettingsRow[]) {
      result.set(row.shop_id, resolvePartner(row))
    }
  }

  // Fill defaults for any shop without a settings row (or on read failure).
  for (const shopId of unique) {
    if (!result.has(shopId)) {
      result.set(shopId, {
        shopId,
        paymentLabel: DEFAULT_PARTNERS.paymentLabel,
        paymentConnected: false,
        shippingLabel: DEFAULT_PARTNERS.shippingLabel,
        shippingConnected: false,
      })
    }
  }

  return result
}
