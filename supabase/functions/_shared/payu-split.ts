/**
 * PayU Automate absolute split + release (100% to child merchants, 0% platform fee).
 * @see https://docs.payu.in/docs/absolute-split-after-transaction-integration
 * @see https://docs.payu.in/reference/release_settlement_api
 */

import { sha512Hex, type PayuCredentials } from './payu.ts'

export type PayuSplitChild = {
  merchantKey: string
  /** PayU child MID — required for release_settlement var2 */
  childMid: string
  subTxnId: string
  amount: string
}

export async function payuCommandHash(
  key: string,
  command: string,
  var1: string,
  salt: string,
): Promise<string> {
  return sha512Hex(`${key}|${command}|${var1}|${salt}`)
}

function infoBaseUrl(_creds: PayuCredentials): string {
  return 'https://info.payu.in/merchant/postservice.php?form=2'
}

function parsePayuJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function payuCommandSucceeded(json: Record<string, unknown> | null, text: string): boolean {
  if (!json) {
    // Some PayU endpoints return PHP-array text with status=1
    return /["']?status["']?\s*[:=]\s*1\b/i.test(text) || /splitStatus["']?\s*[:=]\s*["']?success/i.test(text)
  }
  const status = json.status
  const splitStatus = String(json.splitStatus ?? json.split_status ?? '').toLowerCase()
  if (splitStatus === 'success' || splitStatus === 'successful') return true
  if (status === 1 || status === '1' || status === true) return true
  const msg = String(json.message ?? json.msg ?? '').toLowerCase()
  return msg.includes('success')
}

/** Absolute split after capture — one call with all child merchants. */
export async function createAbsolutePaymentSplit(
  creds: PayuCredentials,
  payuId: string,
  children: PayuSplitChild[],
): Promise<{ ok: boolean; body: string; json: Record<string, unknown> | null; error?: string }> {
  if (!children.length) return { ok: true, body: 'no_children', json: null }

  const splitInfo: Record<string, { aggregatorSubTxnId: string; aggregatorSubAmt: string }> = {}
  for (const child of children) {
    splitInfo[child.merchantKey] = {
      aggregatorSubTxnId: child.subTxnId,
      aggregatorSubAmt: child.amount,
    }
  }

  const var1 = JSON.stringify({
    type: 'absolute',
    payuId,
    splitInfo,
  })

  const hash = await payuCommandHash(creds.key, 'payment_split', var1, creds.salt)
  const body = new URLSearchParams({
    key: creds.key,
    command: 'payment_split',
    var1,
    hash,
    api_version: '7',
  })

  const res = await fetch(infoBaseUrl(creds), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  const json = parsePayuJson(text)
  if (!res.ok) {
    return { ok: false, body: text, json, error: `payment_split HTTP ${res.status}` }
  }
  if (!payuCommandSucceeded(json, text)) {
    return {
      ok: false,
      body: text,
      json,
      error: String(json?.message ?? json?.msg ?? 'payment_split failed'),
    }
  }
  return { ok: true, body: text, json }
}

/**
 * Release settlement for one child merchant.
 * PayU docs: var1 = parent mihpayid, var2 = childMid.
 */
export async function releasePayuSettlement(
  creds: PayuCredentials,
  payuId: string,
  childMid: string,
): Promise<{ ok: boolean; body: string; json: Record<string, unknown> | null; error?: string }> {
  const mid = String(childMid ?? '').trim()
  if (!mid) return { ok: false, body: '', json: null, error: 'childMid required' }

  const var1 = payuId
  const hash = await payuCommandHash(creds.key, 'release_settlement', var1, creds.salt)
  const body = new URLSearchParams({
    key: creds.key,
    command: 'release_settlement',
    var1,
    var2: mid,
    hash,
  })

  const res = await fetch(infoBaseUrl(creds), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  const json = parsePayuJson(text)
  if (!res.ok) {
    return { ok: false, body: text, json, error: `release_settlement HTTP ${res.status}` }
  }
  if (!payuCommandSucceeded(json, text)) {
    return {
      ok: false,
      body: text,
      json,
      error: String(json?.message ?? json?.msg ?? 'release_settlement failed'),
    }
  }
  return { ok: true, body: text, json }
}

/** Release every child after a successful multi-merchant split. */
export async function releaseAllPayuSettlements(
  creds: PayuCredentials,
  payuId: string,
  children: PayuSplitChild[],
): Promise<{ ok: boolean; results: Array<{ childMid: string; ok: boolean; error?: string }> }> {
  const results: Array<{ childMid: string; ok: boolean; error?: string }> = []
  let allOk = true
  for (const child of children) {
    const mid = child.childMid || child.merchantKey
    const release = await releasePayuSettlement(creds, payuId, mid)
    results.push({ childMid: mid, ok: release.ok, error: release.error })
    if (!release.ok) allOk = false
  }
  return { ok: allOk, results }
}
