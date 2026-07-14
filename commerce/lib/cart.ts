import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from '~/lib/supabase/client'
import type { Json, Tables } from '~/lib/supabase'

const CART_SESSION_KEY = 'sheconomy:cart-session'

export type CartRow = Tables<'carts'>
export type CartItemRow = Tables<'cart_items'>

export type CartWithItems = {
  cart: CartRow
  items: CartItemRow[]
}

async function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function getCartSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(CART_SESSION_KEY)
  if (existing) return existing

  const sessionId = await createSessionId()
  await AsyncStorage.setItem(CART_SESSION_KEY, sessionId)
  return sessionId
}

export async function getOrCreateCart(options: {
  userId?: string | null
  sessionId?: string | null
}): Promise<{ cart: CartRow | null; error: string | null }> {
  const sessionId = options.sessionId ?? (options.userId ? null : await getCartSessionId())

  const { data, error } = await supabase.rpc('get_or_create_cart', {
    p_user_id: options.userId ?? undefined,
    p_session_id: sessionId ?? undefined,
  })

  if (error) {
    return { cart: null, error: error.message }
  }

  return { cart: data, error: null }
}

export async function fetchCartItems(cartId: string): Promise<{
  items: CartItemRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true })

  if (error) {
    return { items: [], error: error.message }
  }

  return { items: data ?? [], error: null }
}

export async function fetchCartWithItems(cartId: string): Promise<{
  data: CartWithItems | null
  error: string | null
}> {
  const [cartResult, itemsResult] = await Promise.all([
    supabase.from('carts').select('*').eq('id', cartId).maybeSingle(),
    fetchCartItems(cartId),
  ])

  if (cartResult.error) {
    return { data: null, error: cartResult.error.message }
  }

  if (!cartResult.data) {
    return { data: null, error: 'Cart not found' }
  }

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error }
  }

  return {
    data: { cart: cartResult.data, items: itemsResult.items },
    error: null,
  }
}

export async function addListingToCart(options: {
  cartId: string
  listingId: string
  quantity?: number
  variantId?: string | null
}): Promise<{ item: CartItemRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('add_to_cart', {
    p_cart_id: options.cartId,
    p_listing_id: options.listingId,
    p_quantity: options.quantity ?? 1,
    p_variant_id: options.variantId ?? undefined,
  })

  if (error) {
    return { item: null, error: error.message }
  }

  await supabase.rpc('update_cart_totals', { p_cart_id: options.cartId })
  await recordCartAddAnalytics({
    cartId: options.cartId,
    listingId: options.listingId,
    quantity: options.quantity ?? 1,
    variantId: options.variantId ?? null,
  })
  return { item: data, error: null }
}

async function recordCartAddAnalytics(options: {
  cartId: string
  listingId: string
  quantity: number
  variantId: string | null
}) {
  const { data } = await supabase
    .from('carts')
    .select('cart_metadata, user_id, session_id')
    .eq('id', options.cartId)
    .maybeSingle()

  if (!data) return

  const currentMetadata =
    data.cart_metadata && typeof data.cart_metadata === 'object' && !Array.isArray(data.cart_metadata)
      ? (data.cart_metadata as Record<string, unknown>)
      : {}

  const analytics =
    currentMetadata.analytics && typeof currentMetadata.analytics === 'object' && !Array.isArray(currentMetadata.analytics)
      ? (currentMetadata.analytics as Record<string, unknown>)
      : {}

  const addCount = Number(analytics.add_count ?? 0) + 1
  const quantityAdded = Number(analytics.quantity_added ?? 0) + options.quantity

  await supabase
    .from('carts')
    .update({
      cart_metadata: {
        ...currentMetadata,
        analytics: {
          ...analytics,
          add_count: addCount,
          quantity_added: quantityAdded,
          last_added_at: new Date().toISOString(),
          last_added_listing_id: options.listingId,
          last_added_variant_id: options.variantId,
          last_actor_type: data.user_id ? 'user' : 'guest',
          last_session_id: data.session_id,
          last_user_id: data.user_id,
        },
      } as Json,
    })
    .eq('id', options.cartId)
}

export async function updateCartItemQuantity(
  cartId: string,
  cartItemId: string,
  quantity: number,
): Promise<{ error: string | null }> {
  if (quantity <= 0) {
    return removeCartItem(cartId, cartItemId)
  }

  const { error } = await supabase
    .from('cart_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', cartItemId)
    .eq('cart_id', cartId)

  if (error) {
    return { error: error.message }
  }

  await supabase.rpc('update_cart_totals', { p_cart_id: cartId })
  return { error: null }
}

export async function removeCartItem(
  cartId: string,
  cartItemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('cart_id', cartId)

  if (error) {
    return { error: error.message }
  }

  await supabase.rpc('update_cart_totals', { p_cart_id: cartId })
  return { error: null }
}

export async function mergeGuestCartWithUser(options: {
  sessionId: string
  userId: string
}): Promise<{ cart: CartRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('merge_carts', {
    p_session_id: options.sessionId,
    p_user_id: options.userId,
  })

  if (error) {
    return { cart: null, error: error.message }
  }

  return { cart: data, error: null }
}
