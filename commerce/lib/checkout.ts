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

/** Payment modes exposed at checkout (subset of payment_mode_enum). */
export type CheckoutPaymentMode = 'online' | 'cod'

export type CheckoutLineItem = {
  listingId: string
  quantity: number
  unitPrice: number
  variationDetails?: Record<string, unknown> | null
}

/**
 * How this order's payment is collected under SHEconomy's 0-commission model.
 * `direct` = paid straight to the seller's own gateway (no commission);
 * `shepay` = collected by SHEconomy/SHEPay (commission billed to the seller).
 */
export type PaymentRouting = {
  collection: 'direct' | 'shepay'
  gateway?: string | null
  shopId?: string | null
  commissionApplies: boolean
}

export type CheckoutInput = {
  userId: string
  cartId: string
  shippingAddressId: string
  billingAddressId?: string
  customerNotes?: string
  paymentMode: CheckoutPaymentMode
  savedPaymentMethodId?: string
  currency: string
  items: CheckoutLineItem[]
  subtotalAmount: number
  discountAmount?: number
  shippingAmount?: number
  totalAmount: number
  /** Order-level coupon applied to this order, if any. */
  discount?: {
    profileId?: string | null
    name?: string | null
    type?: string | null
  } | null
  /** Payment collection/settlement routing for this shop's order. */
  paymentRouting?: PaymentRouting | null
  /** Marks the order as a gift (buyer-facing gifting flow). */
  isGift?: boolean
}

export type CheckoutResult = {
  orderId?: string
  orderNumber?: string
  checkoutUrl?: string | null
  raw: unknown
}

export type {
  AtomicCheckoutResult,
  CheckoutPaymentStep,
} from '~/commerce/lib/checkout-utils'
export {
  firstCheckoutUrlFromSteps,
  parseAtomicCheckoutPayload,
} from '~/commerce/lib/checkout-utils'

import {
  parseAtomicCheckoutPayload,
  type AtomicCheckoutResult,
} from '~/commerce/lib/checkout-utils'

/**
 * Creates every selected shop order in one database transaction. Pricing,
 * coupon eligibility, ownership, and inventory are re-derived while rows are
 * locked by the server.
 */
export async function createAtomicMarketplaceCheckout(input: {
  cartId: string
  cartItemIds: string[]
  shippingAddressId: string
  billingAddressId?: string | null
  paymentMode: CheckoutPaymentMode
  idempotencyKey: string
  notesByShop?: Record<string, string>
  giftShopIds?: string[]
  /** Shopper's display/settlement currency (e.g. INR). */
  customerCurrency?: string
  /** Per-shop converted totals in customer currency for order records. */
  customerAmountsByShop?: Record<
    string,
    {
      subtotal_amount: number
      shipping_amount: number
      discount_amount: number
      total_amount: number
    }
  >
}): Promise<{ data: AtomicCheckoutResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('atomic_marketplace_checkout' as never, {
    p_cart_id: input.cartId,
    p_cart_item_ids: input.cartItemIds,
    p_shipping_address_id: input.shippingAddressId,
    p_billing_address_id: input.billingAddressId ?? input.shippingAddressId,
    p_payment_mode: input.paymentMode,
    p_idempotency_key: input.idempotencyKey,
    p_notes_by_shop: input.notesByShop ?? {},
    p_gift_shop_ids: input.giftShopIds ?? [],
    p_customer_currency: input.customerCurrency ?? null,
    p_customer_amounts_by_shop: input.customerAmountsByShop ?? {},
  } as never)

  if (error) return { data: null, error: error.message }
  return parseAtomicCheckoutPayload(data as Record<string, unknown> | null)
}

export async function resumeCheckoutPayment(checkoutGroupId: string) {
  return supabase.rpc('resume_checkout_payment' as never, {
    p_checkout_group_id: checkoutGroupId,
  } as never)
}

