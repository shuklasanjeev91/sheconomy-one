import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'

type ApiSuccess = {
  result: 'success'
  base_code?: string
  conversion_rates?: Record<string, number>
  rates?: Record<string, number>
  time_next_update_unix?: number
  time_last_update_unix?: number
}

function normalizeBase(value: unknown): string {
  const code = String(value ?? 'USD')
    .trim()
    .toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'USD'
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

  try {
    const upstream = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`)
    if (!upstream.ok) {
      return jsonResponse(
        { error: `Upstream exchange rate request failed (${upstream.status})`, unavailable: true },
        502,
      )
    }
    const payload = (await upstream.json()) as ApiSuccess
    if (payload.result !== 'success') {
      return jsonResponse({ error: 'Exchange rate provider returned an error', unavailable: true }, 502)
    }
    const rates = payload.conversion_rates ?? payload.rates
    if (!rates || typeof rates !== 'object') {
      return jsonResponse({ error: 'Exchange rate payload missing rates', unavailable: true }, 502)
    }

    return jsonResponse({
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
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Exchange rate request failed',
        unavailable: true,
      },
      502,
    )
  }
})
