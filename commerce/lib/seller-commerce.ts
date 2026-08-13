import { supabase } from '~/lib/supabase/client'

/**
 * Seller-facing payment + delivery setup.
 * - SHEPay = PayU split collection (0% SHEconomy commission).
 * - Shipping = vendor books and dispatches with their own courier (no managed SHEDelivery).
 */
export type ShopCommerceForm = {
  /** true = SHEPay (PayU split); false = seller's own gateway. */
  paymentManaged: boolean
  paymentGateway: string
  paymentAccountLabel: string
  paymentKeyId: string
  /** Vendor's courier partner for display (always self-ship). */
  shippingPartner: string
  shippingAccountLabel: string
}

export type CommerceOption = { value: string; label: string; hint?: string }

export const PAYMENT_GATEWAY_OPTIONS: CommerceOption[] = [
  { value: 'payu', label: 'PayU (SHEPay split)' },
]

export const SHIPPING_PARTNER_OPTIONS: CommerceOption[] = [
  { value: 'self', label: 'Self / own courier' },
  { value: 'shiprocket', label: 'Shiprocket' },
  { value: 'delhivery', label: 'Delhivery' },
  { value: 'bluedart', label: 'BlueDart' },
  { value: 'dtdc', label: 'DTDC' },
  { value: 'xpressbees', label: 'Xpressbees' },
  { value: 'pickrr', label: 'Pickrr' },
]

export const DEFAULT_COMMERCE_FORM: ShopCommerceForm = {
  paymentManaged: true,
  paymentGateway: 'payu',
  paymentAccountLabel: '',
  paymentKeyId: '',
  shippingPartner: 'self',
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
  // Legacy shedelivery / unconnected → treat as self-ship.
  const partner =
    row.shipping_partner ||
    (row.shipping_mode === 'shedelivery' ? 'self' : null) ||
    DEFAULT_COMMERCE_FORM.shippingPartner
  return {
    paymentManaged,
    paymentGateway: row.payment_gateway || DEFAULT_COMMERCE_FORM.paymentGateway,
    paymentAccountLabel: row.payment_account_label ?? '',
    paymentKeyId: row.payment_gateway_key_id ?? '',
    shippingPartner: partner === 'shedelivery' ? 'self' : partner,
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
  const partner = form.shippingPartner.trim() || 'self'
  const payload = {
    shop_id: shopId,
    payment_connected: !form.paymentManaged,
    payment_mode: form.paymentManaged ? 'shepay' : 'direct',
    payment_gateway: form.paymentManaged ? null : form.paymentGateway,
    payment_account_label: form.paymentManaged ? null : form.paymentAccountLabel.trim() || null,
    payment_gateway_key_id: form.paymentManaged ? null : form.paymentKeyId.trim() || null,
    // Always vendor self-ship — never shedelivery managed mode.
    shipping_connected: true,
    shipping_mode: 'partner',
    shipping_partner: partner,
    shipping_account_label: form.shippingAccountLabel.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shop_commerce_settings')
    .upsert(payload, { onConflict: 'shop_id' })

  return { error: error ? error.message : null }
}
