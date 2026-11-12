import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payuMerchantCommand, resolvePayuCredentials } from '../_shared/payu.ts'

/**
 * PayU get_checkout_details — live payment options for merchant-hosted accordion.
 * @see https://docs.payu.in/reference/get_checkout_details
 */

type Instrument = {
  bankcode: string
  title: string
  shortName?: string | null
  isDown?: boolean
  tenure?: number | null
  monthlyEmi?: number | null
  minimumAmount?: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseInstrumentMap(raw: unknown): Instrument[] {
  const map = asRecord(raw)
  if (!map) return []
  const out: Instrument[] = []
  for (const [bankcode, value] of Object.entries(map)) {
    if (!bankcode || bankcode === '...') continue
    const row = asRecord(value) ?? {}
    const title = String(row.title ?? row.shortName ?? bankcode).trim()
    if (!title) continue
    const isDown = row.isDown === true || row.status === false
    out.push({
      bankcode: bankcode.toUpperCase(),
      title,
      shortName: row.shortName != null ? String(row.shortName) : null,
      isDown,
      minimumAmount:
        typeof row.minimumAmount === 'number'
          ? row.minimumAmount
          : row.minimumAmount != null
            ? Number(row.minimumAmount)
            : null,
    })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title))
}

function parseEmiOptions(emiRoot: unknown): Instrument[] {
  const root = asRecord(emiRoot)
  const all = asRecord(root?.all) ?? root
  if (!all) return []
  const out: Instrument[] = []
  for (const kind of ['cc', 'dc', 'cardless', 'others']) {
    const bucket = asRecord(all[kind])
    const banks = asRecord(bucket?.all) ?? bucket
    if (!banks) continue
    for (const [bankKey, bankVal] of Object.entries(banks)) {
      if (!bankKey || bankKey === '...') continue
      const bank = asRecord(bankVal) ?? {}
      const bankTitle = String(bank.title ?? bank.shortName ?? bankKey).trim()
      const tenures = asRecord(bank.tenureOptions)
      if (!tenures) {
        out.push({
          bankcode: bankKey.toUpperCase(),
          title: bankTitle,
          shortName: bank.shortName != null ? String(bank.shortName) : null,
          isDown: bank.eligibility != null && asRecord(bank.eligibility)?.status === false,
        })
        continue
      }
      for (const [code, tenureVal] of Object.entries(tenures)) {
        if (!code || code === '...') continue
        const tenure = asRecord(tenureVal) ?? {}
        const months = tenure.tenure != null ? Number(tenure.tenure) : null
        const monthly =
          tenure.monthlyEmi != null
            ? Number(tenure.monthlyEmi)
            : tenure.monthly_emi != null
              ? Number(tenure.monthly_emi)
              : null
        const label =
          months && Number.isFinite(months)
            ? `${bankTitle} · ${months} mo`
            : bankTitle
        out.push({
          bankcode: code.toUpperCase(),
          title: label,
          shortName: bank.shortName != null ? String(bank.shortName) : bankTitle,
          tenure: months && Number.isFinite(months) ? months : null,
          monthlyEmi: monthly && Number.isFinite(monthly) ? monthly : null,
          minimumAmount:
            tenure.minimumAmount != null ? Number(tenure.minimumAmount) : null,
          isDown: asRecord(tenure.eligibility)?.status === false,
        })
      }
    }
  }
  return out
}

function optionEnabled(node: unknown): boolean {
  if (node === true) return true
  const rec = asRecord(node)
  if (!rec) return false
  if (rec.status === true || rec.status === 1 || rec.status === '1') return true
  if (rec.isDown === true) return false
  if (asRecord(rec.all) && Object.keys(asRecord(rec.all)!).length > 0) return true
  return false
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const payu = resolvePayuCredentials()
  if (!payu) return jsonResponse({ error: 'SHEPay is not configured' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl) return jsonResponse({ error: 'Misconfigured' }, 503)

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: { amount?: number | string; request_id?: string }
  try {
    body = (await request.json()) as { amount?: number | string; request_id?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'Valid amount is required' }, 400)
  }

  const requestId =
    String(body.request_id ?? '').trim() ||
    `chk_${user.id.slice(0, 8)}_${Date.now().toString(36)}`

  const var1 = JSON.stringify({
    requestId,
    transactionDetails: { amount },
    useCase: { getExtendedPaymentDetails: true },
  })

  const posted = await payuMerchantCommand(payu, 'get_checkout_details', { var1 })
  const root = (posted.json ?? {}) as Record<string, unknown>
  const statusOk = root.status === 1 || root.status === '1'
  const details =
    asRecord(root.details) ?? asRecord(root.result) ?? asRecord(root.data) ?? root
  const paymentOptions =
    asRecord(details?.paymentOptions) ?? asRecord(details?.payment_options) ?? null

  if (!statusOk && !paymentOptions) {
    return jsonResponse(
      {
        error: 'Could not load PayU payment options',
        payu_raw: posted.text.slice(0, 400),
      },
      502,
    )
  }

  const nb = parseInstrumentMap(asRecord(paymentOptions?.nb)?.all ?? paymentOptions?.nb)
  const cash = parseInstrumentMap(
    asRecord(paymentOptions?.cash)?.all ?? paymentOptions?.cash,
  )
  const bnpl = parseInstrumentMap(
    asRecord(paymentOptions?.lazypay)?.all ??
      asRecord(paymentOptions?.bnpl)?.all ??
      paymentOptions?.lazypay ??
      paymentOptions?.bnpl,
  )
  const emi = parseEmiOptions(paymentOptions?.emi)
  const upiNode = paymentOptions?.upi ?? paymentOptions?.UPI
  const ccNode = paymentOptions?.cc
  const dcNode = paymentOptions?.dc

  return jsonResponse({
    request_id: requestId,
    amount,
    payu_env: payu.mode,
    upi: {
      enabled: upiNode == null ? true : optionEnabled(upiNode),
      isDown: asRecord(upiNode)?.isDown === true,
    },
    cards: {
      enabled: ccNode == null && dcNode == null ? true : optionEnabled(ccNode) || optionEnabled(dcNode),
    },
    netbanking: nb.filter((row) => !row.isDown),
    wallets: cash.filter((row) => !row.isDown),
    emi: emi.filter((row) => !row.isDown),
    bnpl: bnpl.filter((row) => !row.isDown),
    paypal: optionEnabled(paymentOptions?.paypal),
    pluxee: optionEnabled(paymentOptions?.sodexo) || optionEnabled(paymentOptions?.pluxee),
    neft: optionEnabled(paymentOptions?.neftrtgs) || optionEnabled(paymentOptions?.neft),
  })
})
