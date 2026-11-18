/**
 * PayU / SHEPay payment processing fee deducted from seller settlements.
 *
 * SHEconomy platform commission on item price remains 0%. The PayU MDR / SHEPay
 * processing fee is passed to the seller via PayU Automate `aggregatorCharges`
 * (settled to the parent MID; PayU TDR is taken from that share).
 *
 * Default matches `platform_fee_rules.shepay_payment` (1.5% + ₹0).
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
  /** Gross shop allocation (buyer paid for this shop). */
  grossAmount: number
  /** Fee withheld as aggregatorCharges. */
  feeAmount: number
  /** Net amount split to the child merchant (aggregatorSubAmt). */
  sellerAmount: number
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

/**
 * Compute PayU payment fee for one shop allocation.
 * Ensures sellerAmount + feeAmount === grossAmount (2dp), and seller keeps at
 * least ₹0.01 when gross > 0.
 */
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

  const sellerAmount = roundMoney(gross - fee)
  return { grossAmount: gross, feeAmount: fee, sellerAmount }
}

/** Format for PayU absolute-split amount strings. */
export function formatPayuMoney(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  return roundMoney(Number.isFinite(n) ? n : 0).toFixed(2)
}
