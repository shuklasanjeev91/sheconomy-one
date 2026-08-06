/**
 * POST /functions/v1/shepay-sync-child
 *
 * Easy SHEPay setup for vendors:
 * - preview: contact hints + webhook + whether Hub auto-fetch is configured
 * - connect: look up child merchant on PayU (by shop id / email / phone),
 *   save key + MID + webhook, sync commerce routing, release held settlements
 *
 * Body: { shopId, action?: 'preview' | 'connect', email?: string, phone?: string }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  findPayuChildForShop,
  getPayuHubToken,
  resolvePayuHubConfig,
} from '../_shared/payu-hub.ts'

type Body = {
  shopId: string
  action?: 'preview' | 'connect'
  email?: string
  phone?: string
}

function platformWebhookUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-payu-webhook`
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const shopId = String(body.shopId ?? '').trim()
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)
  const action = body.action === 'connect' ? 'connect' : 'preview'

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: shop } = await admin
    .from('shops')
    .select('id, shop_name, shop_email, shop_phone_number, user_id')
    .eq('id', shopId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)

  const { data: profile } = await admin
    .from('profiles')
    .select('email, phone, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const email =
    String(body.email ?? '').trim() ||
    String(shop.shop_email ?? '').trim() ||
    String(profile?.email ?? user.email ?? '').trim() ||
    ''
  const phone =
    String(body.phone ?? '').trim() ||
    String(shop.shop_phone_number ?? '').trim() ||
    String(profile?.phone ?? '').trim() ||
    ''

  const webhookUrl = platformWebhookUrl(supabaseUrl)
  const onboardingUrl =
    Deno.env.get('PAYU_ONBOARDING_URL')?.trim() || 'https://onboarding.payu.in'
  const hub = resolvePayuHubConfig()
  const shopCode = shopId.replace(/-/g, '').slice(0, 16)

  const preview = {
    ok: true,
    action: 'preview' as const,
    hubConfigured: Boolean(hub),
    shopId,
    shopName: shop.shop_name,
    email,
    phone,
    shopCode,
    webhookUrl,
    onboardingUrl,
    hint:
      'Open PayU setup with the same email/phone shown here. When PayU asks for a shop code, use the code below. Then tap Fetch & activate.',
  }

  if (action === 'preview') {
    return jsonResponse(preview)
  }

  if (!hub) {
    return jsonResponse(
      {
        ...preview,
        ok: false,
        error:
          'Auto-fetch is not configured yet. Ask SHEconomy support to enable PayU Hub, or enter details manually.',
      },
      503,
    )
  }

  try {
    const token = await getPayuHubToken(hub, 'fetch_child_merchants')
    const child = await findPayuChildForShop(hub, token, { shopId, email, phone })
    if (!child) {
      return jsonResponse(
        {
          ...preview,
          ok: false,
          error:
            'We couldn’t find your PayU merchant yet. Finish PayU setup with this email/phone (and shop code if asked), then try again in a minute.',
        },
        404,
      )
    }

    const now = new Date().toISOString()
    const accountData = {
      shop_id: shopId,
      provider: 'payu',
      merchant_id: child.merchantKey,
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      status: 'connected',
      connected_at: now,
      updated_at: now,
      metadata: {
        connection_type: 'credential',
        mode: 'live',
        onboarded_via: 'sheconomy',
        auto_synced: true,
        child_merchant_key: child.merchantKey,
        merchant_key: child.merchantKey,
        child_mid: child.mid,
        child_uuid: child.uuid,
        child_email: child.email,
        onboarding_completed: child.onboardingCompleted,
        credentials: JSON.stringify({
          merchant_key: child.merchantKey,
          child_mid: child.mid,
          salt_key: 'platform',
          onboarded_via: 'sheconomy',
        }),
        configured_at: now,
      },
    }

    const { error: upsertError } = await admin
      .from('shop_payment_accounts')
      .upsert(accountData, { onConflict: 'shop_id,provider', ignoreDuplicates: false })
    if (upsertError) return jsonResponse({ error: upsertError.message }, 500)

    await admin.from('shop_commerce_settings').upsert(
      {
        shop_id: shopId,
        payment_mode: 'shepay',
        payment_gateway: 'payu',
        payment_connected: true,
        payment_account_label: child.merchantKey,
        updated_at: now,
      },
      { onConflict: 'shop_id' },
    )

    await admin.from('vendor_payment_settings').upsert(
      {
        shop_id: shopId,
        webhook_url: webhookUrl,
        updated_at: now,
      },
      { onConflict: 'shop_id' },
    )

    // Best-effort release of held settlements (same as connect path).
    try {
      await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-release-pending`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId }),
      })
    } catch {
      // non-fatal
    }

    return jsonResponse({
      ok: true,
      action: 'connect',
      connected: true,
      childMid: child.mid,
      merchantKeyMasked: `${child.merchantKey.slice(0, 2)}••••${child.merchantKey.slice(-2)}`,
      onboardingCompleted: child.onboardingCompleted,
      webhookUrl,
      email: child.email ?? email,
      shopName: shop.shop_name,
    })
  } catch (error) {
    return jsonResponse(
      {
        ...preview,
        ok: false,
        error: error instanceof Error ? error.message : 'Could not sync SHEPay details',
      },
      502,
    )
  }
})
