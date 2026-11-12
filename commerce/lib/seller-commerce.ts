import { supabase } from '~/lib/supabase/client'

/**
 * Seller-facing payment + delivery setup.
 * - SHEPay (PayU) = platform collect + split payouts (0% SHEconomy commission on item price).
 * - Shipping = Easyship labels via shipping credit only.
 */
export type ShopCommerceForm = {
  /** Always true — marketplace commerce collects via SHEPay (PayU). */
  paymentManaged: boolean
  paymentGateway: string
  paymentAccountLabel: string
  paymentKeyId: string
  /** Always easyship for commerce fulfill. */
  shippingPartner: string
  shippingAccountLabel: string
}

export type CommerceOption = { value: string; label: string; hint?: string }

export const PAYMENT_GATEWAY_OPTIONS: CommerceOption[] = [
  { value: 'payu', label: 'SHEPay (PayU split payouts)' },
]

export const SHIPPING_PARTNER_OPTIONS: CommerceOption[] = [
  { value: 'easyship', label: 'Platform shipping labels' },
]

export const DEFAULT_COMMERCE_FORM: ShopCommerceForm = {
  paymentManaged: true,
  paymentGateway: 'payu',
  paymentAccountLabel: '',
  paymentKeyId: '',
  shippingPartner: 'easyship',
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
  return {
    paymentManaged: true,
    paymentGateway: 'payu',
    paymentAccountLabel: '',
    paymentKeyId: '',
    shippingPartner: 'easyship',
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
    payment_connected: false,
    payment_mode: 'payu',
    payment_gateway: 'payu',
    payment_account_label: null,
    payment_gateway_key_id: null,
    shipping_connected: true,
    shipping_mode: 'easyship',
    shipping_partner: 'easyship',
    shipping_account_label: form.shippingAccountLabel.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shop_commerce_settings')
    .upsert(payload, { onConflict: 'shop_id' })

  return { error: error ? error.message : null }
}
