import { supabaseConfig } from '~/lib/supabase/env'
import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

type CartRow = Tables<'carts'>
type CartItemRow = Tables<'cart_items'>

const RPC_TIMEOUT_MS = 8_000

/**
 * Direct PostgREST RPC via fetch + AbortSignal.
 * Bypasses supabase-js auth storage reads that can hang native Add to Cart forever.
 */
async function getBearerTokenFast(): Promise<string> {
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1_200)
      }),
    ])
    if (sessionResult && 'data' in sessionResult) {
      const token = sessionResult.data.session?.access_token
      if (token) return token
    }
  } catch {
    // fall through to anon
  }
  return supabaseConfig.anonKey
}

async function postRpc<T>(
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    const bearer = await getBearerTokenFast()
    const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
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

  return postRpc<CartRow>('get_or_create_cart', body)
}

export async function fetchAddToCart(options: {
  cartId: string
  listingId: string
  quantity?: number
  variantId?: string | null
}): Promise<{ item: CartItemRow | null; error: string | null }> {
  const body: Record<string, unknown> = {
    p_cart_id: options.cartId,
    p_listing_id: options.listingId,
    p_quantity: options.quantity ?? 1,
  }
  if (options.variantId) body.p_variant_id = options.variantId

  const { data, error } = await postRpc<CartItemRow>('add_to_cart', body)
  return { item: data, error }
}
