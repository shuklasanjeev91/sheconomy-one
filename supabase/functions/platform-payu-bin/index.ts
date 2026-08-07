import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payuMerchantCommand } from '../_shared/payu.ts'
import { resolvePlatformPayuCredentials } from '../_shared/platform-payu.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const creds = resolvePlatformPayuCredentials()
  if (!creds) return jsonResponse({ error: 'Platform PayU is not configured' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl) return jsonResponse({ error: 'Misconfigured' }, 503)

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: { bin?: string }
  try {
    body = (await request.json()) as { bin?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const bin = String(body.bin ?? '').replace(/\D/g, '').slice(0, 9)
  if (bin.length < 6) return jsonResponse({ error: 'Enter at least 6 card digits' }, 400)

  const posted = await payuMerchantCommand(creds, 'getBinInfo', {
    var1: '1',
    var2: bin.slice(0, 6),
    var5: '1',
  })

  const data = (posted.json?.data ?? posted.json ?? {}) as Record<string, unknown>
  const binsData = (data.bins_data ?? data) as Record<string, unknown>
  const cardType = String(binsData.card_type ?? binsData.cardType ?? '').toUpperCase()
  const category = String(binsData.category ?? '').toLowerCase()
  const issuingBank = String(binsData.issuing_bank ?? binsData.issuingBank ?? '')
  const isDomestic = String(binsData.is_domestic ?? binsData.isDomestic ?? '') === '1'

  if (!cardType && posted.json?.status !== 1 && posted.json?.status !== '1') {
    return jsonResponse(
      { error: typeof posted.json?.msg === 'string' ? posted.json.msg : 'BIN lookup failed' },
      502,
    )
  }

  return jsonResponse({
    bin: bin.slice(0, 6),
    card_type: cardType || 'UNKNOWN',
    bankcode: cardType === 'MAST' ? 'MAST' : cardType === 'AMEX' ? 'AMEX' : cardType || 'CC',
    category: category || null,
    issuing_bank: issuingBank || null,
    is_domestic: isDomestic,
  })
})
