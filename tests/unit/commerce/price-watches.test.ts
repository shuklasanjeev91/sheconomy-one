import { describe, expect, it } from 'vitest'

import { normalizeTargetPrice, priceWatchHit } from '~/commerce/lib/price-watches'

describe('price watches', () => {
  it('keeps a positive target rounded to cents', () => {
    expect(normalizeTargetPrice(499.996)).toBe(500)
    expect(normalizeTargetPrice(0)).toBeNull()
    expect(normalizeTargetPrice(Number.NaN)).toBeNull()
  })

  it('hits when the live price is at or under the target', () => {
    expect(priceWatchHit(500, 500)).toBe(true)
    expect(priceWatchHit(500, 420)).toBe(true)
    expect(priceWatchHit(500, 501)).toBe(false)
    expect(priceWatchHit(500, null)).toBe(false)
  })
})
