import AsyncStorage from '@react-native-async-storage/async-storage'

import { fetchAddToCart, fetchGetOrCreateCart } from '~/commerce/lib/cart-rpc-fetch'
import { supabase } from '~/lib/supabase/client'
import type { Json, Tables } from '~/lib/supabase'
import { splitCartItems } from '~/commerce/lib/cart-shelf'

const CART_SESSION_KEY = 'sheconomy:cart-session'
const GUEST_CART_ID_KEY = 'sheconomy:guest-cart-id'
/** AsyncStorage can hang on some iPadOS builds — never block Add to Cart on it. */
const CART_SESSION_STORAGE_TIMEOUT_MS = 2_500

export type CartRow = Tables<'carts'>
export type CartItemRow = Tables<'cart_items'>

export type CartWithItems = {
  cart: CartRow
  items: CartItemRow[]
  savedItems: CartItemRow[]
}

export { splitCartItems } from '~/commerce/lib/cart-shelf'

/** In-memory fallback so guest carts still work if device storage never resolves. */
let memoryCartSessionId: string | null = null
/** Single-flight so parallel add/load/merge never mint two different session ids. */
let cartSessionIdInflight: Promise<string> | null = null
let memoryGuestCartId: string | null = null

async function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function withStorageTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cart-session-storage-timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function getCartSessionId(): Promise<string> {
  if (memoryCartSessionId) return memoryCartSessionId
  if (cartSessionIdInflight) return cartSessionIdInflight

  cartSessionIdInflight = (async () => {
    try {
      const existing = await withStorageTimeout(
        AsyncStorage.getItem(CART_SESSION_KEY),
        CART_SESSION_STORAGE_TIMEOUT_MS,
      )
      if (existing) {
        memoryCartSessionId = existing
        return existing
      }
    } catch {
      // Fall through to create a session — do not hang purchase CTAs.
    }

    const sessionId = await createSessionId()
    memoryCartSessionId = sessionId
    try {
      await withStorageTimeout(
        AsyncStorage.setItem(CART_SESSION_KEY, sessionId),
        CART_SESSION_STORAGE_TIMEOUT_MS,
      )
    } catch {
      // Memory session is enough for this app launch; next launch may mint a new one.
    }
    return sessionId
  })()

  try {
    return await cartSessionIdInflight
  } finally {
    cartSessionIdInflight = null
  }
}

/** Remember the guest cart row so a drifted session id can still recover lines. */
export async function rememberGuestCartId(cartId: string | null): Promise<void> {
  memoryGuestCartId = cartId
  try {
    if (cartId) {
      await withStorageTimeout(
        AsyncStorage.setItem(GUEST_CART_ID_KEY, cartId),
        CART_SESSION_STORAGE_TIMEOUT_MS,
      )
    } else {
      await withStorageTimeout(
        AsyncStorage.removeItem(GUEST_CART_ID_KEY),
        CART_SESSION_STORAGE_TIMEOUT_MS,
      )
    }
  } catch {
    // memory is enough for this launch
  }
}

export async function getRememberedGuestCartId(): Promise<string | null> {
  if (memoryGuestCartId) return memoryGuestCartId
  try {
    const existing = await withStorageTimeout(
      AsyncStorage.getItem(GUEST_CART_ID_KEY),
      CART_SESSION_STORAGE_TIMEOUT_MS,
    )
    if (existing) {
      memoryGuestCartId = existing
      return existing
    }
  } catch {
    // ignore
  }
  return null
}

export async function getOrCreateCart(options: {
  userId?: string | null
  sessionId?: string | null
}): Promise<{ cart: CartRow | null; error: string | null }> {
  const sessionId = options.sessionId ?? (options.userId ? null : await getCartSessionId())
  return fetchGetOrCreateCart({
    userId: options.userId ?? null,
    sessionId,
  })
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
    data: {
      cart: cartResult.data,
      ...splitCartItems(itemsResult.items),
    },
    error: null,
  }
}

