/**
 * POST /functions/v1/shepay-hub-config
 *
 * Admin or service-role. Manage the platform PayU Hub OAuth client used to
 * auto-register seller child merchants. Payment gateway key/salt alone cannot
 * create children — Hub client_id/secret is a separate PayU provisioning step.
 *
 * Actions:
 *  - status
 *  - save { clientId, clientSecret, parentMid? }
 *  - test
 *  - email_kam — ask PayU KAM to enable Hub / send credentials
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertEncryptionKeyPresent, encryptSecret } from '../_shared/encryption.ts'
import { sendResendEmail } from '../_shared/resend.ts'
import {
  getPayuHubToken,
  payuHubNotConfiguredMessage,
  resolvePayuHubConfig,
  resolvePayuHubConfigAsync,
} from '../_shared/payu-hub.ts'

type Body = {
  action?: string
  clientId?: string
  clientSecret?: string
  parentMid?: string
}

const PAYU_KAM_EMAIL = 'rajat.gupta@payu.in'
const PAYU_KAM_CC = ['support@sheconomy.in', 'sanjeev.shukla@sheconomy.in']
const HUB_REQUEST_FROM = 'Sanjeev Shukla <sanjeev.shukla@sheconomy.in>'
const HUB_REQUEST_REPLY_TO = 'sanjeev.shukla@sheconomy.in'

function maskId(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
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

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const isService = authHeader === `Bearer ${serviceRole}`
  let userId: string | null = null
  if (!isService) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)
    userId = user.id
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'A') return jsonResponse({ error: 'Forbidden' }, 403)
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const action = String(body.action ?? 'status').trim()
  const gatewayConfigured = Boolean(
    (Deno.env.get('PAYU_LIVE_MERCHANT_KEY') || Deno.env.get('PAYU_MERCHANT_KEY')) &&
      (Deno.env.get('PAYU_LIVE_MERCHANT_SALT') || Deno.env.get('PAYU_MERCHANT_SALT')) &&
      (Deno.env.get('PAYU_LIVE_MID') || Deno.env.get('PAYU_PARENT_MID')),
  )

  if (action === 'status') {
    const hub = await resolvePayuHubConfigAsync(admin)
    const { data: row } = await admin
      .from('platform_payu_hub_config')
      .select('client_id, parent_mid, updated_at, last_verified_at')
      .eq('id', 1)
      .maybeSingle()
    const envConfigured = Boolean(resolvePayuHubConfig())
    return jsonResponse({
      ok: true,
      configured: Boolean(hub),
      gatewayConfigured,
      source: hub?.source ?? null,
      envConfigured,
      databaseConfigured: Boolean(row),
      clientIdMasked: hub ? maskId(hub.clientId) : row?.client_id ? maskId(String(row.client_id)) : null,
      parentMid: hub?.parentMid ?? row?.parent_mid ?? Deno.env.get('PAYU_LIVE_MID') ?? null,
      updatedAt: row?.updated_at ?? null,
      lastVerifiedAt: row?.last_verified_at ?? null,
      hint: hub
        ? null
        : gatewayConfigured
          ? 'Checkout PayU gateway is live. Seller child-merchant registration still needs Hub client id/secret from PayU (separate from merchant key/salt).'
          : payuHubNotConfiguredMessage(),
    })
  }

  if (action === 'email_kam') {
    const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
    if (!resendKey) return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 503)
    const parentMid = Deno.env.get('PAYU_LIVE_MID')?.trim() || '13665697'
    const subject = `SHEconomy aggregator — enable Hub My App / client credentials (MID ${parentMid})`
    const html = `
      <p>Hi Rajat,</p>
      <p>This is Sanjeev Shukla from SHEconomy (parent MID <strong>${parentMid}</strong>).
      We already have live PayU payment gateway credentials (merchant key / salt) and collect seller KYC in-app
      for our one-checkout marketplace.</p>
      <p>Please enable <strong>Partner Dashboard → My App</strong> (or email Hub OAuth credentials) so we can
      auto-create child merchants via API and absolute-split seller payouts after each checkout:</p>
      <ul>
        <li>Scopes: <code>refer_child_merchant</code>, <code>fetch_child_merchants</code></li>
        <li>Grant type: <code>client_credentials</code></li>
        <li>Client type: External</li>
        <li>Parent MID: <code>${parentMid}</code></li>
      </ul>
      <p>Please reply with <code>client_id</code> and <code>client_secret</code> (or confirm My App is enabled)
      to <a href="mailto:sanjeev.shukla@sheconomy.in">sanjeev.shukla@sheconomy.in</a>.</p>
      <p>Thanks,<br/>Sanjeev Shukla<br/>SHEconomy<br/>sanjeev.shukla@sheconomy.in</p>
    `
    try {
      await sendResendEmail(resendKey, {
        to: PAYU_KAM_EMAIL,
        from: HUB_REQUEST_FROM,
        replyTo: HUB_REQUEST_REPLY_TO,
        cc: PAYU_KAM_CC,
        subject,
        html,
        text: `Please enable Hub My App / send client_id + client_secret for MID ${parentMid} (scopes refer_child_merchant, fetch_child_merchants). Reply to sanjeev.shukla@sheconomy.in.`,
      })
      return jsonResponse({
        ok: true,
        emailedTo: PAYU_KAM_EMAIL,
        message: `Requested Hub credentials from PayU (${PAYU_KAM_EMAIL}).`,
      })
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Could not email PayU KAM' },
        502,
      )
    }
  }

  if (action === 'test') {
    const hub = await resolvePayuHubConfigAsync(admin)
    if (!hub) return jsonResponse({ error: payuHubNotConfiguredMessage() }, 503)
    try {
      await getPayuHubToken(hub, 'refer_child_merchant', admin)
      await getPayuHubToken(hub, 'fetch_child_merchants', admin)
      if (hub.source === 'database') {
        await admin
          .from('platform_payu_hub_config')
          .update({ last_verified_at: new Date().toISOString() })
          .eq('id', 1)
      }
      return jsonResponse({
        ok: true,
        source: hub.source,
        clientIdMasked: maskId(hub.clientId),
        parentMid: hub.parentMid,
        message: 'Hub token OK for refer_child_merchant and fetch_child_merchants.',
      })
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : 'Hub token test failed',
        },
        400,
      )
    }
  }

  if (action === 'save') {
    try {
      assertEncryptionKeyPresent()
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Encryption key missing' },
        503,
      )
    }

    const clientId = String(body.clientId ?? '').trim()
    const clientSecret = String(body.clientSecret ?? '').trim()
    const parentMid = String(body.parentMid ?? '').trim() || parentMidFromEnvFallback()
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'clientId and clientSecret are required' }, 400)
    }
    if (!parentMid) {
      return jsonResponse(
        { error: 'parentMid is required (or set PAYU_LIVE_MID on Edge secrets)' },
        400,
      )
    }

    // Verify before persisting — one Hub app for the whole marketplace.
    const probe = {
      clientId,
      clientSecret,
      parentMid,
      hubBaseUrl:
        Deno.env.get('PAYU_HUB_BASE_URL')?.replace(/\/$/, '').trim() || 'https://accounts.payu.in',
      onboardingBaseUrl:
        Deno.env.get('PAYU_ONBOARDING_BASE_URL')?.replace(/\/$/, '').trim() ||
        'https://onboarding.payu.in',
      source: 'database' as const,
    }
    try {
      await getPayuHubToken(probe, 'refer_child_merchant')
      await getPayuHubToken(probe, 'fetch_child_merchants')
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? `Hub credentials rejected: ${error.message}`
              : 'Hub credentials rejected',
        },
        400,
      )
    }

    const enc = await encryptSecret(clientSecret)
    const now = new Date().toISOString()
    const { error } = await admin.from('platform_payu_hub_config').upsert(
      {
        id: 1,
        client_id: clientId,
        client_secret_ciphertext: enc.encrypted,
        client_secret_iv: enc.iv,
        client_secret_tag: enc.authTag,
        parent_mid: parentMid,
        updated_by: userId,
        updated_at: now,
        last_verified_at: now,
      },
      { onConflict: 'id' },
    )
    if (error) return jsonResponse({ error: error.message }, 500)

    // Drop stale tokens so the next registration uses the new client.
    await admin
      .from('platform_payu_hub_tokens')
      .delete()
      .in('scope', ['refer_child_merchant', 'fetch_child_merchants'])

    // Auto-register every submitted seller as a PayU child merchant.
    const { data: pending } = await admin
      .from('shop_payu_kyc')
      .select('shop_id')
      .eq('status', 'submitted')
      .limit(200)

    let autoRegistered = 0
    for (const row of pending ?? []) {
      const shopId = String((row as { shop_id?: string }).shop_id ?? '').trim()
      if (!shopId) continue
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/shepay-create-child`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRole}`,
            apikey: serviceRole,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shopId }),
        })
        if (res.ok) autoRegistered += 1
      } catch {
        // Continue remaining shops — failures stay in submitted / Setup errors.
      }
    }

    return jsonResponse({
      ok: true,
      source: 'database',
      clientIdMasked: maskId(clientId),
      parentMid,
      autoRegistered,
      message:
        autoRegistered > 0
          ? `PayU connected. Auto-registered ${autoRegistered} seller${autoRegistered === 1 ? '' : 's'}.`
          : 'PayU connected. New sellers register automatically on submit.',
    })
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400)
})

function parentMidFromEnvFallback(): string {
  return (
    Deno.env.get('PAYU_LIVE_MID')?.trim() ||
    Deno.env.get('PAYU_PARENT_MID')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_MID')?.trim() ||
    ''
  )
}
