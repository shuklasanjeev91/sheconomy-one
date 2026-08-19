import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type ApiSuccess = {
  result: 'success'
  base_code?: string
  conversion_rates?: Record<string, number>
  rates?: Record<string, number>
  time_next_update_unix?: number
  time_last_update_unix?: number
}

type CachedRates = {
  base: string
  rates: Record<string, number>
  fetchedAt: number
  nextUpdateAt: number | null
  lastUpdateAt: number | null
}

/** Free-tier exchangerate-api.com is daily + rate-limited; cache hard. */
const CACHE_TTL_MS = 1000 * 60 * 60 * 12
const memoryByBase = new Map<string, CachedRates>()

function normalizeBase(value: unknown): string {
  const code = String(value ?? 'USD')
    .trim()
    .toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'USD'
}

function isFresh(entry: CachedRates, now = Date.now()) {
  if (entry.nextUpdateAt && now < entry.nextUpdateAt) return true
  return now - entry.fetchedAt < CACHE_TTL_MS
}

function toResponseBody(entry: CachedRates, stale = false) {
  return {
    base: entry.base,
    rates: entry.rates,
    fetchedAt: entry.fetchedAt,
    nextUpdateAt: entry.nextUpdateAt,
    lastUpdateAt: entry.lastUpdateAt,
    ...(stale ? { stale: true } : {}),
  }
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function readDbCache(base: string): Promise<CachedRates | null> {
  const admin = adminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('exchange_rate_cache')
    .select('base, rates, fetched_at, next_update_at, last_update_at')
    .eq('base', base)
    .maybeSingle()
  if (error || !data?.rates || typeof data.rates !== 'object') return null
  return {
    base: String(data.base).toUpperCase(),
    rates: data.rates as Record<string, number>,
    fetchedAt: new Date(data.fetched_at).getTime(),
    nextUpdateAt: data.next_update_at ? new Date(data.next_update_at).getTime() : null,
    lastUpdateAt: data.last_update_at ? new Date(data.last_update_at).getTime() : null,
  }
}

async function writeDbCache(entry: CachedRates): Promise<void> {
  const admin = adminClient()
  if (!admin) return
  await admin.from('exchange_rate_cache').upsert(
    {
      base: entry.base,
      rates: entry.rates,
      fetched_at: new Date(entry.fetchedAt).toISOString(),
      next_update_at: entry.nextUpdateAt ? new Date(entry.nextUpdateAt).toISOString() : null,
      last_update_at: entry.lastUpdateAt ? new Date(entry.lastUpdateAt).toISOString() : null,
    },
    { onConflict: 'base' },
  )
}

/** Free ECB-backed fallback — no API key, used only when primary is rate-limited and cache is empty. */
async function fetchFrankfurter(base: string): Promise<CachedRates | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`)
    if (!res.ok) return null
    const payload = (await res.json()) as { base?: string; rates?: Record<string, number>; date?: string }
    if (!payload.rates || typeof payload.rates !== 'object') return null
    const rates = { ...payload.rates, [base]: 1 }
    return {
      base: String(payload.base ?? base).toUpperCase(),
      rates,
      fetchedAt: Date.now(),
      nextUpdateAt: Date.now() + CACHE_TTL_MS,
      lastUpdateAt: Date.now(),
    }
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY')?.trim()
  if (!apiKey) {
    return jsonResponse({ error: 'Exchange rate service is not configured', unavailable: true }, 503)
  }

  let base = 'USD'
  if (request.method === 'GET') {
    const url = new URL(request.url)
    base = normalizeBase(url.searchParams.get('base'))
  } else {
    try {
      const body = (await request.json()) as { base?: string }
      base = normalizeBase(body?.base)
    } catch {
      base = 'USD'
    }
  }

  const mem = memoryByBase.get(base)
  if (mem && isFresh(mem)) {
    return jsonResponse(toResponseBody(mem), 200, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    })
  }

  const dbCached = await readDbCache(base)
  if (dbCached && isFresh(dbCached)) {
    memoryByBase.set(base, dbCached)
    return jsonResponse(toResponseBody(dbCached), 200, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    })
  }

  const staleFallback = mem ?? dbCached

  try {
    const upstream = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`)
    if (!upstream.ok) {
      if (staleFallback) {
        return jsonResponse(toResponseBody(staleFallback, true), 200, {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        })
      }
      // Bootstrap from a free no-key provider so cold cache + 429 doesn't blank FX forever.
      const bootstrap = await fetchFrankfurter(base)
      if (bootstrap) {
        memoryByBase.set(base, bootstrap)
        void writeDbCache(bootstrap)
        return jsonResponse(toResponseBody(bootstrap, true), 200, {
          'Cache-Control': 'public, max-age=1800, stale-while-revalidate=86400',
        })
      }
      return jsonResponse(
        { error: `Upstream exchange rate request failed (${upstream.status})`, unavailable: true },
        upstream.status === 429 ? 429 : 502,
      )
    }
    const payload = (await upstream.json()) as ApiSuccess
    if (payload.result !== 'success') {
      if (staleFallback) return jsonResponse(toResponseBody(staleFallback, true))
      return jsonResponse({ error: 'Exchange rate provider returned an error', unavailable: true }, 502)
    }
    const rates = payload.conversion_rates ?? payload.rates
    if (!rates || typeof rates !== 'object') {
      if (staleFallback) return jsonResponse(toResponseBody(staleFallback, true))
      return jsonResponse({ error: 'Exchange rate payload missing rates', unavailable: true }, 502)
    }

    const entry: CachedRates = {
      base: String(payload.base_code ?? base).toUpperCase(),
      rates,
      fetchedAt: Date.now(),
      nextUpdateAt:
        typeof payload.time_next_update_unix === 'number'
          ? payload.time_next_update_unix * 1000
          : null,
      lastUpdateAt:
        typeof payload.time_last_update_unix === 'number'
          ? payload.time_last_update_unix * 1000
          : null,
    }
    memoryByBase.set(base, entry)
    void writeDbCache(entry)

    return jsonResponse(toResponseBody(entry), 200, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    })
  } catch (error) {
    if (staleFallback) return jsonResponse(toResponseBody(staleFallback, true))
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Exchange rate request failed',
        unavailable: true,
      },
      502,
    )
  }
})
