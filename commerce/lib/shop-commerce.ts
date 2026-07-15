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
  payu: 'PayU',
  cashfree: 'Cashfree',
  breeze: 'Breeze',
  paytm: 'Paytm',
  phonepe: 'PhonePe',
}

const SHIPPING_LABELS: Record<string, string> = {
  shedelivery: 'SHEDelivery',
  shiprocket: 'Shiprocket',
  pickrr: 'Pickrr',
  delhivery: 'Delhivery',
  bluedart: 'BlueDart',
  own: 'Seller shipping',
  self: 'Seller shipping',
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
  shippingLabel: 'SHEDelivery',
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
 * Who collects the buyer's payment for a shop, under SHEconomy's 0-commission model:
 * - `direct`: the seller connected their own gateway (e.g. Razorpay). Funds go
 *   straight to the seller's bank and SHEconomy charges no commission.
 * - `shepay`: the seller uses SHEPay/SHEDelivery. SHEconomy collects the payment
 *   and charges a commission (billed to the seller, invisible to the buyer).
 */
export type PaymentCollection = 'direct' | 'shepay'

export function paymentCollectionFor(info: ShopPartnerInfo | undefined): PaymentCollection {
  return info?.paymentConnected ? 'direct' : 'shepay'
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
 * SHEDelivery). Only non-sensitive display fields are read.
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
