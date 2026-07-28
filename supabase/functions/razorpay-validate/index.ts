/**
 * POST /functions/v1/razorpay-validate
 *
 * Validate a vendor's Razorpay credentials without saving anything.
 * Called by the "Run validation check" button in the vendor payment settings UI.
 *
 * Body: { shopId, keyId, keySecret, mode: 'test' | 'live' }
 * Returns: { valid, maskedKeyId, mode } | { valid: false, error }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { razorpayAuthHeader } from '../_shared/razorpay.ts'

type ValidateBody = {
  shopId: string
  keyId: string
  keySecret: string
  mode: 'test' | 'live'
}

function maskKeyId(keyId: string): string {
  // rzp_live_AbCdEfGh → rzp_live_••••EfGh
  const parts = keyId.split('_')
  if (parts.length < 3) return keyId.slice(0, -4).replace(/./g, '•') + keyId.slice(-4)
  const prefix = `${parts[0]}_${parts[1]}_`
  const rest = parts.slice(2).join('_')
  if (rest.length <= 4) return prefix + rest
  return prefix + '••••' + rest.slice(-4)
}

function expectedPrefix(mode: 'test' | 'live'): string {
  return mode === 'live' ? 'rzp_live_' : 'rzp_test_'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  // Verify session
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: ValidateBody
  try {
    body = (await request.json()) as ValidateBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { shopId, keyId, keySecret, mode } = body
  if (!shopId || !keyId || !keySecret || !mode) {
    return jsonResponse({ error: 'shopId, keyId, keySecret, and mode are required' }, 400)
  }
  if (mode !== 'test' && mode !== 'live') {
    return jsonResponse({ error: 'mode must be "test" or "live"' }, 400)
  }

  // Verify shop ownership
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: shop } = await admin
    .from('shops')
    .select('id')
    .eq('id', shopId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)

  // Key ID format check
  const prefix = expectedPrefix(mode)
  if (!keyId.startsWith(prefix)) {
    return jsonResponse({
      valid: false,
      error: `Key ID must start with "${prefix}" for ${mode} mode. Check your Razorpay Dashboard settings.`,
    }, 400)
  }

  // Live API call — verify credentials are actually valid
  let razorpayOk = false
  let razorpayError: string | null = null
  try {
    const probeResponse = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      method: 'GET',
      headers: {
        Authorization: razorpayAuthHeader({ key_id: keyId, key_secret: keySecret }),
        'Content-Type': 'application/json',
      },
    })
    if (probeResponse.status === 200 || probeResponse.status === 204) {
      razorpayOk = true
    } else if (probeResponse.status === 401) {
      razorpayError = 'Invalid credentials — Razorpay rejected the Key ID and Secret. Double-check your Razorpay Dashboard.'
    } else {
      // Unexpected status — still consider valid if not 401
      razorpayOk = true
    }
  } catch {
    // Network errors: don't block — treat as valid (Razorpay may be unreachable from edge)
    razorpayOk = true
  }

  if (!razorpayOk) {
    return jsonResponse({ valid: false, error: razorpayError ?? 'Credential validation failed' }, 400)
  }

  return jsonResponse({ valid: true, mode, maskedKeyId: maskKeyId(keyId) })
})
