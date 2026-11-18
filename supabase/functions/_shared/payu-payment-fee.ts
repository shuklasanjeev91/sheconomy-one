/**
 * PayU / SHEPay payment processing fee for Automate absolute splits.
 * Mirrors lib/payment/payu-payment-fee.ts (Deno edge cannot import ~/lib).
 */

export type PayuPaymentFeeRule = {
  ratePercent: number
  rateFlat: number
}

export const DEFAULT_SHEPAY_PAYMENT_FEE: PayuPaymentFeeRule = {
  ratePercent: 1.5,
  rateFlat: 0,
}

export type PayuPaymentFeeSplit = {
  grossAmount: number
  feeAmount: number
  sellerAmount: number
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export function computePayuPaymentFee(
  grossAmount: number,
  rule: PayuPaymentFeeRule = DEFAULT_SHEPAY_PAYMENT_FEE,
): PayuPaymentFeeSplit {
  const gross = roundMoney(grossAmount)
  if (!(gross > 0)) {
    return { grossAmount: 0, feeAmount: 0, sellerAmount: 0 }
  }

  const percent = Math.max(0, Number(rule.ratePercent) || 0)
  const flat = Math.max(0, Number(rule.rateFlat) || 0)
  let fee = roundMoney((gross * percent) / 100 + flat)

  const maxFee = roundMoney(Math.max(0, gross - 0.01))
  if (fee > maxFee) fee = maxFee
  if (fee < 0) fee = 0

  return { grossAmount: gross, feeAmount: fee, sellerAmount: roundMoney(gross - fee) }
}

export function formatPayuMoney(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return roundMoney(Number.isFinite(n) ? n : 0).toFixed(2)
}

/** Env overrides → else defaults matching platform_fee_rules.shepay_payment. */
export function resolvePayuPaymentFeeRuleFromEnv(): PayuPaymentFeeRule {
  const percentRaw = Deno.env.get('PAYU_PAYMENT_FEE_PERCENT')?.trim()
  const flatRaw = Deno.env.get('PAYU_PAYMENT_FEE_FLAT')?.trim()
  const ratePercent =
    percentRaw != null && percentRaw !== '' && Number.isFinite(Number(percentRaw))
      ? Number(percentRaw)
      : DEFAULT_SHEPAY_PAYMENT_FEE.ratePercent
  const rateFlat =
    flatRaw != null && flatRaw !== '' && Number.isFinite(Number(flatRaw))
      ? Number(flatRaw)
      : DEFAULT_SHEPAY_PAYMENT_FEE.rateFlat
  return { ratePercent, rateFlat }
}

/**
 * Prefer platform_fee_rules.shepay_payment when readable; fall back to env/default.
 * `admin` is a Supabase service client (loosely typed for Deno edge).
 */
export async function loadPayuPaymentFeeRule(admin: {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any
}): Promise<PayuPaymentFeeRule> {
  const envRule = resolvePayuPaymentFeeRuleFromEnv()
  // Explicit env wins when set.
  if (
    Deno.env.get('PAYU_PAYMENT_FEE_PERCENT')?.trim() ||
    Deno.env.get('PAYU_PAYMENT_FEE_FLAT')?.trim()
  ) {
    return envRule
  }

  try {
    const { data } = await admin
      .from('platform_fee_rules')
      .select('rate_percent, rate_flat')
      .eq('id', 'shepay_payment')
      .maybeSingle()
    if (data) {
      return {
        ratePercent: Number(data.rate_percent ?? envRule.ratePercent),
        rateFlat: Number(data.rate_flat ?? envRule.rateFlat),
      }
    }
  } catch {
    // Fall through to default.
  }
  return envRule
}
