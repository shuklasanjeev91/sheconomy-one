import { describe, expect, it } from 'vitest'

import { getPublicTrackingUrl } from '~/lib/orders/courier-tracking-urls'
import {
  COURIER_OPTIONS,
  COURIER_OPTIONS_GROUPED,
  COURIER_SLUGS,
  DOMESTIC_COURIER_OPTIONS,
  INTERNATIONAL_COURIER_OPTIONS,
  getCourierRegion,
  validateTrackingNumber,
} from '~/lib/orders/tracking.validation'

describe('courier catalog grouping', () => {
  it('excludes foreign-only posts from the vendor picker', () => {
    const values = COURIER_OPTIONS.map((o) => o.value)
    expect(values).not.toContain(COURIER_SLUGS.USPS)
    expect(values).not.toContain(COURIER_SLUGS.CANADA_POST)
    expect(values).not.toContain(COURIER_SLUGS.AUSTRALIA_POST)
    expect(getCourierRegion(COURIER_SLUGS.USPS)).toBe('legacy')
    expect(getCourierRegion(COURIER_SLUGS.CANADA_POST)).toBe('legacy')
    expect(getCourierRegion(COURIER_SLUGS.AUSTRALIA_POST)).toBe('legacy')
  })

  it('groups Domestic then International then Other', () => {
    expect(COURIER_OPTIONS_GROUPED.map((g) => g.region)).toEqual([
      'domestic',
      'international',
      'other',
    ])
    expect(COURIER_OPTIONS_GROUPED[0]?.title).toBe('Domestic (India)')
    expect(COURIER_OPTIONS_GROUPED[1]?.title).toBe('International')
    expect(COURIER_OPTIONS_GROUPED[2]?.options).toHaveLength(1)
    expect(COURIER_OPTIONS_GROUPED[2]?.options[0]?.value).toBe(COURIER_SLUGS.OTHER)
  })

  it('places key India and international partners in the right sections', () => {
    const domestic = new Set(DOMESTIC_COURIER_OPTIONS.map((o) => o.value))
    const international = new Set(INTERNATIONAL_COURIER_OPTIONS.map((o) => o.value))

    expect(domestic.has(COURIER_SLUGS.BLUE_DART)).toBe(true)
    expect(domestic.has(COURIER_SLUGS.DELHIVERY)).toBe(true)
    expect(domestic.has(COURIER_SLUGS.BORZO)).toBe(true)
    expect(domestic.has(COURIER_SLUGS.AMAZON_SHIPPING)).toBe(true)

    expect(international.has(COURIER_SLUGS.DHL)).toBe(true)
    expect(international.has(COURIER_SLUGS.FEDEX)).toBe(true)
    expect(international.has(COURIER_SLUGS.ARAMEX)).toBe(true)
    expect(international.has(COURIER_SLUGS.BLUE_DART)).toBe(false)
  })

  it('keeps Other last in the flat picker list', () => {
    expect(COURIER_OPTIONS.at(-1)?.value).toBe(COURIER_SLUGS.OTHER)
  })
})

describe('per-partner AWB validation', () => {
  it('accepts sample domestic AWBs', () => {
    expect(validateTrackingNumber('1234567890', COURIER_SLUGS.BLUE_DART).isValid).toBe(true)
    expect(validateTrackingNumber('123456789012', COURIER_SLUGS.DELHIVERY).isValid).toBe(true)
    expect(validateTrackingNumber('EA123456789IN', COURIER_SLUGS.INDIA_POST).isValid).toBe(true)
    expect(validateTrackingNumber('BRZ123456789', COURIER_SLUGS.BORZO).isValid).toBe(true)
  })

  it('accepts sample international AWBs', () => {
    expect(validateTrackingNumber('1234567890', COURIER_SLUGS.DHL).isValid).toBe(true)
    expect(validateTrackingNumber('123456789012', COURIER_SLUGS.FEDEX).isValid).toBe(true)
    expect(validateTrackingNumber('1Z123E456789012345', COURIER_SLUGS.UPS).isValid).toBe(true)
    expect(validateTrackingNumber('12345678901', COURIER_SLUGS.ARAMEX).isValid).toBe(true)
  })

  it('rejects clearly invalid AWBs', () => {
    expect(validateTrackingNumber('12', COURIER_SLUGS.BLUE_DART).isValid).toBe(false)
    expect(validateTrackingNumber('not-a-valid-awb!!!', COURIER_SLUGS.FEDEX).isValid).toBe(false)
  })
})

describe('getPublicTrackingUrl', () => {
  it('builds carrier track links for key partners', () => {
    expect(getPublicTrackingUrl('bluedart', '1234567890')).toContain('bluedart.com')
    expect(getPublicTrackingUrl('bluedart', '1234567890')).toContain('1234567890')
    expect(getPublicTrackingUrl('delhivery', '123456789012')).toContain('delhivery.com')
    expect(getPublicTrackingUrl('dhl', '1234567890')).toContain('dhl.com')
    expect(getPublicTrackingUrl('fedex', '123456789012')).toContain('fedex.com')
    expect(getPublicTrackingUrl('borzo', 'BRZ123')).toContain('borzo')
  })

  it('returns null without slug or AWB', () => {
    expect(getPublicTrackingUrl(null, '123')).toBeNull()
    expect(getPublicTrackingUrl('bluedart', '')).toBeNull()
    expect(getPublicTrackingUrl('unknown-carrier', '123456')).toBeNull()
  })
})
