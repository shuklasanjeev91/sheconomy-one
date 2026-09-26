/**
 * POST /functions/v1/shepay-release-pending
 *
 * After a vendor connects SHEPay child merchant credentials, release any amounts
 * that were held on the platform parent from earlier paid checkouts.
 *
 * Body: { shopId }
 * Returns: { ok, released, failed, results }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { resolvePayuCredentials } from '../_shared/payu.ts'
import { childFromAccountMetadata } from '../_shared/payu-child.ts'
import {
  createAbsolutePaymentSplit,
  releasePayuSettlement,
} from '../_shared/payu-split.ts'

type Body = { shopId: string }

function formatAmount(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return (Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).toFixed(2)
}

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

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: shop } = await admin
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Shop not found' }, 404)
  const { data: caller } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (shop.user_id !== user.id && caller?.role !== 'A') {
    return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)
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
    return jsonResponse({
      ok: false,
      error: 'Connect a valid SHEPay child merchant key and Child MID first.',
    }, 400)
  }

  const { data: pending, error: pendingError } = await admin
    .from('shepay_pending_settlements')
    .select('id, payu_id, amount, currency, status')
    .eq('shop_id', shopId)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(50)

  if (pendingError) return jsonResponse({ error: pendingError.message }, 500)
  if (!pending?.length) {
    return jsonResponse({ ok: true, released: 0, failed: 0, results: [] })
  }

  const results: Array<{ id: string; payuId: string; ok: boolean; error?: string }> = []
  let released = 0
  let failed = 0

  for (const row of pending) {
    const now = new Date().toISOString()
    await admin
      .from('shepay_pending_settlements')
      .update({ status: 'releasing', updated_at: now, error_message: null })
      .eq('id', row.id)

    const amount = formatAmount(row.amount)
    const subTxnId = `hold_${String(row.id).replace(/-/g, '').slice(0, 16)}_${Date.now().toString(36)}`
    const split = await createAbsolutePaymentSplit(creds, row.payu_id, [
      {
        merchantKey: child.merchantKey,
        childMid: child.childMid,
        subTxnId,
        amount,
      },
    ])

    if (!split.ok) {
      failed += 1
      const err = split.error ?? 'payment_split failed'
      results.push({ id: row.id, payuId: row.payu_id, ok: false, error: err })
      await admin
        .from('shepay_pending_settlements')
        .update({
          status: 'failed',
          error_message: err,
          release_payload: { split },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      continue
    }

    const release = await releasePayuSettlement(creds, row.payu_id, child.childMid)
    if (!release.ok) {
      failed += 1
      const err = release.error ?? 'release_settlement failed'
      results.push({ id: row.id, payuId: row.payu_id, ok: false, error: err })
      await admin
        .from('shepay_pending_settlements')
        .update({
          status: 'failed',
          error_message: err,
          release_payload: { split, release },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      continue
    }

    released += 1
    results.push({ id: row.id, payuId: row.payu_id, ok: true })
    await admin
      .from('shepay_pending_settlements')
      .update({
        status: 'released',
        child_merchant_key: child.merchantKey,
        child_mid: child.childMid,
        release_payload: { split, release },
        released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', row.id)

    await admin.from('payment_logs').insert({
      shop_id: shopId,
      event_type: 'settlement',
      status: 'completed',
      provider: 'payu',
      transaction_id: row.payu_id,
      amount: Number(amount),
      currency: row.currency ?? 'INR',
      payload: {
        released_from_hold: true,
        payuId: row.payu_id,
        childMid: child.childMid,
        amount,
      },
    })
  }

  return jsonResponse({ ok: failed === 0, released, failed, results })
})
