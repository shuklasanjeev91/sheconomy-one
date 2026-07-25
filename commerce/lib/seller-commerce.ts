import { supabase } from '~/lib/supabase/client'

/**
 * Seller-facing view of a shop's payment + delivery setup. Under SHEconomy's
 * 0-commission model a seller either:
 *  - connects their own gateway/courier (buyers pay them directly, no commission), or
 *  - uses SHEPay / SHEDelivery (SHEconomy collects/ships and charges a commission).
 */
export type ShopCommerceForm = {
  /** true = SHEPay (managed by SHEconomy); false = seller's own gateway. */
  paymentManaged: boolean
  paymentGateway: string
  paymentAccountLabel: string
  paymentKeyId: string
  /** true = SHEDelivery (managed); false = seller's own courier. */
  shippingManaged: boolean
  shippingPartner: string
  shippingAccountLabel: string
}

export type CommerceOption = { value: string; label: string; hint?: string }

export const PAYMENT_GATEWAY_OPTIONS: CommerceOption[] = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'payu', label: 'PayU' },
  { value: 'cashfree', label: 'Cashfree' },
  { value: 'paytm', label: 'Paytm' },
  { value: 'phonepe', label: 'PhonePe' },
]

export const SHIPPING_PARTNER_OPTIONS: CommerceOption[] = [
  { value: 'shiprocket', label: 'Shiprocket' },
  { value: 'delhivery', label: 'Delhivery' },
  { value: 'bluedart', label: 'BlueDart' },
  { value: 'pickrr', label: 'Pickrr' },
  { value: 'self', label: 'Self / own courier' },
]

export const DEFAULT_COMMERCE_FORM: ShopCommerceForm = {
  paymentManaged: true,
  paymentGateway: 'razorpay',
  paymentAccountLabel: '',
  paymentKeyId: '',
  shippingManaged: true,
  shippingPartner: 'shiprocket',
  shippingAccountLabel: '',
}

type CommerceSettingsRow = {
  payment_mode: string | null
  payment_gateway: string | null
  payment_account_label: string | null
  payment_gateway_key_id: string | null
  payment_connected: boolean | null
  shipping_mode: string | null
  shipping_partner: string | null
  shipping_account_label: string | null
  shipping_connected: boolean | null
}

function rowToForm(row: CommerceSettingsRow | null): ShopCommerceForm {
  if (!row) return { ...DEFAULT_COMMERCE_FORM }
  const paymentManaged = !(row.payment_connected && row.payment_gateway)
  const shippingManaged = !(row.shipping_connected && row.shipping_partner)
  return {
    paymentManaged,
    paymentGateway: row.payment_gateway || DEFAULT_COMMERCE_FORM.paymentGateway,
    paymentAccountLabel: row.payment_account_label ?? '',
    paymentKeyId: row.payment_gateway_key_id ?? '',
    shippingManaged,
    shippingPartner: row.shipping_partner || DEFAULT_COMMERCE_FORM.shippingPartner,
    shippingAccountLabel: row.shipping_account_label ?? '',
  }
}

/** Load a shop's current commerce setup for editing (owner only). */
export async function fetchShopCommerceForm(
  shopId: string,
): Promise<{ form: ShopCommerceForm; error: string | null }> {
  const { data, error } = await supabase
    .from('shop_commerce_settings')
    .select(
      'payment_mode, payment_gateway, payment_account_label, payment_gateway_key_id, payment_connected, shipping_mode, shipping_partner, shipping_account_label, shipping_connected',
    )
    .eq('shop_id', shopId)
    .maybeSingle()

  if (error) {
    return { form: { ...DEFAULT_COMMERCE_FORM }, error: error.message }
  }
  return { form: rowToForm(data as CommerceSettingsRow | null), error: null }
}

/** Persist a shop's payment + delivery setup (RLS restricts this to the owner). */
export async function saveShopCommerceForm(
  shopId: string,
  form: ShopCommerceForm,
): Promise<{ error: string | null }> {
  const payload = {
    shop_id: shopId,
    payment_connected: !form.paymentManaged,
    payment_mode: form.paymentManaged ? 'shepay' : 'direct',
    payment_gateway: form.paymentManaged ? null : form.paymentGateway,
    payment_account_label: form.paymentManaged ? null : form.paymentAccountLabel.trim() || null,
    payment_gateway_key_id: form.paymentManaged ? null : form.paymentKeyId.trim() || null,
    shipping_connected: !form.shippingManaged,
    shipping_mode: form.shippingManaged ? 'shedelivery' : 'partner',
    shipping_partner: form.shippingManaged ? null : form.shippingPartner,
    shipping_account_label: form.shippingManaged ? null : form.shippingAccountLabel.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shop_commerce_settings')
    .upsert(payload, { onConflict: 'shop_id' })

  return { error: error ? error.message : null }
}
