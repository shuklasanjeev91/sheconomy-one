/**
 * POST /functions/v1/shepay-release-settlement
 *
 * Release PayU settlements that are past delivery + return window with no open dispute.
 * Cron (x-cron-secret) or service-role.
 *
 * Body: { limit?: number, shopId?: string, settlementId?: string }
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

type Body = {
  limit?: number
  shopId?: string
  settlementId?: string
}

type PendingRow = {
  id: string
  shop_id: string
  order_id: string | null
  payu_id: string
  amount: number
  currency: string | null
  status: string
  hold_reason: string | null
  split_status: string | null
  child_merchant_key: string | null
  child_mid: string | null
  sub_txn_id: string | null
}

function formatAmount(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return (Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).toFixed(2)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
  const creds = resolvePayuCredentials()
  if (!supabaseUrl || !serviceRole || !creds) {
    return jsonResponse({ error: 'SHEPay release settlement not configured' }, 503)
  }

  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('Authorization')
  const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  const isService = Boolean(serviceRole && authHeader === `Bearer ${serviceRole}`)
  if (!isCron && !isService) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100)
  let query = admin
    .from('shepay_pending_settlements')
    .select(
      'id, shop_id, order_id, payu_id, amount, currency, status, hold_reason, split_status, child_merchant_key, child_mid, sub_txn_id',
    )
    .in('status', ['pending', 'failed'])
    .neq('hold_reason', 'refunded')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (body.settlementId) {
    query = admin
      .from('shepay_pending_settlements')
      .select(
        'id, shop_id, order_id, payu_id, amount, currency, status, hold_reason, split_status, child_merchant_key, child_mid, sub_txn_id',
      )
      .eq('id', body.settlementId)
      .limit(1)
  } else if (body.shopId) {
    query = query.eq('shop_id', body.shopId)
  }

  const { data: pending, error } = await query
  if (error) return jsonResponse({ error: error.message }, 500)
  if (!pending?.length) {
    return jsonResponse({ ok: true, released: 0, skipped: 0, failed: 0, results: [] })
  }

  const results: Array<Record<string, unknown>> = []
  let released = 0
  let skipped = 0
  let failed = 0

  for (const raw of pending) {
    const row = raw as PendingRow
    if (row.hold_reason === 'dispute' || row.hold_reason === 'refunded') {
      skipped += 1
      results.push({ id: row.id, skipped: true, reason: row.hold_reason })
      continue
    }

    if (row.order_id) {
      const { data: eligible, error: eligError } = await admin.rpc(
        'shepay_order_release_eligible',
        { p_order_id: row.order_id },
      )
      if (eligError) {
        failed += 1
        results.push({ id: row.id, ok: false, error: eligError.message })
        continue
      }
      if (!eligible) {
        skipped += 1
        results.push({ id: row.id, skipped: true, reason: 'not_eligible' })
        continue
      }
      const { data: disputed } = await admin.rpc('shepay_order_has_open_dispute', {
        p_order_id: row.order_id,
      })
      if (disputed) {
        await admin
          .from('shepay_pending_settlements')
          .update({ hold_reason: 'dispute', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        skipped += 1
        results.push({ id: row.id, skipped: true, reason: 'dispute' })
        continue
      }
    } else {
      // Without order_id we cannot verify delivery window — skip until backfilled.
      skipped += 1
      results.push({ id: row.id, skipped: true, reason: 'missing_order_id' })
      continue
    }

    let childKey = row.child_merchant_key
    let childMid = row.child_mid
    let subTxnId = row.sub_txn_id
    let splitStatus = row.split_status ?? 'not_split'

    if (!childKey || !childMid || childKey === creds.key) {
      const { data: account } = await admin
        .from('shop_payment_accounts')
        .select('metadata, status')
        .eq('shop_id', row.shop_id)
        .eq('provider', 'payu')
        .eq('status', 'connected')
        .maybeSingle()
      const accountMeta =
        account?.metadata && typeof account.metadata === 'object'
          ? (account.metadata as Record<string, unknown>)
          : {}
      const child = childFromAccountMetadata(accountMeta)
      if (!child || child.merchantKey === creds.key) {
        await admin
          .from('shepay_pending_settlements')
          .update({
            hold_reason: 'awaiting_child',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        skipped += 1
        results.push({ id: row.id, skipped: true, reason: 'awaiting_child' })
        continue
      }
      childKey = child.merchantKey
      childMid = child.childMid
    }

    await admin
      .from('shepay_pending_settlements')
      .update({
        status: 'releasing',
        child_merchant_key: childKey,
        child_mid: childMid,
        hold_reason: 'awaiting_release_window',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    const amount = formatAmount(row.amount)
    if (splitStatus !== 'split') {
      subTxnId =
        subTxnId ||
        `rel_${String(row.id).replace(/-/g, '').slice(0, 16)}_${Date.now().toString(36)}`
      const split = await createAbsolutePaymentSplit(creds, row.payu_id, [
        {
          merchantKey: childKey,
          childMid,
          subTxnId,
          amount,
        },
      ])
      if (!split.ok) {
        failed += 1
        const err = split.error ?? 'payment_split failed'
        await admin
          .from('shepay_pending_settlements')
          .update({
            status: 'failed',
            split_status: 'split_failed',
            error_message: err,
            split_payload: { split },
            sub_txn_id: subTxnId,
            child_merchant_key: childKey,
            child_mid: childMid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        results.push({ id: row.id, payuId: row.payu_id, ok: false, error: err })
        continue
      }
      splitStatus = 'split'
      await admin
        .from('shepay_pending_settlements')
        .update({
          split_status: 'split',
          split_at: new Date().toISOString(),
          split_payload: { split },
          sub_txn_id: subTxnId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }

    const release = await releasePayuSettlement(creds, row.payu_id, childMid)
    if (!release.ok) {
      failed += 1
      const err = release.error ?? 'release_settlement failed'
      await admin
        .from('shepay_pending_settlements')
        .update({
          status: 'failed',
          error_message: err,
          release_payload: { release },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      results.push({ id: row.id, payuId: row.payu_id, ok: false, error: err })
      continue
    }

    released += 1
    const now = new Date().toISOString()
    await admin
      .from('shepay_pending_settlements')
      .update({
        status: 'released',
        hold_reason: 'awaiting_release_window',
        child_merchant_key: childKey,
        child_mid: childMid,
        sub_txn_id: subTxnId,
        split_status: 'split',
        release_payload: { release },
        released_at: now,
        eligible_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq('id', row.id)

    await admin.from('payment_logs').insert({
      shop_id: row.shop_id,
      event_type: 'settlement',
      status: 'completed',
      provider: 'payu',
      transaction_id: row.payu_id,
      amount: Number(amount),
      currency: row.currency ?? 'INR',
      payload: {
        released_after_delivery_window: true,
        platform_fee_amount: 0,
        order_id: row.order_id,
        child_mid: childMid,
        sub_txn_id: subTxnId,
        release,
      },
    })

    results.push({ id: row.id, payuId: row.payu_id, ok: true })
  }

  return jsonResponse({ ok: true, released, skipped, failed, results })
})
