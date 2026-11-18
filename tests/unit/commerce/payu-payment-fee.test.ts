import { describe, expect, it } from 'vitest'

import {
  computePayuPaymentFee,
  DEFAULT_SHEPAY_PAYMENT_FEE,
  formatPayuMoney,
} from '~/lib/payment/payu-payment-fee'

describe('computePayuPaymentFee', () => {
  it('applies the default 1.5% SHEPay payment fee', () => {
    const result = computePayuPaymentFee(1000)
    expect(result).toEqual({
      grossAmount: 1000,
      feeAmount: 15,
      sellerAmount: 985,
    })
  })

  it('supports flat + percent rules', () => {
    const result = computePayuPaymentFee(100, { ratePercent: 1.9, rateFlat: 3 })
    expect(result.feeAmount).toBe(4.9)
    expect(result.sellerAmount).toBe(95.1)
    expect(result.grossAmount).toBe(100)
  })

  it('never leaves the seller with less than 0.01 when gross > 0', () => {
    const result = computePayuPaymentFee(1, { ratePercent: 50, rateFlat: 10 })
    expect(result.sellerAmount).toBe(0.01)
    expect(result.feeAmount).toBe(0.99)
  })

  it('returns zeros for non-positive gross', () => {
    expect(computePayuPaymentFee(0)).toEqual({
      grossAmount: 0,
      feeAmount: 0,
      sellerAmount: 0,
    })
  })

  it('keeps fee + seller equal to gross at 2dp', () => {
    const result = computePayuPaymentFee(99.99, DEFAULT_SHEPAY_PAYMENT_FEE)
    expect(Number((result.feeAmount + result.sellerAmount).toFixed(2))).toBe(99.99)
  })
})

describe('formatPayuMoney', () => {
  it('formats to two decimal places', () => {
    expect(formatPayuMoney(10)).toBe('10.00')
    expect(formatPayuMoney(10.456)).toBe('10.46')
  })
})
