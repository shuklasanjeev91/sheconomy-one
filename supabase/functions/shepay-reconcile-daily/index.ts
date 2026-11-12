/**
 * POST /functions/v1/shepay-reconcile-daily
 * Cron (x-cron-secret) or service-role.
 * Compares local shepay_pending_settlements to PayU verify_payment.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payuMerchantCommand, resolvePayuCredentials } from '../_shared/payu.ts'
import { captureEdgeException } from '../_shared/sentry.ts'

type Body = {
  limit?: number
  alert_threshold?: number
}

type SettlementRow = {
  id: string
  shop_id: string
  order_id: string | null
  payu_id: string
  txnid: string | null
  amount: number
  status: string
  hold_reason: string | null
}

function remoteAmount(json: Record<string, unknown> | null, txnid: string | null): number | null {
  if (!json) return null
  const txnMap = json.transaction_details
  if (txnMap && typeof txnMap === 'object' && txnid) {
    const row = (txnMap as Record<string, unknown>)[txnid]
    if (row && typeof row === 'object') {
      const amt = Number((row as Record<string, unknown>).amt ?? (row as Record<string, unknown>).amount)
      if (Number.isFinite(amt)) return amt
    }
  }
  const amt = Number(json.amt ?? json.amount ?? json.transaction_amount)
  return Number.isFinite(amt) ? amt : null
}

function remoteStatus(json: Record<string, unknown> | null, txnid: string | null): string | null {
  if (!json) return null
  const txnMap = json.transaction_details
  if (txnMap && typeof txnMap === 'object' && txnid) {
    const row = (txnMap as Record<string, unknown>)[txnid]
    if (row && typeof row === 'object') {
      return String((row as Record<string, unknown>).status ?? '').toLowerCase() || null
    }
  }
  return String(json.status ?? '').toLowerCase() || null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
  const creds = resolvePayuCredentials()
  if (!supabaseUrl || !serviceRole || !creds) {
    return jsonResponse({ error: 'Reconcile not configured' }, 503)
  }

  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('Authorization')
  const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  const isService = Boolean(serviceRole && authHeader === `Bearer ${serviceRole}`)
  if (!isCron && !isService) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }

  const limit = Math.min(Math.max(body.limit ?? 200, 1), 500)
  const alertThreshold = Math.min(Math.max(body.alert_threshold ?? 0.05, 0), 1)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: run, error: runErr } = await admin
    .from('shepay_reconciliation_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  if (runErr || !run) {
    return jsonResponse({ error: runErr?.message ?? 'Could not start run' }, 500)
  }

  let matched = 0
  let mismatch = 0
  let missing = 0
  let checked = 0

  try {
    const { data: settlements, error } = await admin
      .from('shepay_pending_settlements')
      .select('id, shop_id, order_id, payu_id, txnid, amount, status, hold_reason')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    for (const row of (settlements ?? []) as SettlementRow[]) {
      checked += 1
      const lookupKey = (row.txnid || row.payu_id || '').trim()
      if (!lookupKey) {
        missing += 1
        await admin.from('shepay_reconciliation_rows').insert({
          run_id: run.id,
          settlement_id: row.id,
          order_id: row.order_id,
          shop_id: row.shop_id,
          payu_id: row.payu_id,
          txnid: row.txnid,
          result: 'missing',
          local_amount: row.amount,
          local_status: row.status,
          detail: { reason: 'no_payu_id_or_txnid' },
        })
        continue
      }

      const remote = await payuMerchantCommand(creds, 'verify_payment', { var1: lookupKey })
      const rAmt = remoteAmount(remote.json, row.txnid)
      const rStatus = remoteStatus(remote.json, row.txnid)

      if (!remote.ok || !remote.json || (rAmt == null && !rStatus)) {
        missing += 1
        await admin.from('shepay_reconciliation_rows').insert({
          run_id: run.id,
          settlement_id: row.id,
          order_id: row.order_id,
          shop_id: row.shop_id,
          payu_id: row.payu_id,
          txnid: row.txnid,
          result: 'missing',
          local_amount: row.amount,
          local_status: row.status,
          remote_amount: rAmt,
          remote_status: rStatus,
          detail: { http: remote.status, body: remote.text?.slice(0, 500) },
        })
        continue
      }

      const amountOk =
        rAmt == null || Math.abs(Number(rAmt) - Number(row.amount)) < 0.02
      // Local "released" should map to success/captured; pending may still be success at PayU (held).
      const statusOk =
        !rStatus ||
        rStatus === 'success' ||
        rStatus === 'captured' ||
        rStatus === 'pending' ||
        (row.status === 'released' && (rStatus === 'success' || rStatus === 'captured'))

      if (amountOk && statusOk) {
        matched += 1
        await admin.from('shepay_reconciliation_rows').insert({
          run_id: run.id,
          settlement_id: row.id,
          order_id: row.order_id,
          shop_id: row.shop_id,
          payu_id: row.payu_id,
          txnid: row.txnid,
          result: 'matched',
          local_amount: row.amount,
          remote_amount: rAmt,
          local_status: row.status,
          remote_status: rStatus,
        })
      } else {
        mismatch += 1
        await admin.from('shepay_reconciliation_rows').insert({
          run_id: run.id,
          settlement_id: row.id,
          order_id: row.order_id,
          shop_id: row.shop_id,
          payu_id: row.payu_id,
          txnid: row.txnid,
          result: 'mismatch',
          local_amount: row.amount,
          remote_amount: rAmt,
          local_status: row.status,
          remote_status: rStatus,
          detail: { amountOk, statusOk },
        })
      }
    }

    const mismatchRate = checked > 0 ? (mismatch + missing) / checked : 0
    let alertSent = false

    if (mismatchRate >= alertThreshold && (mismatch > 0 || missing > 0)) {
      const { data: admins } = await admin.from('profiles').select('id').eq('role', 'A').limit(20)
      for (const a of admins ?? []) {
        try {
          await admin.rpc('create_notification_idempotent', {
            p_template_key: 'shepay_recon_mismatch_admin',
            p_recipient_id: a.id,
            p_idempotency_key: `shepay_recon_mismatch:${run.id}:${a.id}`,
            p_variables: {
              mismatch_count: mismatch,
              missing_count: missing,
              matched_count: matched,
              mismatch_rate: (mismatchRate * 100).toFixed(2),
              run_id: run.id,
            },
            p_context_type: null,
            p_context_id: null,
            p_parent_context_type: null,
            p_parent_context_id: null,
            p_override_priority: 2,
            p_scheduled_for: null,
            p_source_system: 'shepay_reconcile_daily',
          })
        } catch {
          // template / prefs may skip
        }
      }
      alertSent = true
    }

    await admin
      .from('shepay_reconciliation_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        matched_count: matched,
        mismatch_count: mismatch,
        missing_count: missing,
        checked_count: checked,
        mismatch_rate: mismatchRate,
        alert_sent: alertSent,
      })
      .eq('id', run.id)

    return jsonResponse({
      ok: true,
      run_id: run.id,
      matched,
      mismatch,
      missing,
      checked,
      mismatch_rate: mismatchRate,
      alert_sent: alertSent,
    })
  } catch (error) {
    await captureEdgeException(error, { functionName: 'shepay-reconcile-daily' })
    await admin
      .from('shepay_reconciliation_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'failed',
        matched_count: matched,
        mismatch_count: mismatch,
        missing_count: missing,
        checked_count: checked,
      })
      .eq('id', run.id)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Reconcile failed' },
      500,
    )
  }
})
