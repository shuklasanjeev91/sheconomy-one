import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payUResponseHash, resolvePayuCredentials, type PayuCredentials } from '../_shared/payu.ts'
import { childFromAccountMetadata } from '../_shared/payu-child.ts'
import {
  createAbsolutePaymentSplit,
  releaseAllPayuSettlements,
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
    if (expected.toLowerCase() === hash.toLowerCase()) {
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

  const shopIdForRpc =
    udf2 && udf2 !== 'bundle' ? udf2 : null

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

  // Multi-vendor Automate split: ready shops get immediate split+release;
  // shops without a child merchant get a held pending row (auto-release on connect).
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

      type ShopAlloc = { shopId: string; amount: number }
      const shopAllocs: ShopAlloc[] = []

      if (allocations && allocations.length) {
        for (const raw of allocations) {
          const alloc = raw as Record<string, unknown>
          const shopId = String(alloc.shop_id ?? '')
          if (!shopId) continue
          shopAllocs.push({ shopId, amount: Number(alloc.amount ?? 0) })
        }
      } else if (step?.shop_id) {
        shopAllocs.push({
          shopId: String(step.shop_id),
          amount: Number(amount || step.amount || 0),
        })
      }

      const children: PayuSplitChild[] = []
      const pendingRows: Array<{
        shop_id: string
        checkout_group_id: string | null
        payment_step_id: string
        payu_id: string
        txnid: string
        amount: number
        currency: string
        status: string
      }> = []

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
        if (child && child.merchantKey !== matched.key) {
          children.push({
            merchantKey: child.merchantKey,
            childMid: child.childMid,
            subTxnId: `sub_${alloc.shopId.replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`,
            amount: formatAmount(alloc.amount),
          })
        } else {
          pendingRows.push({
            shop_id: alloc.shopId,
            checkout_group_id: step?.checkout_group_id ?? (udf3 || null),
            payment_step_id: udf1,
            payu_id: mihpayid,
            txnid,
            amount: Number(formatAmount(alloc.amount)),
            currency: 'INR',
            status: 'pending',
          })
        }
      }

      if (pendingRows.length) {
        await admin.from('shepay_pending_settlements').upsert(pendingRows, {
          onConflict: 'shop_id,payu_id',
          ignoreDuplicates: true,
        })
        for (const row of pendingRows) {
          await admin.from('payment_logs').insert({
            shop_id: row.shop_id,
            event_type: 'settlement',
            status: 'pending',
            provider: 'payu',
            transaction_id: mihpayid,
            amount: row.amount,
            currency: row.currency,
            payload: {
              held: true,
              reason: 'child_merchant_not_connected',
              payuId: mihpayid,
              txnid,
              checkout_group_id: row.checkout_group_id,
            },
          })
        }
      }

      if (children.length) {
        const split = await createAbsolutePaymentSplit(matched, mihpayid, children)
        const release = split.ok
          ? await releaseAllPayuSettlements(matched, mihpayid, children)
          : { ok: false, results: [] as Array<{ childMid: string; ok: boolean; error?: string }> }
        splitResult = {
          split,
          release,
          held: pendingRows.map((r) => ({ shop_id: r.shop_id, amount: r.amount })),
          children: children.map((c) => ({
            merchantKey: c.merchantKey,
            childMid: c.childMid,
            amount: c.amount,
            subTxnId: c.subTxnId,
          })),
        }

        const logShopId = children.length
          ? shopAllocs.find((a) =>
              children.some((c) => c.amount === formatAmount(a.amount)),
            )?.shopId ??
            shopAllocs[0]?.shopId ??
            null
          : null

        // One summary log for the immediate split (per first ready shop / group).
        await admin.from('payment_logs').insert({
          shop_id: logShopId,
          event_type: 'settlement',
          status: split.ok && release.ok ? 'completed' : 'failed',
          provider: 'payu',
          transaction_id: mihpayid,
          payload: {
            payuId: mihpayid,
            txnid,
            checkout_group_id: step?.checkout_group_id ?? udf3,
            splitResult,
          },
        })
      } else {
        splitResult = {
          skipped_immediate_split: true,
          reason: pendingRows.length ? 'all_held_pending_child' : 'no_allocations',
          held: pendingRows.map((r) => ({ shop_id: r.shop_id, amount: r.amount })),
        }
      }
    } catch (splitError) {
      console.error('payu split settle failed', splitError)
      splitResult = {
        error: splitError instanceof Error ? splitError.message : 'split_failed',
      }
    }
  }

  return jsonResponse({ ok: true, result: data, payu_env: matched.mode, split: splitResult })
})
