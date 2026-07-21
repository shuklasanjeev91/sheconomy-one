import { describe, expect, it } from 'vitest'

import { findCountryByIso2, getAllPhoneCountries } from '~/lib/phone/countries'
import {
  isValidPhone,
  parseE164Phone,
  toE164Phone,
  validateNationalPhone,
} from '~/lib/phone/phone'
import { validateShopField, validateShopPhoneNumber } from '~/lib/shop/shop.validation'
import { email, optionalUrl, phone } from '~/lib/validation'

describe('phone E.164 helpers', () => {
  it('builds and parses E.164 for India', () => {
    const india = findCountryByIso2('IN')
    expect(india).toBeTruthy()

    const e164 = toE164Phone(india!, '9876543210')
    expect(e164).toBe('+919876543210')

    const parsed = parseE164Phone(e164)
    expect(parsed?.country.iso2).toBe('IN')
    expect(parsed?.nationalNumber).toBe('9876543210')
  })

  it('validates national length/pattern per country', () => {
    const india = findCountryByIso2('IN')!
    expect(validateNationalPhone('9876543210', india).ok).toBe(true)
    expect(validateNationalPhone('123', india).ok).toBe(false)
    expect(isValidPhone('+919876543210')).toBe(true)
    expect(isValidPhone('+91123')).toBe(false)
  })

  it('exposes a searchable flat country list', () => {
    const countries = getAllPhoneCountries()
    expect(countries.length).toBeGreaterThan(50)
    expect(countries.some((country) => country.iso2 === 'IN')).toBe(true)
    expect(countries.some((country) => country.iso2 === 'US')).toBe(true)
  })
})

describe('shared field validators', () => {
  it('treats empty phone as optional and rejects invalid E.164', () => {
    expect(phone()('')).toBeNull()
    expect(phone()('+919876543210')).toBeNull()
    expect(phone()('+91123')).toBeTruthy()
  })

  it('validates shop contact fields used by admin/product forms', () => {
    expect(validateShopField('shop_name', '').isValid).toBe(false)
    expect(validateShopField('shop_name', 'Bloom Studio').isValid).toBe(true)
    expect(validateShopPhoneNumber('+919876543210')).toBeNull()
    expect(validateShopPhoneNumber('+91123')).toBeTruthy()
    expect(email()('bad')).toBeTruthy()
    expect(email()('shop@example.com')).toBeNull()
    expect(optionalUrl()('example.com')).toBeTruthy()
    expect(optionalUrl()('https://example.com')).toBeNull()
  })
})
