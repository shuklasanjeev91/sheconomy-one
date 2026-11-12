import { describe, expect, it } from 'vitest'

import {
  isValidZip,
  mockDeliveryEstimateFromZip,
  normalizeZip,
} from '~/commerce/lib/mock-delivery-estimate'

describe('mockDeliveryEstimateFromZip', () => {
  it('normalizes and validates ZIP', () => {
    expect(normalizeZip(' 110001 ')).toBe('110001')
    expect(isValidZip('110001')).toBe(true)
    expect(isValidZip('12')).toBe(false)
  })

  it('returns deterministic estimate for same ZIP', () => {
    const a = mockDeliveryEstimateFromZip('560001')
    const b = mockDeliveryEstimateFromZip('560001')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.label).toBe(b!.label)
    expect(a!.earliestBusinessDays).toBe(b!.earliestBusinessDays)
    expect(a!.label.toLowerCase()).toContain('get it by')
  })

  it('returns null for invalid ZIP', () => {
    expect(mockDeliveryEstimateFromZip('')).toBeNull()
    expect(mockDeliveryEstimateFromZip('ab')).toBeNull()
  })
})
