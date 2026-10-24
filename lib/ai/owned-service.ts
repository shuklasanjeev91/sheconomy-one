import { supabase } from '~/lib/supabase'

export type OwnedRankKind =
  | 'for_you'
  | 'similar'
  | 'frequently_bought_together'
  | 'posts'
  | 'jobs'
  | 'people'
  | 'programs'
  | 'low_stock'
  | 'unfulfilled'

const GUEST_ACTIONS = new Set(['ai_search', 'chat', 'suggestions', 'writing_check'])
const GUEST_RANK = new Set(['similar', 'frequently_bought_together'])

export function readableAiError(message: string): string {
  if (/unauthorized/i.test(message)) return 'Sign in to ask about your own orders or shop.'
  return message
}

const OWNED_ACTIONS = new Set([
  'chat',
  'suggestions',
  'ai_search',
  'comment_suggestions',
  'meeting_draft',
  'post_draft',
  'post_suggestions',
  'shop_draft',
  'listing_draft_from_image',
  'moderate_text',
  'moderate_image',
  'feedback',
  'writing_check',
])

/** True when SHERPA can generate a try-on image. Unpaid image plans stay hidden. */
export async function ownedTryOnReady(): Promise<boolean> {
  const base = ownedAiServiceUrl()
  if (!base) return true
  try {
    const response = await fetch(`${base}/health`, { signal: timeoutSignal(4000) })
    if (!response.ok) return false
    const payload = (await response.json()) as { tryOn?: boolean }
    return payload.tryOn === true
  } catch {
    return false
  }
}

export function ownedAiServiceUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_AI_SERVICE_URL
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/$/, '')
  return trimmed || null
}

export function usesOwnedAiAction(action: string): boolean {
  return OWNED_ACTIONS.has(action) && ownedAiServiceUrl() != null
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  const timeout = (AbortSignal as { timeout?: (n: number) => AbortSignal }).timeout
  if (typeof timeout === 'function') return timeout(ms)
  return undefined
}

async function authHeader(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? `Bearer ${token}` : null
}

/** Calls the owned service. Returns null when it is not configured. Throws when the call fails. */
export async function invokeOwnedAssist<T>(body: Record<string, unknown>): Promise<T | null> {
  const base = ownedAiServiceUrl()
  if (!base || !usesOwnedAiAction(String(body.action ?? ''))) return null
  const authorization = await authHeader()
  const action = String(body.action ?? '')
  if (!authorization && !GUEST_ACTIONS.has(action)) return null

  const response = await fetch(`${base}/v1/assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
    signal: timeoutSignal(action === 'listing_draft_from_image' || action === 'moderate_image' ? 45000 : 20000),
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(readableAiError(payload?.error || 'SHERPA is unavailable right now.'))
  }
  if (payload && typeof payload === 'object' && payload.error) {
    throw new Error(readableAiError(payload.error))
  }
  return payload as T
}

export async function idsFromOwnedRank(options: {
  product?: string
  kind: OwnedRankKind
  listingId?: string | null
  excludeIds?: string[]
  limit?: number
  message?: string
}): Promise<string[] | null> {
  const base = ownedAiServiceUrl()
  if (!base) return null
  const authorization = await authHeader()
  if (!authorization && !GUEST_RANK.has(options.kind)) return null

  const response = await fetch(`${base}/v1/rank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      product: options.product ?? 'commerce',
      kind: options.kind,
      listingId: options.listingId ?? null,
      excludeIds: options.excludeIds ?? [],
      limit: options.limit ?? 12,
      message: options.message ?? '',
    }),
    signal: timeoutSignal(8000),
  })
  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as { ids?: unknown } | null
  if (!payload || !Array.isArray(payload.ids)) return null
  const ids = payload.ids.map((id) => String(id)).filter(Boolean)
  return ids.length ? ids : null
}
