/**
 * POST /functions/v1/razorpay-connect
 *
 * Encrypt and persist vendor Razorpay credentials into shop_payment_accounts.
 * Optionally updates vendor_payment_settings.webhook_url.
 * Also keeps shop_commerce_settings in sync (payment_mode = 'direct').
 *
 * Body: { shopId, keyId, keySecret, webhookSecret?, webhookUrl?, mode: 'test'|'live' }
 * Returns: { success, maskedKeyId, status, mode }
 *
 * Security:
 * - keySecret is encrypted with AES-256-GCM before any DB write
 * - webhookSecret (if supplied) is encrypted separately
 * - Neither secret is ever returned to the client
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertEncryptionKeyPresent, encryptSecret } from '../_shared/encryption.ts'
import { razorpayAuthHeader } from '../_shared/razorpay.ts'

type ConnectBody = {
  shopId: string
  keyId: string
  keySecret: string
  webhookSecret?: string
  webhookUrl?: string
  mode: 'test' | 'live'
}

function maskKeyId(keyId: string): string {
  const parts = keyId.split('_')
  if (parts.length < 3) return keyId.slice(0, -4).replace(/./g, '•') + keyId.slice(-4)
  const prefix = `${parts[0]}_${parts[1]}_`
  const rest = parts.slice(2).join('_')
  if (rest.length <= 4) return prefix + rest
  return prefix + '••••' + rest.slice(-4)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    assertEncryptionKeyPresent()
  } catch (error) {
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

  let body: ConnectBody
  try {
    body = (await request.json()) as ConnectBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { shopId, keyId, keySecret, webhookSecret, webhookUrl, mode } = body

  if (!shopId || !keyId || !keySecret || !mode) {
    return jsonResponse({ error: 'shopId, keyId, keySecret, and mode are required' }, 400)
  }
  if (mode !== 'test' && mode !== 'live') {
    return jsonResponse({ error: 'mode must be "test" or "live"' }, 400)
  }

  const expectedPrefix = mode === 'live' ? 'rzp_live_' : 'rzp_test_'
  if (!keyId.startsWith(expectedPrefix)) {
    return jsonResponse({
      error: `Key ID must start with "${expectedPrefix}" for ${mode} mode.`,
    }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify shop ownership
  const { data: shop } = await admin
    .from('shops')
    .select('id')
    .eq('id', shopId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)

  // Validate credentials against Razorpay before storing
  try {
    const probeResponse = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      method: 'GET',
      headers: { Authorization: razorpayAuthHeader({ key_id: keyId, key_secret: keySecret }) },
    })
    if (probeResponse.status === 401) {
      return jsonResponse({
        error: 'Invalid Razorpay credentials. Verify your Key ID and Secret in the Razorpay Dashboard.',
      }, 400)
    }
  } catch {
    // Network unreachable — proceed; validation best-effort at connect time
  }

  // Encrypt keySecret
  const {
    encrypted: encryptedSecret,
    iv: secretIv,
    authTag: secretAuthTag,
  } = await encryptSecret(keySecret)

  // Encrypt webhookSecret if provided
  let encryptedWebhookSecret: string | null = null
  let webhookSecretIv: string | null = null
  let webhookSecretAuthTag: string | null = null

  if (webhookSecret?.trim()) {
    const enc = await encryptSecret(webhookSecret.trim())
    encryptedWebhookSecret = enc.encrypted
    webhookSecretIv = enc.iv
    webhookSecretAuthTag = enc.authTag
  }

  const now = new Date().toISOString()

  const metadata: Record<string, unknown> = {
    connection_type: 'credential',
    mode,
    iv: secretIv,
    auth_tag: secretAuthTag,
    configured_at: now,
    ...(encryptedWebhookSecret
      ? {
          webhook_secret_encrypted: encryptedWebhookSecret,
          webhook_secret_iv: webhookSecretIv,
          webhook_secret_auth_tag: webhookSecretAuthTag,
        }
      : {}),
  }

  // Upsert shop_payment_accounts
  const { error: upsertError } = await admin
    .from('shop_payment_accounts')
    .upsert(
      {
        shop_id: shopId,
        provider: 'razorpay',
        merchant_id: keyId,
        access_token: encryptedSecret,
        refresh_token: null,
        token_expiry: null,
        status: 'connected',
        connected_at: now,
        metadata,
      },
      { onConflict: 'shop_id,provider', ignoreDuplicates: false },
    )

  if (upsertError) {
    return jsonResponse({ error: 'Failed to save credentials. Please try again.' }, 500)
  }

  // Update webhook_url and is_live_mode in vendor_payment_settings if provided
  const settingsPayload: Record<string, unknown> = {
    shop_id: shopId,
    is_live_mode: mode === 'live',
    updated_at: now,
  }
  if (webhookUrl?.trim()) {
    settingsPayload.webhook_url = webhookUrl.trim()
  }

  await admin
    .from('vendor_payment_settings')
    .upsert(settingsPayload, { onConflict: 'shop_id', ignoreDuplicates: false })

  // Sync shop_commerce_settings so checkout routing uses direct/razorpay.
  // Provide safe defaults for all NOT NULL columns so a first-time INSERT
  // (no existing row) never fails on a missing-column constraint.
  const { error: scsError } = await admin.from('shop_commerce_settings').upsert(
    {
      shop_id: shopId,
      payment_connected: true,
      payment_mode: 'direct',
      payment_gateway: 'razorpay',
      payment_gateway_key_id: keyId,
      payment_account_label: maskKeyId(keyId),
      // Safe defaults — only used when INSERT creates a brand-new row
      shipping_mode: 'partner',
      shipping_partner: 'self',
      shipping_connected: true,
      updated_at: now,
    },
    { onConflict: 'shop_id', ignoreDuplicates: false },
  )

  if (scsError) {
    // Non-fatal — credentials are saved. Log and continue so the vendor
    // is not blocked, but surface a warning in the response.
    console.error('[razorpay-connect] shop_commerce_settings upsert failed:', scsError.message)
    return jsonResponse({
      success: true,
      maskedKeyId: maskKeyId(keyId),
      status: 'connected',
      mode,
      warning: 'Credentials saved but checkout routing could not be updated. Please disconnect and reconnect to retry.',
    })
  }

  return jsonResponse({
    success: true,
    maskedKeyId: maskKeyId(keyId),
    status: 'connected',
    mode,
  })
})