export async function cancelCheckoutPayment(checkoutGroupId: string) {
  return supabase.rpc('cancel_checkout_payment' as never, {
    p_checkout_group_id: checkoutGroupId,
  } as never)
}

export async function createOrderFromCart(
  input: CheckoutInput,
): Promise<{ data: CheckoutResult | null; error: string | null }> {
  const discountAmount = input.discountAmount ?? 0
  const shippingAmount = input.shippingAmount ?? 0

  const orderData: Record<string, unknown> = {
    user_id: input.userId,
    cart_items: input.items.map((item) => ({
      listing_id: item.listingId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      variation_details: item.variationDetails ?? {},
    })),
    shipping_address_id: input.shippingAddressId,
    billing_address_id: input.billingAddressId ?? input.shippingAddressId,
    customer_notes: buildCheckoutNotes(input),
    payment_mode: input.paymentMode,
    currency: input.currency,
    subtotal_amount: input.subtotalAmount,
    shipping_amount: shippingAmount,
    tax_amount: 0,
    discount_amount: discountAmount,
    total_amount: input.totalAmount,
    order_source: 'sheconomy-one',
  }

  const orderMetadata: Record<string, unknown> = { created_via: 'sheconomy-one-checkout' }

  if (input.discount && discountAmount > 0) {
    orderData.discount_codes = [input.discount.name].filter(Boolean)
    orderMetadata.discount_info = {
      total_discount: discountAmount,
      discount_profile_id: input.discount.profileId ?? null,
      discount_name: input.discount.name ?? null,
      discount_type: input.discount.type ?? null,
    }
  }

  if (input.paymentRouting) {
    orderMetadata.payment_routing = {
      collection: input.paymentRouting.collection,
      gateway: input.paymentRouting.gateway ?? null,
      shop_id: input.paymentRouting.shopId ?? null,
      commission_applies: input.paymentRouting.commissionApplies,
    }
  }

  if (input.isGift) {
    orderMetadata.gift = { is_gift: true, message: input.customerNotes?.trim() || null }
  }

  orderData.order_metadata = orderMetadata

  const { data, error } = await supabase.rpc('create_customer_order', {
    order_data: orderData as never,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const payload = (data ?? {}) as Record<string, unknown>
  if (payload.success === false) {
    return {
      data: null,
      error: typeof payload.message === 'string' ? payload.message : 'Order creation failed',
    }
  }

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

export type StockIssue = {
  listingId: string
  title: string
  available: number
  requested: number
}

/**
 * Pre-flight stock check that mirrors the `create_customer_order` RPC (which
 * validates requested quantity against `listings.quantity`). Run this before
 * placing any order so a multi-shop checkout never creates some orders and then
 * fails midway on an out-of-stock item.
 */
export async function checkCartStock(
  items: { listingId: string; quantity: number }[],
): Promise<{ issues: StockIssue[]; error: string | null }> {
  const requested = new Map<string, number>()
  for (const item of items) {
    requested.set(item.listingId, (requested.get(item.listingId) ?? 0) + item.quantity)
  }
  const ids = [...requested.keys()]
  if (ids.length === 0) return { issues: [], error: null }

  const { data, error } = await supabase
    .from('listings')
    .select('id, title, quantity')
    .in('id', ids)

  if (error) return { issues: [], error: error.message }

  const issues: StockIssue[] = []
  for (const row of data ?? []) {
    const available = typeof row.quantity === 'number' ? row.quantity : null
    if (available === null) continue // null = untracked/unlimited stock
    const req = requested.get(row.id) ?? 0
    if (req > available) {
      issues.push({ listingId: row.id, title: row.title ?? 'Item', available, requested: req })
    }
  }
  return { issues, error: null }
}

function buildCheckoutNotes(input: CheckoutInput): string | null {
  const parts = [
    input.customerNotes?.trim(),
    input.savedPaymentMethodId ? `saved_payment_method_id:${input.savedPaymentMethodId}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join('\n') : null
}
