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

/** True when supabase-js still has a JWT we can safely send. */
export async function hasUsableAuthToken(): Promise<boolean> {
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1_200)
      }),
    ])
    if (sessionResult && 'data' in sessionResult) {
      const token = sessionResult.data.session?.access_token
      return Boolean(token && isJwtUsable(token))
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * PostgREST may return a single composite row as an object OR a one-element array.
 * Treating an array as the cart makes `cart.id` undefined → "Could not create cart".
 */
function unwrapRpcRow<T extends { id?: string }>(data: unknown): T | null {
  if (data == null) return null
  if (Array.isArray(data)) {
    const first = data[0]
    if (first && typeof first === 'object' && first !== null && 'id' in first) {
      const row = first as T
      return row.id ? row : null
    }
    return null
  }
  if (typeof data === 'object' && data !== null && 'id' in data) {
    const row = data as T
    return row.id ? row : null
  }
  return null
}

function rpcErrorMessage(parsed: unknown, status: number, text: string): string {
  if (parsed && typeof parsed === 'object' && parsed !== null) {
    const err = parsed as { message?: unknown; error?: unknown; hint?: unknown; code?: unknown }
    if (err.message != null && String(err.message)) return String(err.message)
    if (err.error != null && String(err.error)) return String(err.error)
    if (err.hint != null && String(err.hint)) return String(err.hint)
    if (err.code != null && String(err.code)) return String(err.code)
  }
  return text.slice(0, 180) || `Request failed (${status})`
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
      // Stale JWT — retry once as anon for guest-safe RPCs.
      if (response.status === 401 && !forceAnon) {
        return postRpc<T>(fnName, body, true)
      }
      return { data: null, error: rpcErrorMessage(parsed, response.status, text) }
    }

    const row = unwrapRpcRow<T & { id?: string }>(parsed)
    if (!row) {
      return {
        data: null,
        error: text ? `Unexpected response from ${fnName}` : `Empty response from ${fnName}`,
      }
    }
    return { data: row as T, error: null }
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

/**
 * Resolve whether this device should use a user cart or a guest session cart.
 * Stale `user` objects without a usable JWT must fall back to guest — otherwise
 * get_or_create_cart / add_to_cart fail with 401 and surface as "Could not create cart".
 */
export async function resolveCartActor(claimedUserId?: string | null): Promise<{
  userId: string | null
  sessionId: string | null
  asGuest: boolean
}> {
  // Guests must never wait on auth storage/getSession — that path hangs on some iPads
  // and left Add to Cart stuck on the spinner.
  if (!claimedUserId) {
    const { getCartSessionId } = await import('./cart')
    const sessionId = await getCartSessionId()
    return { userId: null, sessionId, asGuest: true }
  }

  const usable = await hasUsableAuthToken()
  if (usable) {
    return { userId: claimedUserId, sessionId: null, asGuest: false }
  }

  const { getCartSessionId } = await import('./cart')
  const sessionId = await getCartSessionId()
  return { userId: null, sessionId, asGuest: true }
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
  const asGuest = !options.userId
  const { data, error } = await postRpc<CartRow>('get_or_create_cart', body, asGuest)
  if (error) return { cart: null, error }
  if (!data?.id) return { cart: null, error: error || 'Could not create cart' }
  return { cart: data, error: null }
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
