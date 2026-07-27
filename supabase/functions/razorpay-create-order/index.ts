/**
 * POST /functions/v1/razorpay-create-order
 *
 * Create a Razorpay order using the vendor's decrypted credentials.
 * Called at checkout by authenticated buyers.
 *
 * Body: { shopId, amount (paise), currency, receipt, notes? }
 * Returns: { razorpayOrderId, keyId, amount, currency, mode }
 *
 * Security:
 * - keySecret is decrypted server-side and never returned to client
 * - Only keyId is returned (needed for Razorpay Checkout SDK)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertEncryptionKeyPresent, decryptSecret } from '../_shared/encryption.ts'
import { razorpayAuthHeader } from '../_shared/razorpay.ts'

type CreateOrderBody = {
  shopId: string
  amount: number
  currency?: string
  receipt: string
  notes?: Record<string, string>
}

function maskShopId(id: string): string {
  if (id.length <= 8) return '****'
  return id.slice(0, 4) + '****' + id.slice(-4)
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

  let body: CreateOrderBody
  try {
    body = (await request.json()) as CreateOrderBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { shopId, amount, receipt, notes } = body
  const currency = (body.currency ?? 'INR').toUpperCase()

  if (!shopId || !amount || !receipt) {
    return jsonResponse({ error: 'shopId, amount, and receipt are required' }, 400)
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return jsonResponse({ error: 'amount must be a positive integer (paise)' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Fetch vendor credentials
  const { data: account } = await admin
    .from('shop_payment_accounts')
    .select('merchant_id, access_token, metadata, status')
    .eq('shop_id', shopId)
    .eq('provider', 'razorpay')
    .maybeSingle()

  if (!account || account.status !== 'connected') {
    return jsonResponse({ error: 'Vendor has not connected a payment method' }, 400)
  }

  const metadata = account.metadata as Record<string, unknown> | null
  const iv = typeof metadata?.iv === 'string' ? metadata.iv : null
  const authTag = typeof metadata?.auth_tag === 'string' ? metadata.auth_tag : null
  const encryptedSecret = account.access_token

  if (!iv || !authTag || !encryptedSecret) {
    return jsonResponse({ error: 'Payment credentials are incomplete. Contact the vendor.' }, 400)
  }

  let keySecret: string
  try {
    keySecret = await decryptSecret(encryptedSecret, iv, authTag)
  } catch {
    return jsonResponse({ error: 'Could not process payment credentials' }, 500)
  }

  const keyId = account.merchant_id
  const mode = typeof metadata?.mode === 'string' ? metadata.mode : 'live'

  // Create Razorpay order
  let rzpOrder: { id: string; amount: number; currency: string }
  try {
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthHeader({ key_id: keyId, key_secret: keySecret }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt,
        notes: notes ?? {},
        payment_capture: 1,
      }),
    })

    const rzpBody = (await rzpResponse.json()) as {
      id?: string
      amount?: number
      currency?: string
      error?: { description?: string; code?: string }
    }

    if (!rzpResponse.ok || !rzpBody.id) {
      const msg = rzpBody.error?.description ?? rzpBody.error?.code ?? `Razorpay error (${rzpResponse.status})`
      return jsonResponse({ error: msg }, 502)
    }

    rzpOrder = { id: rzpBody.id, amount: rzpBody.amount ?? amount, currency: rzpBody.currency ?? currency }
  } catch {
    return jsonResponse({ error: 'Could not reach Razorpay. Please try again.' }, 502)
  } finally {
    // Explicitly overwrite to avoid any chance of GC delay on sensitive data
    keySecret = ''
  }

  // Minimal audit log — no secrets
  console.log(`[razorpay-create-order] shop=${maskShopId(shopId)} amount=${amount} currency=${currency} order=${rzpOrder.id}`)

  return jsonResponse({
    razorpayOrderId: rzpOrder.id,
    keyId,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    mode,
  })
})
