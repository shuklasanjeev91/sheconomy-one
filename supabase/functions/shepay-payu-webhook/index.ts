import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { timingSafeEqual } from '../_shared/crypto-safe.ts'
import { payUResponseHash, resolvePayuCredentials, type PayuCredentials } from '../_shared/payu.ts'
import { childFromAccountMetadata } from '../_shared/payu-child.ts'
import {
  createAbsolutePaymentSplit,
  type PayuSplitChild,
} from '../_shared/payu-split.ts'

function pick(form: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    if (form[key] != null && String(form[key]).length) return String(form[key])
  }
  return ''
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await request.json()) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json)) out[k] = String(v ?? '')
    return out
  }
  const text = await request.text()
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  for (const [k, v] of params.entries()) out[k] = v
  return out
}

function collectCredentialCandidates(): PayuCredentials[] {
  const active = resolvePayuCredentials()
  const out: PayuCredentials[] = []
  if (active) out.push(active)

  const liveKey =
    Deno.env.get('PAYU_LIVE_MERCHANT_KEY')?.trim() || Deno.env.get('PAYU_MERCHANT_KEY')?.trim()
  const liveSalt =
    Deno.env.get('PAYU_LIVE_MERCHANT_SALT')?.trim() || Deno.env.get('PAYU_MERCHANT_SALT')?.trim()
  if (liveKey && liveSalt && !out.some((c) => c.key === liveKey && c.salt === liveSalt)) {
    out.push({
      mode: 'live',
      key: liveKey,
      salt: liveSalt,
      baseUrl: 'https://secure.payu.in',
    })
  }

  return out
}

