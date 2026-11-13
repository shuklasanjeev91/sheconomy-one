import { describe, expect, it } from 'vitest'

import { isValidZip, normalizeZip } from '~/commerce/lib/delivery-zip'
import {
  formatGetItByLabel,
  transitDaysFromLocations,
} from '~/commerce/lib/location-delivery-estimate'

describe('delivery zip helpers', () => {
  it('normalizes and validates ZIP', () => {
    expect(normalizeZip(' 110001 ')).toBe('110001')
    expect(isValidZip('110001')).toBe(true)
    expect(isValidZip('12')).toBe(false)
  })

  it('returns nullish invalid ZIP', () => {
    expect(isValidZip('')).toBe(false)
    expect(isValidZip('ab')).toBe(false)
  })
})

describe('location delivery estimate', () => {
  it('builds a Get it by window', () => {
    const label = formatGetItByLabel(3, 5)
    expect(label.toLowerCase()).toContain('get it by')
  })

  it('uses local band for same city', () => {
    const window = transitDaysFromLocations(
      { city: 'Faridabad', state: 'Haryana', country: 'IN', postalCode: '121001' },
      { city: 'Faridabad', state: 'Haryana', country: 'IN', postalCode: '121003' },
    )
    expect(window.band).toBe('local')
    expect(window.label.toLowerCase()).toContain('get it by')
  })

  it('uses national band across distant pins', () => {
    const window = transitDaysFromLocations(
      { city: 'Mumbai', state: 'Maharashtra', country: 'IN', postalCode: '400001' },
      { city: 'Faridabad', state: 'Haryana', country: 'IN', postalCode: '121001' },
    )
    expect(window.band).toBe('national')
    expect(window.earliestDays).toBeGreaterThanOrEqual(3)
  })
})
