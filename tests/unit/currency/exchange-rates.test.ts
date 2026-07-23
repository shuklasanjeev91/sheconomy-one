import { afterEach, describe, expect, it } from 'vitest'

import { setDisplayCurrencyPreferences } from '~/lib/currency/display-currency'
import {
  convertCurrencyAmount,
  roundConvertedAmount,
  type ExchangeRateTable,
} from '~/lib/currency/exchange-rate-math'
import { seedExchangeRatesForTests } from '~/lib/currency/rates-store'
import { formatCurrency } from '~/lib/format'

const SAMPLE: ExchangeRateTable = {
  base: 'USD',
  rates: {
    USD: 1,
    INR: 83,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 150,
  },
  fetchedAt: Date.now(),
  nextUpdateAt: Date.now() + 86_400_000,
}

describe('convertCurrencyAmount', () => {
  it('converts via the USD base table', () => {
    expect(convertCurrencyAmount(83, 'INR', 'USD', SAMPLE)).toBeCloseTo(1, 5)
    expect(convertCurrencyAmount(1, 'USD', 'INR', SAMPLE)).toBeCloseTo(83, 5)
    expect(convertCurrencyAmount(100, 'INR', 'EUR', SAMPLE)).toBeCloseTo((100 / 83) * 0.92, 5)
  })

  it('returns the same amount for identical currencies', () => {
    expect(convertCurrencyAmount(42, 'INR', 'inr', SAMPLE)).toBe(42)
  })

  it('returns null when a rate is missing', () => {
    expect(convertCurrencyAmount(10, 'INR', 'AED', SAMPLE)).toBeNull()
    expect(convertCurrencyAmount(10, 'INR', 'USD', null)).toBeNull()
  })
})

describe('formatCurrency conversion', () => {
  afterEach(() => {
    seedExchangeRatesForTests(null)
    setDisplayCurrencyPreferences({
      preferredCurrency: 'INR',
      locale: 'en-IN',
      convertEnabled: true,
    })
  })

  it('formats in the preferred currency when rates are loaded', () => {
    seedExchangeRatesForTests(SAMPLE)
    setDisplayCurrencyPreferences({
      preferredCurrency: 'USD',
      locale: 'en-US',
      convertEnabled: true,
    })
    const label = formatCurrency(830, 'INR')
    expect(label).toContain('10')
    expect(label).toMatch(/\$|USD/)
  })

  it('keeps the source currency when convert is disabled', () => {
    seedExchangeRatesForTests(SAMPLE)
    setDisplayCurrencyPreferences({
      preferredCurrency: 'USD',
      locale: 'en-US',
      convertEnabled: true,
    })
    const label = formatCurrency(100, 'INR', 'en-IN', { convert: false })
    expect(label).toMatch(/₹|INR/)
  })

  it('falls back to the source currency when rates are unavailable', () => {
    seedExchangeRatesForTests(null)
    setDisplayCurrencyPreferences({
      preferredCurrency: 'USD',
      locale: 'en-US',
      convertEnabled: true,
    })
    const label = formatCurrency(100, 'INR', 'en-IN')
    expect(label).toMatch(/₹|INR/)
  })
})

describe('roundConvertedAmount', () => {
  it('rounds zero-decimal currencies to whole units', () => {
    expect(roundConvertedAmount(12.4, 'JPY')).toBe(12)
    expect(roundConvertedAmount(12.345, 'USD')).toBe(12.35)
  })
})