function formatAmount(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return (Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).toFixed(2)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const candidates = collectCredentialCandidates()
  if (!candidates.length || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEPay webhook not configured' }, 503)
  }

  const form = await parseBody(request)
  const status = pick(form, 'status')
  const txnid = pick(form, 'txnid')
  const amount = pick(form, 'amount')
  const productinfo = pick(form, 'productinfo')
  const firstname = pick(form, 'firstname')
  const email = pick(form, 'email')
  const udf1 = pick(form, 'udf1')
  const udf2 = pick(form, 'udf2')
  const udf3 = pick(form, 'udf3')
  const udf4 = pick(form, 'udf4')
  const udf5 = pick(form, 'udf5')
  const hash = pick(form, 'hash')
  const mihpayid = pick(form, 'mihpayid', 'payuId', 'payu_id')

  let matched: PayuCredentials | null = null
  for (const cred of candidates) {
    const expected = await payUResponseHash(
      {
        key: cred.key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
        status,
      },
      cred.salt,
    )
    if (timingSafeEqual(expected, hash)) {
      matched = cred
      break
    }
  }

  if (!matched) {
    return jsonResponse({ error: 'Invalid PayU hash' }, 401)
  }

  const mappedStatus =
    status.toLowerCase() === 'success'
      ? 'paid'
      : status.toLowerCase() === 'failure' || status.toLowerCase() === 'failed'
        ? 'failed'
        : status.toLowerCase() === 'pending'
          ? 'processing'
          : 'processing'

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const shopIdForRpc = udf2 && udf2 !== 'bundle' ? udf2 : null

  const { data, error } = await admin.rpc('process_checkout_payment_webhook', {
    p_payment_step_id: udf1,
    p_shop_id: shopIdForRpc,
    p_provider: 'payu',
    p_webhook_id: mihpayid || `${txnid}:${status}`,
    p_event_type: `payu.${status}`,
    p_status: mappedStatus,
    p_provider_reference: mihpayid || txnid,
    p_payload: form,
  })

  if (error) return jsonResponse({ error: error.message }, 500)

  const rpcResult = (data ?? {}) as Record<string, unknown>
  if (rpcResult.duplicate === true) {
    return jsonResponse({
      ok: true,
      result: data,
      payu_env: matched.mode,
      split: { skipped: true, reason: 'duplicate_webhook' },
    })
  }

  // Paid: absolute split when child exists; always create pending hold rows. Never release here.
  let splitResult: unknown = null
  if (mappedStatus === 'paid' && mihpayid && udf1) {
    try {
      const { data: step } = await admin
        .from('commerce_checkout_payment_steps')
        .select('id, shop_id, amount, kind, metadata, checkout_group_id')
        .eq('id', udf1)
        .maybeSingle()

      const meta =
        step?.metadata && typeof step.metadata === 'object'
          ? (step.metadata as Record<string, unknown>)
          : {}
      const allocations = Array.isArray(meta.allocations) ? meta.allocations : null

      type ShopAlloc = { shopId: string; orderId: string | null; amount: number }
      const shopAllocs: ShopAlloc[] = []

      if (allocations && allocations.length) {
        for (const raw of allocations) {
          const alloc = raw as Record<string, unknown>
          const shopId = String(alloc.shop_id ?? '')
          if (!shopId) continue
          shopAllocs.push({
            shopId,
            orderId: alloc.order_id ? String(alloc.order_id) : null,
            amount: Number(alloc.amount ?? 0),
          })
        }
      } else if (step?.shop_id) {
        shopAllocs.push({
          shopId: String(step.shop_id),
          orderId: null,
          amount: Number(amount || step.amount || 0),
        })
      }

      const children: PayuSplitChild[] = []
      const childByShop = new Map<string, PayuSplitChild>()
      const pendingRows: Array<Record<string, unknown>> = []

      for (const alloc of shopAllocs) {
        if (!(alloc.amount > 0)) continue
        const { data: account } = await admin
          .from('shop_payment_accounts')
          .select('metadata, provider, status')
          .eq('shop_id', alloc.shopId)
          .eq('provider', 'payu')
          .eq('status', 'connected')
          .maybeSingle()
        const accountMeta =
          account?.metadata && typeof account.metadata === 'object'
            ? (account.metadata as Record<string, unknown>)
            : {}
        const child = childFromAccountMetadata(accountMeta)
        const subTxnId = `sub_${alloc.shopId.replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`

        if (child && child.merchantKey !== matched.key) {
          const splitChild: PayuSplitChild = {
            merchantKey: child.merchantKey,
            childMid: child.childMid,
            subTxnId,
            amount: formatAmount(alloc.amount),
          }
          children.push(splitChild)
          childByShop.set(alloc.shopId, splitChild)
          pendingRows.push({
            shop_id: alloc.shopId,
            order_id: alloc.orderId,
            checkout_group_id: step?.checkout_group_id ?? (udf3 || null),
            payment_step_id: udf1,
            payu_id: mihpayid,
            txnid,
            amount: Number(formatAmount(alloc.amount)),
            currency: 'INR',
            status: 'pending',
            hold_reason: 'awaiting_release_window',
            split_status: 'not_split',
            child_merchant_key: child.merchantKey,
            child_mid: child.childMid,
            sub_txn_id: subTxnId,
          })
        } else {
          pendingRows.push({
            shop_id: alloc.shopId,
            order_id: alloc.orderId,
            checkout_group_id: step?.checkout_group_id ?? (udf3 || null),
            payment_step_id: udf1,
            payu_id: mihpayid,
            txnid,
            amount: Number(formatAmount(alloc.amount)),
            currency: 'INR',
            status: 'pending',
            hold_reason: 'awaiting_child',
            split_status: 'not_split',
          })
        }
      }

      let splitOk = true
      let splitBody: unknown = null
      if (children.length) {
        const split = await createAbsolutePaymentSplit(matched, mihpayid, children)
        splitOk = split.ok
        splitBody = { ok: split.ok, error: split.error, json: split.json, body: split.body }
        const now = new Date().toISOString()
        for (const row of pendingRows) {
          const shopId = String(row.shop_id)
          if (!childByShop.has(shopId)) continue
          row.split_status = split.ok ? 'split' : 'split_failed'
          row.split_at = split.ok ? now : null
          row.split_payload = splitBody
          if (!split.ok) {
            row.error_message = split.error ?? 'payment_split failed'
          }
        }
      }

      if (pendingRows.length) {
        await admin.from('shepay_pending_settlements').upsert(pendingRows, {
          onConflict: 'shop_id,payu_id',
          ignoreDuplicates: false,
        })
        for (const row of pendingRows) {
          await admin.from('payment_logs').insert({
            shop_id: row.shop_id,
            event_type: 'settlement',
            status: row.split_status === 'split_failed' ? 'failed' : 'pending',
            provider: 'payu',
            transaction_id: mihpayid,
            amount: row.amount,
            currency: row.currency,
            payload: {
              held: true,
              platform_fee_amount: 0,
              hold_reason: row.hold_reason,
              split_status: row.split_status,
              sub_txn_id: row.sub_txn_id ?? null,
              payuId: mihpayid,
              txnid,
              order_id: row.order_id ?? null,
              checkout_group_id: row.checkout_group_id,
              split: splitBody,
            },
          })
        }
      }

      splitResult = {
        split_ok: splitOk,
        children: children.map((c) => ({
          merchantKey: c.merchantKey,
          childMid: c.childMid,
          amount: c.amount,
          subTxnId: c.subTxnId,
        })),
        held: pendingRows.map((r) => ({
          shop_id: r.shop_id,
          order_id: r.order_id,
          amount: r.amount,
          hold_reason: r.hold_reason,
          split_status: r.split_status,
        })),
        release: { skipped: true, reason: 'phase3_hold_until_delivery_window' },
      }
    } catch (splitError) {
      console.error('payu split hold failed', splitError)
      splitResult = {
        error: splitError instanceof Error ? splitError.message : 'split_failed',
      }
    }
  }

  return jsonResponse({ ok: true, result: data, payu_env: matched.mode, split: splitResult })
})
