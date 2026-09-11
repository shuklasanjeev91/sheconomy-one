import { describe, expect, it } from 'vitest'

import {
  PAYU_ALLOWED_PG,
  PAYU_NB_OPTIONS,
  PAYU_WALLET_OPTIONS,
  applyPayuPaymentModeFields,
  payuGroupIdForMode,
  payuModeNeedsS2s,
  resolvePayuPaymentMode,
} from '~/commerce/lib/payu-payment-modes'

describe('payu-payment-modes', () => {
  it('defaults all methods to UPI intent (never omit pg — that opens PayU picker)', () => {
    const mode = resolvePayuPaymentMode(null)
    expect(mode.id).toBe('all')
    expect(mode.pg).toBe('UPI')
    expect(mode.bankcode).toBe('INTENT')
    const fields = applyPayuPaymentModeFields({}, { modeId: 'all' })
    expect(fields).toMatchObject({ pg: 'UPI', bankcode: 'INTENT' })
  })

  it('maps cards / wallets / pluxee / neft per PayU docs', () => {
    expect(applyPayuPaymentModeFields({}, { modeId: 'cards' })).toMatchObject({
      pg: 'CC',
      bankcode: 'CC',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'wallets' })).toMatchObject({ pg: 'CASH' })
    expect(applyPayuPaymentModeFields({}, { modeId: 'pluxee' })).toMatchObject({
      pg: 'MC',
      bankcode: 'SODEXO',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'neft' })).toMatchObject({
      pg: 'NEFTRTGS',
      bankcode: 'EFTAXTPV',
      api_version: '6',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'upi_intent' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'INTENT',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'upi_gpay' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'TEZ',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'upi_phonepe' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'PHONEPE',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'upi_collect' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'UPI',
    })
    expect(resolvePayuPaymentMode('upi_collect').needsVpa).toBe(true)
    expect(resolvePayuPaymentMode('upi_gpay').seamlessS2s).toBe(true)
    // Net banking must reach PayU without a bankcode so PayU lists the banks
    // live on the account instead of rejecting a hardcoded one.
    const nbFields = applyPayuPaymentModeFields({}, { modeId: 'netbanking' })
    expect(nbFields.pg).toBe('NB')
    expect(nbFields.bankcode).toBeUndefined()
    expect(payuModeNeedsS2s('netbanking')).toBe(false)
    expect(payuModeNeedsS2s('upi_gpay')).toBe(true)
    expect(payuModeNeedsS2s('cards')).toBe(true)
    expect(applyPayuPaymentModeFields({}, { modeId: 'qr' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'INTENT',
    })
    expect(applyPayuPaymentModeFields({}, { modeId: 'upi_qr' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'INTENT',
    })
  })

  it('maps concrete options back to method groups', () => {
    expect(payuGroupIdForMode('upi_phonepe')).toBe('upi')
    expect(payuGroupIdForMode('upi_qr')).toBe('upi')
    expect(payuGroupIdForMode('cards')).toBe('cards')
    expect(payuGroupIdForMode('netbanking')).toBe('netbanking')
    expect(payuGroupIdForMode('wallet_mobikwik')).toBe('wallets')
  })

  it('rejects unknown pg values', () => {
    const fields = applyPayuPaymentModeFields({}, { pg: 'HACKER' })
    expect(fields.pg).toBeUndefined()
    expect(PAYU_ALLOWED_PG.has('PAYPAL')).toBe(true)
  })

  it('allows explicit bankcode override', () => {
    const fields = applyPayuPaymentModeFields(
      {},
      { modeId: 'wallets', bankcode: 'OLAM' },
    )
    expect(fields).toMatchObject({ pg: 'CASH', bankcode: 'OLAM' })
  })

  // Offering a code PayU does not recognise only fails once the buyer has been
  // handed off, so keep the offered set inside the documented list.
  // https://docs.payu.in/docs/wallet-codes
  it('only offers wallets that PayU publishes a bankcode for', () => {
    const documented = ['AMZPAY', 'AMON', 'OLAM', 'ITZC', 'PAYZP', 'MOBIKWIK', 'PHONEPE']
    for (const option of PAYU_WALLET_OPTIONS) {
      expect(documented, option.id).toContain(option.bankcode)
    }
  })

  it('builds complete form-post fields for every enabled bank and wallet', () => {
    for (const option of [...PAYU_NB_OPTIONS, ...PAYU_WALLET_OPTIONS]) {
      const fields = applyPayuPaymentModeFields({}, { modeId: option.id })
      expect(fields.pg, option.id).toBe(option.pg)
      expect(fields.bankcode, option.id).toBe(option.bankcode)
      expect(payuModeNeedsS2s(option.id), option.id).toBe(false)
    }
  })

  it.each(['emi', 'bnpl', 'paypal', 'pluxee', 'neft'] as const)(
    'builds classic merchant-hosted fields for %s',
    (modeId) => {
      const fields = applyPayuPaymentModeFields({}, { modeId })
      expect(fields.pg).toBeTruthy()
      expect(fields.bankcode).toBeTruthy()
      expect(payuModeNeedsS2s(modeId)).toBe(false)
    },
  )
})
