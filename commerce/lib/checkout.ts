import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type UserAddress = {
  id: string
  address_label: string
  address_line_1: string
  address_line_2: string
  address_type: string
  city: string
  country: string
  is_default: boolean
  postal_code: string
  state: string
}

export type CheckoutAddressInput = {
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country?: string
  address_label?: string
}

export async function fetchUserAddresses(userId?: string): Promise<{
  addresses: UserAddress[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('get_user_addresses', {
    target_user_id: userId,
  })

  if (error) {
    return { addresses: [], error: error.message }
  }

  return { addresses: data ?? [], error: null }
}

export async function saveUserAddress(
  userId: string,
  input: CheckoutAddressInput,
): Promise<{ address: Tables<'addresses'> | null; error: string | null }> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      address_line_1: input.address_line_1,
      address_line_2: input.address_line_2 ?? null,
      city: input.city,
      state: input.state,
      postal_code: input.postal_code,
      country: input.country ?? 'IN',
      address_label: input.address_label ?? 'Home',
      address_type: 'shipping',
      is_default: false,
    })
    .select('*')
    .single()

  if (error) {
    return { address: null, error: error.message }
  }

  return { address: data, error: null }
}

export type CheckoutInput = {
  cartId: string
  shippingAddressId: string
  billingAddressId?: string
  customerNotes?: string
  paymentMethod?: 'online' | 'cod'
}

export type CheckoutResult = {
  orderId?: string
  orderNumber?: string
  checkoutUrl?: string | null
  raw: unknown
}

export async function createOrderFromCart(
  input: CheckoutInput,
): Promise<{ data: CheckoutResult | null; error: string | null }> {
  const orderData = {
    cart_id: input.cartId,
    shipping_address_id: input.shippingAddressId,
    billing_address_id: input.billingAddressId ?? input.shippingAddressId,
    customer_notes: input.customerNotes ?? null,
    payment_method: input.paymentMethod ?? 'online',
    order_source: 'sheconomy-one',
  }

  const { data, error } = await supabase.rpc('create_customer_order', {
    order_data: orderData,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const payload = (data ?? {}) as Record<string, unknown>
  return {
    data: {
      orderId: typeof payload.order_id === 'string' ? payload.order_id : undefined,
      orderNumber:
        typeof payload.order_number === 'string' ? payload.order_number : undefined,
      checkoutUrl:
        typeof payload.checkout_url === 'string' ? payload.checkout_url : null,
      raw: data,
    },
    error: null,
  }
}
