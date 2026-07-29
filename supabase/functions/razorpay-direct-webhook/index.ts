import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { decryptSecret } from '../_shared/encryption.ts'
import {
  isEncryptedAccount,
  parseStoredCredentials,
  verifyRazorpayWebhookSignature,
} from '../_shared/razorpay.ts'

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function extractPaymentStepId(payload: Record<string, unknown>): string {
  const paymentLink = payload.payment_link as Record<string, unknown> | undefined
  const entity = (paymentLink?.entity ?? {}) as Record<string, unknown>
  const notes = (entity.notes ?? {}) as Record<string, unknown>
  return readString(notes.payment_step_id)
}

function extractShopId(payload: Record<string, unknown>): string {
  const paymentLink = payload.payment_link as Record<string, unknown> | undefined
  const entity = (paymentLink?.entity ?? {}) as Record<string, unknown>
  const notes = (entity.notes ?? {}) as Record<string, unknown>
  return readString(notes.shop_id)
}

function extractProviderReference(payload: Record<string, unknown>): string {
  const payment = payload.payment as Record<string, unknown> | undefined
  const paymentEntity = (payment?.entity ?? {}) as Record<string, unknown>
  if (readString(paymentEntity.id)) return readString(paymentEntity.id)

  const paymentLink = payload.payment_link as Record<string, unknown> | undefined
  const entity = (paymentLink?.entity ?? {}) as Record<string, unknown>
  return readString(entity.id)
}

function mapEventStatus(event: string): string {
  const normalized = event.toLowerCase()
  if (normalized.includes('paid') || normalized.includes('captured')) return 'paid'
  if (normalized.includes('failed') || normalized.includes('expired')) return 'failed'
  return 'processing'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Razorpay webhook not configured' }, 503)
  }

  const rawBody = await request.text()
  let envelope: Record<string, unknown>
  try {
    envelope = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const event = readString(envelope.event)
  const payload = (envelope.payload ?? {}) as Record<string, unknown>
  const paymentStepId = extractPaymentStepId(payload)
  const shopId = extractShopId(payload)

  if (!event || !paymentStepId || !shopId) {
    return jsonResponse({ error: 'Missing Razorpay webhook fields' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: account } = await admin
    .from('shop_payment_accounts')
    .select('access_token, metadata')
    .eq('shop_id', shopId)
    .eq('provider', 'razorpay')
    .eq('status', 'connected')
    .maybeSingle()

  const metadata = account?.metadata as Record<string, unknown> | null
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  // Resolve the webhook secret for signature verification.
  // New encrypted accounts store it encrypted in metadata; legacy accounts used plain JSON.
  let webhookSecret = ''

  if (isEncryptedAccount(metadata)) {
    // Try decrypting the dedicated webhook secret first; fall back to key_secret.
    const wsEncrypted = typeof metadata?.webhook_secret_encrypted === 'string'
      ? metadata.webhook_secret_encrypted : null
    const wsIv = typeof metadata?.webhook_secret_iv === 'string' ? metadata.webhook_secret_iv : null
    const wsTag = typeof metadata?.webhook_secret_auth_tag === 'string' ? metadata.webhook_secret_auth_tag : null

    if (wsEncrypted && wsIv && wsTag) {
      try {
        webhookSecret = await decryptSecret(wsEncrypted, wsIv, wsTag)
      } catch {
        // Webhook secret decryption failed — fall through to key_secret
      }
    }

    // If no dedicated webhook secret, fall back to the key_secret for verification
    if (!webhookSecret && account?.access_token) {
      const iv = typeof metadata?.iv === 'string' ? metadata.iv : null
      const authTag = typeof metadata?.auth_tag === 'string' ? metadata.auth_tag : null
      if (iv && authTag) {
        try {
          webhookSecret = await decryptSecret(account.access_token, iv, authTag)
        } catch {
          // Decryption failed — will proceed without verification (logged below)
        }
      }
    }
  } else {
    // Legacy plain-text credentials
    const credentials = parseStoredCredentials(metadata?.credentials)
    webhookSecret = credentials?.webhook_secret || credentials?.key_secret || ''
  }

  if (signature) {
    if (!webhookSecret) {
      // Signature present but we can't verify — reject to prevent spoofed events
      console.error(`[razorpay-direct-webhook] signature present but webhook secret unavailable for shop=${shopId}`)
      return jsonResponse({ error: 'Webhook signature could not be verified' }, 401)
    }
    if (!(await verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret))) {
      return jsonResponse({ error: 'Invalid Razorpay signature' }, 401)
    }
  }

  const mappedStatus = mapEventStatus(event)
  const providerReference = extractProviderReference(payload)
  const webhookId =
    readString(envelope.id) ||
    `${providerReference || paymentStepId}:${event}:${mappedStatus}`

  const { data, error } = await admin.rpc('process_checkout_payment_webhook', {
    p_payment_step_id: paymentStepId,
    p_shop_id: shopId,
    p_provider: 'razorpay',
    p_webhook_id: webhookId,
    p_event_type: event,
    p_status: mappedStatus,
    p_provider_reference: providerReference || null,
    p_payload: envelope,
  })

  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ ok: true, result: data })
})
