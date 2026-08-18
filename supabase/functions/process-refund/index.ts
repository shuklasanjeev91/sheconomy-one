import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  cancelRefundTransaction,
  resolvePlatformPayuCredentials,
} from '../_shared/platform-payu.ts'

type Body = {
  refund_id?: string
  limit?: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Refund processor not configured' }, 503)
  }

  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
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

  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50)

  let refundQuery = admin
    .from('refunds')
    .select(
      `
      id,
      order_item_id,
      refund_amount,
      refund_status,
      refund_kind,
      gateway_refund_request_id,
      gateway_refund_status,
      order_items!inner (
        id,
        order_id,
        product_title,
        total_price
      )
    `,
    )
    .in('refund_status', ['approved', 'processing'])
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (body.refund_id) {
    refundQuery = admin
      .from('refunds')
      .select(
        `
        id,
        order_item_id,
        refund_amount,
        refund_status,
        refund_kind,
        gateway_refund_request_id,
        gateway_refund_status,
        order_items!inner (
          id,
          order_id,
          product_title,
          total_price
        )
      `,
      )
      .eq('id', body.refund_id)
      .limit(1)
  }

  const { data: refunds, error } = await refundQuery
  if (error) return jsonResponse({ error: error.message }, 500)
  if (!refunds?.length) return jsonResponse({ ok: true, processed: 0 })

  const creds = resolvePlatformPayuCredentials()
  const results: Array<Record<string, unknown>> = []

  for (const row of refunds) {
    const refund = row as Record<string, unknown>
    const itemRaw = refund.order_items
    const item = (Array.isArray(itemRaw) ? itemRaw[0] : itemRaw) as Record<string, unknown> | null
    const orderId = item?.order_id ? String(item.order_id) : null
    const refundId = String(refund.id)

    if (String(refund.refund_status) === 'completed') {
      results.push({ refund_id: refundId, skipped: true, reason: 'already_completed' })
      continue
    }

    if (refund.gateway_refund_request_id && String(refund.gateway_refund_status) === 'success') {
      await admin
        .from('refunds')
        .update({
          refund_status: 'completed',
          completed_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId)
      results.push({ refund_id: refundId, completed: true, reason: 'already_gateway_success' })
      continue
    }

    if (!orderId) {
      results.push({ refund_id: refundId, error: 'missing_order' })
      continue
    }

    const { data: payment } = await admin
      .from('order_payments')
      .select('id, payment_mode, payment_status, gateway_transaction_id, transaction_id, amount')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const mode = String(payment?.payment_mode ?? '').toLowerCase()
    const isCod = mode === 'cod' || mode === 'cash_on_delivery'
    const mihpayid = payment?.gateway_transaction_id
      ? String(payment.gateway_transaction_id).trim()
      : ''

    if (isCod || !mihpayid) {
      await admin
        .from('refunds')
        .update({
          refund_status: 'completed',
          gateway_refund_status: isCod ? 'cod_no_capture' : 'no_gateway_id',
          completed_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId)

      await maybeMarkPaymentRefunded(admin, orderId)
      await notifyRefundCompleted(admin, refundId, orderId, item)
      results.push({
        refund_id: refundId,
        completed: true,
        mode: isCod ? 'cod' : 'no_mihpayid',
      })
      continue
    }

    if (!creds) {
      results.push({ refund_id: refundId, error: 'platform_payu_credentials_missing' })
      continue
    }

    const amount = Number(refund.refund_amount ?? item?.total_price ?? 0)
    const tokenId = `rf_${refundId.replace(/-/g, '').slice(0, 20)}_${Date.now().toString(36)}`

    const payu = await cancelRefundTransaction({
      creds,
      mihpayid,
      tokenId,
      amount,
    })

    await admin
      .from('refunds')
      .update({
        gateway_refund_request_id: payu.requestId ?? tokenId,
        gateway_refund_status: payu.status,
        refund_transaction_id: payu.requestId ?? tokenId,
        refund_status: payu.ok ? 'completed' : 'processing',
        completed_at: payu.ok ? new Date().toISOString() : null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        detailed_reason: payu.ok
          ? undefined
          : `${String(refund.detailed_reason ?? '')} | PayU: ${payu.message}`.slice(0, 2000),
      })
      .eq('id', refundId)

    if (payu.ok) {
      await maybeMarkPaymentRefunded(admin, orderId)
      await notifyRefundCompleted(admin, refundId, orderId, item)
    }

    results.push({
      refund_id: refundId,
      ok: payu.ok,
      request_id: payu.requestId,
      message: payu.message,
    })
  }

  return jsonResponse({ ok: true, processed: results.length, results })
})

async function maybeMarkPaymentRefunded(
  admin: ReturnType<typeof createClient>,
  orderId: string,
) {
  const { data: items } = await admin
    .from('order_items')
    .select('id, item_status')
    .eq('order_id', orderId)

  const open = (items ?? []).some(
    (row) => !['cancelled', 'refunded', 'returned'].includes(String(row.item_status)),
  )
  if (open) return

  await admin
    .from('order_payments')
    .update({ payment_status: 'refunded', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('payment_status', 'completed')
}

async function notifyRefundCompleted(
  admin: ReturnType<typeof createClient>,
  refundId: string,
  orderId: string,
  item: Record<string, unknown> | null,
) {
  try {
    const { data: order } = await admin
      .from('orders')
      .select('id, user_id, order_number, currency')
      .eq('id', orderId)
      .maybeSingle()
    if (!order?.user_id) return

    const { data: refund } = await admin
      .from('refunds')
      .select('refund_amount')
      .eq('id', refundId)
      .maybeSingle()

    const amount = Number(refund?.refund_amount ?? 0).toFixed(2)
    const currency = String(order.currency ?? 'INR')
    await admin.rpc('create_notification_from_template', {
      p_template_key: 'order_refund_completed_buyer',
      p_recipient_id: order.user_id,
      p_variables: {
        buyer_name: 'there',
        product_name: String(item?.product_title ?? 'your item'),
        order_number: order.order_number,
        refund_amount: `${amount} ${currency}`,
        action_url: `https://sheconomy.in/orders/${orderId}`,
      },
      p_context_type: 'order',
      p_context_id: orderId,
    })
  } catch {
    // Notification failure must not block refund completion.
  }
}
