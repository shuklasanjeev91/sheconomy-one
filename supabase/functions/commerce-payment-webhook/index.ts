import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'

const encoder = new TextEncoder()

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

async function verifySignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return timingSafeEqual(bytesToHex(digest), signature.toLowerCase().replace(/^sha256=/, ''))
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('COMMERCE_PAYMENT_WEBHOOK_SECRET')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!secret || !serviceRole || !supabaseUrl) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503)
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-commerce-signature') ?? ''
  if (!signature || !(await verifySignature(rawBody, signature, secret))) {
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const paymentStepId = String(payload.payment_step_id ?? '')
  const shopId = String(payload.shop_id ?? '')
  const provider = String(payload.provider ?? '')
  const webhookId = String(payload.event_id ?? '')
  const eventType = String(payload.event_type ?? 'payment.updated')
  const status = String(payload.status ?? '')
  const providerReference =
    typeof payload.provider_reference === 'string' ? payload.provider_reference : null

  if (!paymentStepId || !shopId || !provider || !webhookId || !status) {
    return jsonResponse({ error: 'Missing required event fields' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.rpc('process_checkout_payment_webhook', {
    p_payment_step_id: paymentStepId,
    p_shop_id: shopId,
    p_provider: provider,
    p_webhook_id: webhookId,
    p_event_type: eventType,
    p_status: status,
    p_provider_reference: providerReference,
    p_payload: payload,
  })

  if (error) return jsonResponse({ error: error.message }, 400)
  return jsonResponse(data)
})
