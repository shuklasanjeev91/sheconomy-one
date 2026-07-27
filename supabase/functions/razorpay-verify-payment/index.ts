/**
 * POST /functions/v1/razorpay-verify-payment
 *
 * Verify a Razorpay payment signature after checkout completes on the client.
 * Uses HMAC-SHA256 with the vendor's decrypted keySecret (not webhookSecret).
 * Comparison is timing-safe.
 *
 * Body: { shopId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * Returns: { verified: true, paymentId } | 400 { verified: false, error }
 *
 * Security:
 * - signature and secret are never logged
 * - keySecret is decrypted inline and overwritten immediately after use
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertEncryptionKeyPresent, decryptSecret } from '../_shared/encryption.ts'

type VerifyBody = {
  shopId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

const encoder = new TextEncoder()

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    assertEncryptionKeyPresent()
  } catch {
    return jsonResponse({ error: 'Service misconfigured' }, 503)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: VerifyBody
  try {
    body = (await request.json()) as VerifyBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { shopId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body

  if (!shopId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return jsonResponse({
      verified: false,
      error: 'shopId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required',
    }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: account } = await admin
    .from('shop_payment_accounts')
    .select('access_token, metadata, status')
    .eq('shop_id', shopId)
    .eq('provider', 'razorpay')
    .maybeSingle()

  if (!account || account.status !== 'connected') {
    return jsonResponse({ verified: false, error: 'Payment method not found for this vendor' }, 400)
  }

  const metadata = account.metadata as Record<string, unknown> | null
  const iv = typeof metadata?.iv === 'string' ? metadata.iv : null
  const authTag = typeof metadata?.auth_tag === 'string' ? metadata.auth_tag : null
  const encryptedSecret = account.access_token

  if (!iv || !authTag || !encryptedSecret) {
    return jsonResponse({ verified: false, error: 'Payment credentials incomplete' }, 400)
  }

  let keySecret: string
  try {
    keySecret = await decryptSecret(encryptedSecret, iv, authTag)
  } catch {
    return jsonResponse({ verified: false, error: 'Could not process payment credentials' }, 500)
  }

  // Razorpay signature: HMAC-SHA256(orderId + "|" + paymentId, keySecret)
  const message = `${razorpayOrderId}|${razorpayPaymentId}`
  let expectedSig: string
  try {
    expectedSig = await hmacSha256Hex(message, keySecret)
  } finally {
    keySecret = ''
  }

  const valid = timingSafeEqual(expectedSig, razorpaySignature)

  if (!valid) {
    return jsonResponse({ verified: false, error: 'Payment verification failed' }, 400)
  }

  // Mark order as paid in order_payments via RPC (provider-agnostic)
  await admin.rpc('process_checkout_payment_webhook', {
    p_payment_step_id: null,
    p_shop_id: shopId,
    p_provider: 'razorpay',
    p_webhook_id: `${razorpayOrderId}:${razorpayPaymentId}:verified`,
    p_event_type: 'payment.captured',
    p_status: 'paid',
    p_provider_reference: razorpayPaymentId,
    p_payload: {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    },
  })

  return jsonResponse({ verified: true, paymentId: razorpayPaymentId })
})
