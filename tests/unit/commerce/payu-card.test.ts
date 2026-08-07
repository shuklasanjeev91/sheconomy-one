import { describe, expect, it } from 'vitest'

import {
  luhnValid,
  normalizeExpiryYear,
  resolvePayuCardPgBankcode,
  validatePayuCardInput,
} from '~/commerce/lib/payu-card'

describe('payu-card', () => {
  it('validates Luhn for known test PANs', () => {
    expect(luhnValid('4012000000002004')).toBe(true)
    expect(luhnValid('5123456789012346')).toBe(true)
    expect(luhnValid('4012000000002005')).toBe(false)
  })

  it('normalizes 2-digit year to 20xx', () => {
    expect(normalizeExpiryYear('26')).toBe('2026')
  })

  it('requires complete card fields', () => {
    expect(
      validatePayuCardInput({
        number: '4012000000002004',
        name: 'Test',
        expMon: '06',
        expYr: '2027',
        cvv: '123',
      }),
    ).toBeNull()
    expect(
      validatePayuCardInput({
        number: '4012000000002004',
        name: '',
        expMon: '06',
        expYr: '2027',
        cvv: '123',
      }),
    ).toMatch(/name/i)
  })

  it('maps debit category to pg=DC with bankcode=CC', () => {
    expect(resolvePayuCardPgBankcode({ category: 'debit', bankcode: 'VISA' })).toEqual({
      pg: 'DC',
      bankcode: 'CC',
    })
    expect(resolvePayuCardPgBankcode({ category: 'credit', bankcode: 'MAST' })).toEqual({
      pg: 'CC',
      bankcode: 'CC',
    })
  })
})
