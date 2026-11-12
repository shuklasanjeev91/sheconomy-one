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

/** Buyer/seller display labels — never surface provider brand names. */
const DEFAULT_PARTNERS = {
  paymentLabel: 'Secure online payment',
  shippingLabel: 'Tracked shipping',
}

function resolvePartner(row: CommerceSettingsRow): ShopPartnerInfo {
  return {
    shopId: row.shop_id,
    paymentLabel: DEFAULT_PARTNERS.paymentLabel,
    paymentConnected: false,
    shippingLabel: DEFAULT_PARTNERS.shippingLabel,
    shippingConnected: true,
  }
}

/** Identity for a shop's (shipping, payment) partner combination. */
export function partnerComboKey(info: ShopPartnerInfo): string {
  return `${info.shippingLabel}__${info.paymentLabel}`
}

/**
 * Who collects the buyer's payment for a shop.
 * Marketplace checkout always uses SHEPay (platform collect + PayU split).
 */
export type PaymentCollection = 'direct' | 'shepay'

export function paymentCollectionFor(_info: ShopPartnerInfo | undefined): PaymentCollection {
  return 'shepay'
}

/** True when a shop has a connected PayU/SHEPay child merchant or verified PayU KYC. */
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
    if (childKey && childMid && row.shop_id) ready.add(String(row.shop_id))
  }

  // Also treat shops with PayU-verified KYC as ready.
  const { data: kycRows } = await supabase
    .from('shop_payu_kyc' as never)
    .select('shop_id, status')
    .in('shop_id' as never, unique)
    .eq('status' as never, 'payu_verified')

  for (const row of (kycRows as Array<{ shop_id?: string }> | null) ?? []) {
    if (row.shop_id) ready.add(String(row.shop_id))
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
 * Fetch each shop's payment gateway and shipping partner (shop-wise).
 * Commerce surfaces SHEPay + platform shipping labels.
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

  for (const shopId of unique) {
    if (!result.has(shopId)) {
      result.set(shopId, {
        shopId,
        paymentLabel: DEFAULT_PARTNERS.paymentLabel,
        paymentConnected: false,
        shippingLabel: DEFAULT_PARTNERS.shippingLabel,
        shippingConnected: true,
      })
    }
  }

  return result
}
