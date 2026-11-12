/**
 * POST /functions/v1/admin-ops
 * Staff JWT required (profiles.role in A/F/S/L depending on action).
 *
 * Actions:
 *  - search_orders { query }
 *  - retry_split { settlementId }
 *  - resync_shipment { orderId | deliveryId | awb }
 *  - manual_release { settlementId, reason? }
 *  - list_sellers { limit? }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { captureEdgeException } from '../_shared/sentry.ts'
import { resolvePayuCredentials } from '../_shared/payu.ts'
import { childFromAccountMetadata } from '../_shared/payu-child.ts'
import {
  createAbsolutePaymentSplit,
  releasePayuSettlement,
} from '../_shared/payu-split.ts'

type Body = {
  action?: string
  query?: string
  settlementId?: string
  orderId?: string
  deliveryId?: string
  awb?: string
  reason?: string
  limit?: number
}

const STAFF = new Set(['A', 'F', 'S', 'L'])

function formatAmount(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return (Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).toFixed(2)
}

async function audit(
  admin: ReturnType<typeof createClient>,
  adminId: string,
  action: string,
  details: Record<string, unknown>,
  request: Request,
) {
  await admin.rpc('log_admin_action_as', {
    p_admin_id: adminId,
    p_action: action,
    p_details: details,
    p_ip_address: request.headers.get('x-forwarded-for') ?? null,
    p_user_agent: request.headers.get('user-agent') ?? null,
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Admin ops not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const action = String(body.action ?? '').trim()
  if (!action) return jsonResponse({ error: 'action required' }, 400)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  const role = String(profile?.role ?? '')
  if (!STAFF.has(role)) return jsonResponse({ error: 'Forbidden' }, 403)

  try {
    if (action === 'search_orders') {
      const q = String(body.query ?? '').trim()
      if (q.length < 3) return jsonResponse({ error: 'query too short' }, 400)

      const [byNumber, byPayu, byAwb] = await Promise.all([
        admin
          .from('orders')
          .select('id, order_number, order_status, total_amount, currency, created_at, user_id')
          .ilike('order_number', `%${q}%`)
          .limit(20),
        admin
          .from('shepay_pending_settlements')
          .select(
            'id, order_id, payu_id, txnid, amount, status, hold_reason, split_status, shop_id',
          )
          .or(`payu_id.ilike.%${q}%,txnid.ilike.%${q}%`)
          .limit(20),
        admin
          .from('order_delivery')
          .select('id, order_id, awb_code, tracking_number, delivery_status')
          .or(`awb_code.ilike.%${q}%,tracking_number.ilike.%${q}%`)
          .limit(20),
      ])

      await audit(admin, user.id, 'admin.search_orders', { query: q }, request)
      return jsonResponse({
        ok: true,
        orders: byNumber.data ?? [],
        settlements: byPayu.data ?? [],
        deliveries: byAwb.data ?? [],
      })
    }

    if (action === 'list_sellers') {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 100)
      // payment_connected lives on shop_commerce_settings, not shops.
      const { data: shops, error: shopsError } = await admin
        .from('shops')
        .select('id, shop_name, slug, user_id, verified, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (shopsError) return jsonResponse({ error: shopsError.message }, 500)

      const shopIds = (shops ?? []).map((s) => s.id)
      const [
        { data: kyc, error: kycError },
        { data: credits, error: creditError },
        { data: commerce, error: commerceError },
        { data: disputes, error: disputesError },
      ] = await Promise.all([
        shopIds.length
          ? admin
              .from('shop_payu_kyc')
              .select('shop_id, status, payu_mid')
              .in('shop_id', shopIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
        shopIds.length
          ? admin
              .from('easyship_shipping_credits')
              .select('shop_id, balance_amount, currency, updated_at')
              .in('shop_id', shopIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
        shopIds.length
          ? admin
              .from('shop_commerce_settings')
              .select('shop_id, payment_connected')
              .in('shop_id', shopIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
        shopIds.length
          ? admin
              .from('order_issues')
              .select('id, order_items!inner(vendor_id)')
              .in('status', ['open', 'pending', 'in_progress', 'awaiting_vendor'])
              .limit(500)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      ])

      const sideError =
        kycError?.message ||
        creditError?.message ||
        commerceError?.message ||
        disputesError?.message
      if (sideError) return jsonResponse({ error: sideError }, 500)

      const kycBy = new Map((kyc ?? []).map((r) => [r.shop_id as string, r]))
      const creditBy = new Map((credits ?? []).map((r) => [r.shop_id as string, r]))
      const commerceBy = new Map((commerce ?? []).map((r) => [r.shop_id as string, r]))
      const disputeCount = new Map<string, number>()
      for (const row of disputes ?? []) {
        const items = row.order_items as unknown
        const vendorId =
          Array.isArray(items) && items[0] && typeof items[0] === 'object'
            ? String((items[0] as { vendor_id?: string }).vendor_id ?? '')
            : typeof items === 'object' && items
              ? String((items as { vendor_id?: string }).vendor_id ?? '')
              : ''
        if (!vendorId) continue
        disputeCount.set(vendorId, (disputeCount.get(vendorId) ?? 0) + 1)
      }

      const sellers = (shops ?? []).map((s) => ({
        ...s,
        payment_connected: Boolean(
          (commerceBy.get(s.id) as { payment_connected?: boolean } | undefined)
            ?.payment_connected,
        ),
        payu_kyc: kycBy.get(s.id) ?? null,
        easyship_shipping_credit: creditBy.get(s.id) ?? null,
        open_dispute_count: disputeCount.get(s.id) ?? 0,
      }))

      await audit(admin, user.id, 'admin.list_sellers', { count: sellers.length }, request)
      return jsonResponse({ ok: true, sellers })
    }

    if (action === 'retry_split' || action === 'manual_release') {
      if (role !== 'A' && role !== 'F') return jsonResponse({ error: 'Forbidden' }, 403)
      const settlementId = String(body.settlementId ?? '').trim()
      if (!settlementId) return jsonResponse({ error: 'settlementId required' }, 400)

      const creds = resolvePayuCredentials()
      if (!creds) return jsonResponse({ error: 'PayU credentials missing' }, 503)

      const { data: row, error } = await admin
        .from('shepay_pending_settlements')
        .select(
          'id, shop_id, order_id, payu_id, amount, currency, status, hold_reason, split_status, child_merchant_key, child_mid, sub_txn_id',
        )
        .eq('id', settlementId)
        .maybeSingle()
      if (error || !row) return jsonResponse({ error: error?.message ?? 'Not found' }, 404)

      const { data: account } = await admin
        .from('shop_payment_accounts')
        .select('metadata, child_merchant_key, child_mid')
        .eq('shop_id', row.shop_id)
        .maybeSingle()

      const childMeta = childFromAccountMetadata(account?.metadata ?? null)
      const merchantKey =
        row.child_merchant_key ||
        account?.child_merchant_key ||
        childMeta?.merchantKey ||
        null
      const childMid = row.child_mid || account?.child_mid || childMeta?.childMid || null
      if (!merchantKey || !childMid) {
        return jsonResponse({ error: 'Shop missing PayU child credentials' }, 400)
      }

      const amount = formatAmount(row.amount)
      const subTxnId = row.sub_txn_id || `sub_${row.id.replace(/-/g, '').slice(0, 20)}`

      if (action === 'retry_split' || row.split_status !== 'success') {
        const split = await createAbsolutePaymentSplit(creds, row.payu_id, [
          {
            merchantKey,
            childMid,
            subTxnId,
            amount,
          },
        ])
        if (!split.ok) {
          await admin
            .from('shepay_pending_settlements')
            .update({
              status: 'failed',
              error_message: split.error ?? 'payment_split failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          await audit(
            admin,
            user.id,
            'admin.retry_split_failed',
            { settlementId, error: split.error },
            request,
          )
          return jsonResponse({ ok: false, error: split.error ?? 'split failed' }, 502)
        }
        await admin
          .from('shepay_pending_settlements')
          .update({
            split_status: 'success',
            sub_txn_id: subTxnId,
            child_merchant_key: merchantKey,
            child_mid: childMid,
            split_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
      }

      if (action === 'manual_release') {
        const release = await releasePayuSettlement(creds, row.payu_id, childMid, subTxnId)
        if (!release.ok) {
          await audit(
            admin,
            user.id,
            'admin.manual_release_failed',
            { settlementId, error: release.error, reason: body.reason ?? null },
            request,
          )
          return jsonResponse({ ok: false, error: release.error ?? 'release failed' }, 502)
        }
        await admin
          .from('shepay_pending_settlements')
          .update({
            status: 'released',
            hold_reason: null,
            released_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
            release_payload: {
              manual: true,
              reason: body.reason ?? null,
              by: user.id,
            },
          })
          .eq('id', row.id)
        await audit(
          admin,
          user.id,
          'admin.manual_release',
          { settlementId, orderId: row.order_id, reason: body.reason ?? null },
          request,
        )
        return jsonResponse({ ok: true, action: 'manual_release', settlementId })
      }

      await audit(admin, user.id, 'admin.retry_split', { settlementId }, request)
      return jsonResponse({ ok: true, action: 'retry_split', settlementId })
    }

    if (action === 'run_reconciliation') {
      if (role !== 'A' && role !== 'F') return jsonResponse({ error: 'Forbidden' }, 403)
      const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
      if (!cronSecret) return jsonResponse({ error: 'Cron secret not configured' }, 503)
      const res = await fetch(`${supabaseUrl}/functions/v1/shepay-reconcile-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
        },
        body: JSON.stringify({
          limit: Math.min(Math.max(body.limit ?? 100, 1), 500),
          alert_threshold: 0.05,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      await audit(admin, user.id, 'admin.run_reconciliation', { status: res.status, payload }, request)
      if (!res.ok) {
        return jsonResponse(
          { ok: false, error: (payload as { error?: string }).error ?? 'Reconcile failed' },
          res.status,
        )
      }
      return jsonResponse({ ok: true, ...(payload as Record<string, unknown>) })
    }

    if (action === 'resync_shipment') {
      if (role !== 'A' && role !== 'L' && role !== 'S') {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }
      const deliveryId = String(body.deliveryId ?? '').trim()
      const orderId = String(body.orderId ?? '').trim()
      const awb = String(body.awb ?? '').trim()

      let query = admin
        .from('order_delivery')
        .select('id, order_id, delivery_status, delivery_metadata, tracking_number, awb_code')
        .limit(5)
      if (deliveryId) query = query.eq('id', deliveryId)
      else if (awb) query = query.or(`awb_code.eq.${awb},tracking_number.eq.${awb}`)
      else if (orderId) query = query.eq('order_id', orderId)
      else return jsonResponse({ error: 'orderId, deliveryId, or awb required' }, 400)

      const { data: rows, error } = await query
      if (error) return jsonResponse({ error: error.message }, 500)
      if (!rows?.length) return jsonResponse({ ok: true, updated: 0 })

      // Soft resync: stamp metadata so courier-track-sync / webhook can refresh.
      const now = new Date().toISOString()
      let updated = 0
      for (const row of rows) {
        const meta =
          row.delivery_metadata && typeof row.delivery_metadata === 'object'
            ? { ...(row.delivery_metadata as Record<string, unknown>) }
            : {}
        meta.admin_resync_requested_at = now
        meta.admin_resync_by = user.id
        const { error: upErr } = await admin
          .from('order_delivery')
          .update({ delivery_metadata: meta, updated_at: now })
          .eq('id', row.id)
        if (!upErr) updated += 1
      }

      // Nudge courier-track-sync if secret available
      const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
      if (cronSecret) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/courier-track-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': cronSecret,
            },
            body: JSON.stringify({
              orderId: orderId || rows[0]?.order_id,
              limit: 5,
            }),
          })
        } catch {
          // non-fatal
        }
      }

      await audit(
        admin,
        user.id,
        'admin.resync_shipment',
        { deliveryId, orderId, awb, updated },
        request,
      )
      return jsonResponse({ ok: true, updated })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    await captureEdgeException(error, {
      functionName: 'admin-ops',
      extra: { action },
    })
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Admin ops failed' },
      500,
    )
  }
})
