/**
 * POST /functions/v1/shepay-release-pending
 *
 * After a vendor connects SHEPay child merchant credentials, attach child keys
 * to awaiting_child holds and attempt eligibility-based release (delivery +
 * return window + no dispute) via shepay-release-settlement logic.
 *
 * Body: { shopId }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { resolvePayuCredentials } from '../_shared/payu.ts'
import { childFromAccountMetadata } from '../_shared/payu-child.ts'

type Body = { shopId: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const creds = resolvePayuCredentials()
  if (!supabaseUrl || !anonKey || !serviceRole || !creds) {
    return jsonResponse({ error: 'SHEPay release not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const isServiceRole = authHeader === `Bearer ${serviceRole}`
  let userId: string | null = null
  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)
    userId = user.id
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const shopId = String(body.shopId ?? '').trim()
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: shop } = await admin
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Shop not found' }, 404)
  if (!isServiceRole && userId) {
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (shop.user_id !== userId && caller?.role !== 'A') {
      return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)
    }
  }

  const { data: account } = await admin
    .from('shop_payment_accounts')
    .select('metadata, status')
    .eq('shop_id', shopId)
    .eq('provider', 'payu')
    .eq('status', 'connected')
    .maybeSingle()

  const accountMeta =
    account?.metadata && typeof account.metadata === 'object'
      ? (account.metadata as Record<string, unknown>)
      : {}
  const child = childFromAccountMetadata(accountMeta)
  if (!child || child.merchantKey === creds.key) {
    return jsonResponse(
      {
        ok: false,
        error: 'Connect a valid SHEPay child merchant key and Child MID first.',
      },
      400,
    )
  }

  // Attach child credentials to holds waiting for a child merchant.
  const { data: awaiting, error: awaitingError } = await admin
    .from('shepay_pending_settlements')
    .select('id')
    .eq('shop_id', shopId)
    .in('status', ['pending', 'failed'])
    .eq('hold_reason', 'awaiting_child')
    .limit(100)

  if (awaitingError) return jsonResponse({ error: awaitingError.message }, 500)

  if (awaiting?.length) {
    const now = new Date().toISOString()
    await admin
      .from('shepay_pending_settlements')
      .update({
        child_merchant_key: child.merchantKey,
        child_mid: child.childMid,
        hold_reason: 'awaiting_release_window',
        updated_at: now,
        error_message: null,
      })
      .eq('shop_id', shopId)
      .in('status', ['pending', 'failed'])
      .eq('hold_reason', 'awaiting_child')
  }

  // Delegate release to eligibility-gated function (does not force immediate payout).
  const releaseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-release-settlement`
  const releaseRes = await fetch(releaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({ shopId, limit: 50 }),
  })
  const releaseJson = (await releaseRes.json().catch(() => ({}))) as Record<string, unknown>

  return jsonResponse({
    ok: releaseRes.ok,
    attached_child: awaiting?.length ?? 0,
    child_merchant_key: child.merchantKey,
    child_mid: child.childMid,
    release: releaseJson,
  }, releaseRes.ok ? 200 : 502)
})
