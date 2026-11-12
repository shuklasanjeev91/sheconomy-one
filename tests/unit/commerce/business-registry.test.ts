import { describe, expect, it } from 'vitest'

import {
  buildChecksumGstAutofill,
  detectRegistrationKind,
  interpretBusinessLookup,
  parseGstRegistryAddress,
  verifyCin,
} from '~/lib/payment/business-registry'

describe('business-registry', () => {
  it('detects GSTIN, CIN, and PAN', () => {
    expect(detectRegistrationKind('09ABQFA5416M1ZX')).toBe('gstin')
    expect(detectRegistrationKind('U12345MH2020PTC123456')).toBe('cin')
    expect(detectRegistrationKind('ABQFA5416M')).toBe('pan')
    expect(detectRegistrationKind('not-a-number')).toBe('unknown')
  })

  it('validates CIN format', () => {
    expect(verifyCin('U12345MH2020PTC123456').ok).toBe(true)
    expect(verifyCin('BAD').ok).toBe(false)
  })

  it('builds checksum autofill from a valid GSTIN', () => {
    const fill = buildChecksumGstAutofill('09ABQFA5416M1ZX')
    expect(fill?.pan).toBe('ABQFA5416M')
    expect(fill?.verified).toBe(true)
    expect(fill?.source).toBe('checksum')
  })

  it('parses Masters India style registered address', () => {
    const address = parseGstRegistryAddress({
      pradr: {
        addr: {
          bno: '12',
          st: 'MG Road',
          loc: 'Cubbon Park',
          dst: 'Bengaluru',
          stcd: 'Karnataka',
          pncd: '560001',
        },
      },
    })
    expect(address?.line1).toContain('MG Road')
    expect(address?.city).toBe('Bengaluru')
    expect(address?.postalCode).toBe('560001')
    expect(address?.countryCode).toBe('IN')
  })

  it('interprets registry lookup payloads for autofill', () => {
    const interpreted = interpretBusinessLookup({
      ok: true,
      configured: true,
      source: 'registry',
      data: {
        gstin: '09ABQFA5416M1ZX',
        lgnm: 'GAURI GUPTA',
        tradeNam: 'GAURI STORE',
        sts: 'Active',
        ctb: 'Partnership',
        pradr: { addr: { dst: 'Lucknow', pncd: '226001', stcd: 'Uttar Pradesh', st: 'Hazratganj' } },
      },
    })
    expect(interpreted.ok).toBe(true)
    if (!interpreted.ok) return
    expect(interpreted.autofill.legalName).toBe('GAURI GUPTA')
    expect(interpreted.autofill.tradeName).toBe('GAURI STORE')
    expect(interpreted.autofill.address?.city).toBe('Lucknow')
  })
})
