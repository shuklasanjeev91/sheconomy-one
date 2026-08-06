import { describe, expect, it } from 'vitest'

import {
  PAYU_ALLOWED_PG,
  applyPayuPaymentModeFields,
  resolvePayuPaymentMode,
} from '~/commerce/lib/payu-payment-modes'

describe('payu-payment-modes', () => {
  it('defaults to all methods (no pg)', () => {
    const mode = resolvePayuPaymentMode(null)
    expect(mode.id).toBe('all')
    expect(mode.pg).toBeUndefined()
    const fields = applyPayuPaymentModeFields({}, { modeId: 'all' })
    expect(fields.pg).toBeUndefined()
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
    expect(applyPayuPaymentModeFields({}, { modeId: 'qr' })).toMatchObject({
      pg: 'UPI',
      bankcode: 'UPIDBQR',
    })
  })

  it('rejects unknown pg values', () => {
    const fields = applyPayuPaymentModeFields({}, { pg: 'HACKER' })
    expect(fields.pg).toBeUndefined()
    expect(PAYU_ALLOWED_PG.has('PAYPAL')).toBe(true)
  })

  it('allows explicit bankcode override', () => {
    const fields = applyPayuPaymentModeFields(
      {},
      { modeId: 'wallets', bankcode: 'PAYTM' },
    )
    expect(fields).toMatchObject({ pg: 'CASH', bankcode: 'PAYTM' })
  })
})
