import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { decryptSecret } from '../_shared/encryption.ts'
import {
  amountToPaise,
  createRazorpayPaymentLink,
  isEncryptedAccount,
  parseStoredCredentials,
  type RazorpayCredentials,
} from '../_shared/razorpay.ts'

type CreateBody = {
  payment_step_id?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appBase =
    Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '') ||
    Deno.env.get('APP_URL')?.replace(/\/$/, '') ||
    'https://sheconomy.com'

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Razorpay direct checkout is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const paymentStepId = String(body.payment_step_id ?? '')
  if (!paymentStepId) return jsonResponse({ error: 'payment_step_id required' }, 400)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: step, error: stepError } = await admin
    .from('commerce_checkout_payment_steps')
    .select('id, checkout_group_id, shop_id, amount, collection, status, provider, currency')
    .eq('id', paymentStepId)
    .maybeSingle()

  if (stepError || !step) return jsonResponse({ error: 'Payment step not found' }, 404)
  if (String(step.collection) !== 'direct') {
    return jsonResponse({ error: 'Step is not a direct seller collection' }, 400)
  }
  if (String(step.provider ?? '') !== 'razorpay') {
    return jsonResponse({ error: 'Step provider is not Razorpay' }, 400)
  }

  const { data: group } = await admin
    .from('commerce_checkout_groups')
    .select('id, buyer_id, currency')
    .eq('id', step.checkout_group_id)
    .maybeSingle()

  if (!group || group.buyer_id !== user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const { data: account } = await admin
    .from('shop_payment_accounts')
    .select('merchant_id, access_token, metadata, status')
    .eq('shop_id', step.shop_id)
    .eq('provider', 'razorpay')
    .eq('status', 'connected')
    .maybeSingle()

  if (!account) {
    return jsonResponse({ error: 'Razorpay credentials not configured for this shop' }, 400)
  }

  const metadata = account.metadata as Record<string, unknown> | null

  // Resolve credentials — new accounts use AES-256-GCM encrypted access_token;
  // legacy accounts stored plain-text JSON in metadata.credentials.
  let credentials: RazorpayCredentials | null = null

  if (isEncryptedAccount(metadata)) {
    const iv = typeof metadata?.iv === 'string' ? metadata.iv : null
    const authTag = typeof metadata?.auth_tag === 'string' ? metadata.auth_tag : null
    const encryptedSecret = account.access_token
    const keyId = account.merchant_id

    if (!iv || !authTag || !encryptedSecret || !keyId) {
      return jsonResponse({ error: 'Razorpay credentials are incomplete for this shop' }, 400)
    }

    try {
      const keySecret = await decryptSecret(encryptedSecret, iv, authTag)
      const webhookSecretEncrypted = typeof metadata?.webhook_secret_encrypted === 'string'
        ? metadata.webhook_secret_encrypted : null
      const wsIv = typeof metadata?.webhook_secret_iv === 'string' ? metadata.webhook_secret_iv : null
      const wsTag = typeof metadata?.webhook_secret_auth_tag === 'string' ? metadata.webhook_secret_auth_tag : null

      let webhookSecret: string | null = null
      if (webhookSecretEncrypted && wsIv && wsTag) {
        try {
          webhookSecret = await decryptSecret(webhookSecretEncrypted, wsIv, wsTag)
        } catch {
          // Non-fatal — webhook secret missing just means signature won't be set on link
        }
      }

      credentials = { key_id: keyId, key_secret: keySecret, webhook_secret: webhookSecret }
    } catch {
      return jsonResponse({ error: 'Could not process Razorpay credentials for this shop' }, 500)
    }
  } else {
    // Legacy: plain-text credentials stored in metadata.credentials JSON string
    credentials = parseStoredCredentials(metadata?.credentials)
  }

  if (!credentials) {
    return jsonResponse({ error: 'Razorpay credentials not configured for this shop' }, 400)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, username')
    .eq('id', user.id)
    .maybeSingle()

  const customerName =
    (profile?.full_name || profile?.username || 'Customer').split(/\s+/)[0] || 'Customer'
  const customerEmail = profile?.email || user.email || 'buyer@sheconomy.com'
  const currency = String(step.currency ?? group.currency ?? 'INR').toUpperCase()
  const amountPaise = amountToPaise(Number(step.amount ?? 0))
  if (amountPaise <= 0) {
    return jsonResponse({ error: 'Invalid payment amount' }, 400)
  }

  const referenceId = `step_${String(step.id).replace(/-/g, '').slice(0, 24)}`
  const callbackUrl = `${appBase}/orders/razorpay-return?status=success&step=${encodeURIComponent(String(step.id))}`

  const link = await createRazorpayPaymentLink(credentials, {
    amountPaise,
    currency,
    referenceId,
    description: `Order payment · ${step.shop_id}`,
    customerName,
    customerEmail,
    callbackUrl,
    notes: {
      payment_step_id: String(step.id),
      shop_id: String(step.shop_id ?? ''),
      checkout_group_id: String(step.checkout_group_id ?? ''),
      buyer_id: String(user.id),
    },
  })

  await admin
    .from('commerce_checkout_payment_steps')
    .update({
      checkout_url: link.short_url,
      provider: 'razorpay',
      provider_reference: link.id,
      status: 'requires_action',
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.id)

  return jsonResponse({
    checkout_url: link.short_url,
    payment_link_id: link.id,
    payment_step_id: step.id,
    key_id: credentials.key_id,
  })
})
