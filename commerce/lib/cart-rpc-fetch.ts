import { supabaseConfig } from '~/lib/supabase/env'
import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'
import { splitCartItems } from '~/commerce/lib/cart-shelf'

type CartRow = Tables<'carts'>
type CartItemRow = Tables<'cart_items'>

const RPC_TIMEOUT_MS = 8_000

function isJwtUsable(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return false
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const atobFn = globalThis.atob?.bind(globalThis)
    if (!atobFn) return false
    const payload = JSON.parse(atobFn(padded)) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5_000
  } catch {
    return false
  }
}

/**
 * Guests must always use the anon key. A stale/expired session JWT in AsyncStorage
 * causes PostgREST 401 (PGRST301) and empties the cart after Add to Cart.
 */
async function getBearerToken(options?: { forceAnon?: boolean }): Promise<string> {
  if (options?.forceAnon) return supabaseConfig.anonKey

  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1_200)
      }),
    ])
    if (sessionResult && 'data' in sessionResult) {
      const token = sessionResult.data.session?.access_token
      if (token && isJwtUsable(token)) return token
    }
  } catch {
    // fall through to anon
  }
  return supabaseConfig.anonKey
}

async function postRpc<T>(
  fnName: string,
  body: Record<string, unknown>,
  forceAnon?: boolean,
): Promise<{ data: T | null; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    const bearer = await getBearerToken({ forceAnon })
    const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    let parsed: unknown = null
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown
      } catch {
        return { data: null, error: text.slice(0, 180) || `Request failed (${response.status})` }
      }
    }

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message?: unknown }).message ?? `Request failed (${response.status})`)
          : `Request failed (${response.status})`
      // Stale JWT — retry once as anon for guest-safe RPCs.
      if (response.status === 401 && !forceAnon) {
        return postRpc<T>(fnName, body, true)
      }
      return { data: null, error: message }
    }

    return { data: parsed as T, error: null }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'Request timed out. Check your connection and try again.' }
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network request failed.',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function restGet<T>(
  pathWithQuery: string,
  forceAnon?: boolean,
): Promise<{ data: T | null; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    const bearer = await getBearerToken({ forceAnon })
    const response = await fetch(`${supabaseConfig.url}/rest/v1/${pathWithQuery}`, {
      method: 'GET',
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let parsed: unknown = null
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown
      } catch {
        return { data: null, error: text.slice(0, 180) || `Request failed (${response.status})` }
      }
    }
    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message?: unknown }).message ?? `Request failed (${response.status})`)
          : `Request failed (${response.status})`
      if (response.status === 401 && !forceAnon) {
        return restGet<T>(pathWithQuery, true)
      }
      return { data: null, error: message }
    }
    return { data: parsed as T, error: null }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'Request timed out. Check your connection and try again.' }
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network request failed.',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchGetOrCreateCart(options: {
  userId?: string | null
  sessionId?: string | null
}): Promise<{ cart: CartRow | null; error: string | null }> {
  const body: Record<string, unknown> = {}
  if (options.userId) body.p_user_id = options.userId
  if (options.sessionId) body.p_session_id = options.sessionId

  if (!body.p_user_id && !body.p_session_id) {
    return { cart: null, error: 'Either user_id or session_id must be provided' }
  }

  // Guest carts must not send a leftover authenticated JWT.
  return postRpc<CartRow>('get_or_create_cart', body, !options.userId)
}

export async function fetchAddToCart(options: {
  cartId: string
  listingId: string
  quantity?: number
  variantId?: string | null
  /** When true, force anon auth (guest session cart). */
  asGuest?: boolean
}): Promise<{ item: CartItemRow | null; error: string | null }> {
  const body: Record<string, unknown> = {
    p_cart_id: options.cartId,
    p_listing_id: options.listingId,
    p_quantity: options.quantity ?? 1,
  }
  if (options.variantId) body.p_variant_id = options.variantId

  const { data, error } = await postRpc<CartItemRow>('add_to_cart', body, options.asGuest === true)
  return { item: data, error }
}

/** Load cart + lines without supabase-js (avoids expired JWT on guest devices). */
export async function fetchCartBundle(
  cartId: string,
  asGuest: boolean,
): Promise<{
  data: { cart: CartRow; items: CartItemRow[]; savedItems: CartItemRow[] } | null
  error: string | null
}> {
  const cartResult = await restGet<CartRow[]>(
    `carts?id=eq.${encodeURIComponent(cartId)}&select=*`,
    asGuest,
  )
  if (cartResult.error) return { data: null, error: cartResult.error }
  const cart = Array.isArray(cartResult.data) ? cartResult.data[0] : null
  if (!cart) return { data: null, error: 'Cart not found' }

  const itemsResult = await restGet<CartItemRow[]>(
    `cart_items?cart_id=eq.${encodeURIComponent(cartId)}&select=*&order=created_at.asc`,
    asGuest,
  )
  if (itemsResult.error) return { data: null, error: itemsResult.error }

  return {
    data: {
      cart,
      ...splitCartItems(itemsResult.data ?? []),
    },
    error: null,
  }
}