export async function addListingToCart(options: {
  cartId: string
  listingId: string
  quantity?: number
  variantId?: string | null
  /** Optional buyer note / personalization stored on the cart line. */
  personalizationNote?: string | null
  /** Guest session carts must use anon auth (stale JWTs 401 otherwise). */
  asGuest?: boolean
}): Promise<{ item: CartItemRow | null; error: string | null }> {
  const { item: data, error } = await fetchAddToCart({
    cartId: options.cartId,
    listingId: options.listingId,
    quantity: options.quantity,
    variantId: options.variantId,
    asGuest: options.asGuest,
  })

  if (error) {
    return { item: null, error }
  }

  const note = options.personalizationNote?.trim()
  if (note && data?.id) {
    const existing =
      data.item_metadata && typeof data.item_metadata === 'object' && !Array.isArray(data.item_metadata)
        ? (data.item_metadata as Record<string, unknown>)
        : {}
    // Best-effort — never block the Add to Cart CTA on note persistence.
    void supabase
      .from('cart_items')
      .update({
        item_metadata: { ...existing, personalization_note: note },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('cart_id', options.cartId)
      .then(({ error: noteError }) => {
        if (noteError) {
          console.warn('[cart] personalization note update failed', noteError.message)
        }
      })
  }

  // Totals already run inside add_to_cart RPC — do not await secondary writes on the CTA path.
  void supabase.rpc('update_cart_totals', { p_cart_id: options.cartId })
  void recordCartAddAnalytics({
    cartId: options.cartId,
    listingId: options.listingId,
    quantity: options.quantity ?? 1,
    variantId: options.variantId ?? null,
  })
  return { item: data, error: null }
}

export async function addBundleToCart(options: {
  cartId: string
  bundleId: string
  quantity?: number
}): Promise<{ item: CartItemRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('add_bundle_to_cart', {
    p_cart_id: options.cartId,
    p_bundle_id: options.bundleId,
    p_quantity: options.quantity ?? 1,
  })
  if (error) return { item: null, error: error.message }
  return { item: data as CartItemRow, error: null }
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

export async function setCartItemSavedForLater(
  cartId: string,
  cartItemId: string,
  savedForLater: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cart_items')
    .update({
      saved_for_later: savedForLater,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cartItemId)
    .eq('cart_id', cartId)

  if (error) {
    return { error: error.message }
  }

  await supabase.rpc('update_cart_totals', { p_cart_id: cartId })
  return { error: null }
}

export async function saveCartItemForLater(
  cartId: string,
  cartItemId: string,
): Promise<{ error: string | null }> {
  return setCartItemSavedForLater(cartId, cartItemId, true)
}

export async function moveSavedCartItemToCart(
  cartId: string,
  cartItemId: string,
): Promise<{ error: string | null }> {
  return setCartItemSavedForLater(cartId, cartItemId, false)
}

/** Empties a cart after its items have been converted into order(s). */
export async function clearCartItems(cartId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId)
  if (error) {
    return { error: error.message }
  }
  await removeCartDiscount(cartId)
  await supabase.rpc('update_cart_totals', { p_cart_id: cartId })
  return { error: null }
}

export async function applyCartDiscount(options: {
  cartId: string
  profileId: string
  /** Pre-computed, clamped discount amount. Passed so totals never go negative. */
  amount?: number
}): Promise<{ cart: CartRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('apply_discount_to_cart', {
    p_cart_id: options.cartId,
    p_discount_profile_id: options.profileId,
    p_discount_amount: options.amount ?? undefined,
  })

  if (error) {
    return { cart: null, error: error.message }
  }

  return { cart: data, error: null }
}

export async function removeCartDiscount(
  cartId: string,
): Promise<{ cart: CartRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('remove_discount_from_cart', {
    p_cart_id: cartId,
  })

  if (error) {
    return { cart: null, error: error.message }
  }

  return { cart: data, error: null }
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
