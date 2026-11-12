import { describe, expect, it } from 'vitest'

import {
  buildRegistrationDetailsPatch,
  getCountryKycProfile,
  getDefaultKycIdentifier,
  listConfiguredKycCountryCodes,
  listCountryKycIdentifiers,
  readStoredRegistration,
  toVendorBusinessIdentifiers,
  validateCountryRegistration,
} from '~/lib/payment/country-kyc'

describe('country-kyc profiles', () => {
  it('exposes primary marketplace countries', () => {
    const codes = listConfiguredKycCountryCodes()
    expect(codes).toEqual(expect.arrayContaining(['IN', 'US', 'GB', 'AU', 'SG', 'HK', 'AE', 'CA', 'DE', 'FR']))
  })

  it('defaults India business to GSTIN with autofill', () => {
    const id = getDefaultKycIdentifier('IN', 'BUSINESS')
    expect(id.type).toBe('GSTIN')
    expect(id.autofill).toBe(true)
  })

  it('falls back to BRN for unknown countries', () => {
    const profile = getCountryKycProfile('JP')
    expect(profile.business[0]?.type).toBe('BRN')
    expect(profile.individual[0]?.type).toBe('NATIONAL_ID')
  })

  it('lists Singapore UEN and NRIC options', () => {
    expect(listCountryKycIdentifiers('SG', 'BUSINESS').map((i) => i.type)).toEqual(['UEN'])
    expect(listCountryKycIdentifiers('SG', 'INDIVIDUAL')[0]?.type).toBe('NATIONAL_ID')
  })
})

describe('country-kyc validation', () => {
  it('validates India GSTIN checksum', () => {
    expect(
      validateCountryRegistration({
        countryCode: 'IN',
        entity: 'BUSINESS',
        type: 'GSTIN',
        value: '09ABQFA5416M1ZX',
      }).ok,
    ).toBe(true)
    expect(
      validateCountryRegistration({
        countryCode: 'IN',
        entity: 'BUSINESS',
        type: 'GSTIN',
        value: '09ABQFA5416M1ZA',
      }).ok,
    ).toBe(false)
  })

  it('validates US EIN formatting', () => {
    const result = validateCountryRegistration({
      countryCode: 'US',
      entity: 'BUSINESS',
      type: 'EIN',
      value: '123456789',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('12-3456789')
  })

  it('validates UK company number and Singapore UEN', () => {
    expect(
      validateCountryRegistration({
        countryCode: 'GB',
        entity: 'BUSINESS',
        type: 'CRN',
        value: '12345678',
      }).ok,
    ).toBe(true)
    expect(
      validateCountryRegistration({
        countryCode: 'SG',
        entity: 'BUSINESS',
        type: 'UEN',
        value: '201912345A',
      }).ok,
    ).toBe(true)
  })

  it('requires a value', () => {
    const result = validateCountryRegistration({
      countryCode: 'AU',
      entity: 'BUSINESS',
      type: 'ABN',
      value: '   ',
    })
    expect(result.ok).toBe(false)
  })
})

describe('country-kyc storage helpers', () => {
  it('reads legacy gstin and typed identifier_number', () => {
    expect(readStoredRegistration({ gstin: '09ABQFA5416M1ZX' })).toEqual({
      type: 'GSTIN',
      value: '09ABQFA5416M1ZX',
    })
    expect(
      readStoredRegistration({
        identifier_type: 'UEN',
        identifier_number: '201912345A',
        uen: '201912345A',
      }),
    ).toEqual({ type: 'UEN', value: '201912345A' })
  })

  it('builds a details patch with type + number', () => {
    const patch = buildRegistrationDetailsPatch({
      type: 'ABN',
      value: '12345678901',
      previous: { note: 'keep' },
    })
    expect(patch).toMatchObject({
      note: 'keep',
      identifier_type: 'ABN',
      identifier_number: '12345678901',
      abn: '12345678901',
    })
  })

  it('maps identifiers for vendor business_identifiers', () => {
    expect(
      toVendorBusinessIdentifiers({
        countryCode: 'SG',
        type: 'UEN',
        value: '201912345A',
      }),
    ).toEqual([{ type: 'UEN', number: '201912345A', country_code: 'SG' }])
    expect(
      toVendorBusinessIdentifiers({
        countryCode: 'IN',
        type: 'GSTIN',
        value: '09ABQFA5416M1ZX',
      })[0]?.type,
    ).toBe('BRN')
  })
})
