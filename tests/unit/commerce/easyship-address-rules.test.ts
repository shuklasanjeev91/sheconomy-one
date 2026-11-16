import { describe, expect, it } from 'vitest'

import {
  EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
  ShipAddressError,
  assertShipAddressComplete,
  countryAlpha2,
  isPlaceholderShipStreet,
} from '~/lib/vendor-shipping/easyship-address-rules'

describe('easyship address rules', () => {
  it('normalizes country codes', () => {
    expect(countryAlpha2('India')).toBe('IN')
    expect(countryAlpha2('IND')).toBe('IN')
    expect(countryAlpha2('united states')).toBe('US')
    expect(countryAlpha2('in')).toBe('IN')
    expect(countryAlpha2('')).toBe('')
  })

  it('rejects placeholder origin streets and zero postal', () => {
    expect(() =>
      assertShipAddressComplete(
        {
          line_1: 'Warehouse',
          city: 'Faridabad',
          postal_code: '000000',
          country_alpha2: 'IN',
        },
        'origin',
      ),
    ).toThrow(ShipAddressError)

    try {
      assertShipAddressComplete(
        {
          line_1: 'Warehouse',
          city: 'Faridabad',
          postal_code: '000000',
          country_alpha2: 'IN',
        },
        'origin',
      )
    } catch (err) {
      expect(err).toBeInstanceOf(ShipAddressError)
      const e = err as ShipAddressError
      expect(e.code).toBe('seller_origin_incomplete')
      expect(e.setupPath).toBe(EASYSHIP_SELLER_ORIGIN_SETUP_PATH)
      expect(EASYSHIP_SELLER_ORIGIN_SETUP_PATH).toContain('section=warehouse')
      expect(e.message).toMatch(/street/)
      expect(e.message).toMatch(/postal_code/)
    }
  })

  it('rejects incomplete buyer destination', () => {
    expect(() =>
      assertShipAddressComplete(
        {
          line_1: 'Address',
          city: 'City',
          postal_code: '',
          country_alpha2: '',
        },
        'destination',
      ),
    ).toThrow(/buyer_destination_incomplete|incomplete/i)

    try {
      assertShipAddressComplete(
        { line_1: '12 Main St', city: '', postal_code: '10001', country_alpha2: 'US' },
        'destination',
      )
    } catch (err) {
      expect(err).toBeInstanceOf(ShipAddressError)
      expect((err as ShipAddressError).code).toBe('buyer_destination_incomplete')
    }
  })

  it('accepts a complete warehouse-style origin', () => {
    expect(() =>
      assertShipAddressComplete(
        {
          line_1: '11/2, MCIE, Badarpur Border',
          city: 'Faridabad',
          postal_code: '121003',
          country_alpha2: 'IN',
        },
        'origin',
      ),
    ).not.toThrow()
  })

  it('detects placeholder streets used by old fulfill path', () => {
    expect(isPlaceholderShipStreet('Warehouse')).toBe(true)
    expect(isPlaceholderShipStreet('Address')).toBe(true)
    expect(isPlaceholderShipStreet('11/2 MCIE')).toBe(false)
  })
})
