import {
  createUserAddress,
  fetchUserAddresses,
  type AddressInput,
  type UserAddress,
} from '~/commerce/lib/addresses'
import { supabase } from '~/lib/supabase/client'

export type { AddressInput, UserAddress }
export type CheckoutAddressInput = AddressInput

export { fetchUserAddresses }

export async function saveUserAddress(userId: string, input: AddressInput) {
  return createUserAddress(userId, input)
}

export type CheckoutInput = {
  cartId: string
  shippingAddressId: string
  billingAddressId?: string
  customerNotes?: string
  paymentMethod?: 'online' | 'cod'
  savedPaymentMethodId?: string
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
    customer_notes: buildCheckoutNotes(input),
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

function buildCheckoutNotes(input: CheckoutInput): string | null {
  const parts = [input.customerNotes?.trim(), input.savedPaymentMethodId
    ? `saved_payment_method_id:${input.savedPaymentMethodId}`
    : null].filter(Boolean)
  return parts.length ? parts.join('\n') : null
}
