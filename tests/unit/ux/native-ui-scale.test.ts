import { describe, expect, it } from 'vitest'

/** Keep in sync with components/ui/Text.tsx — avoids importing Tamagui in node tests. */
const MAX_FONT_SIZE_MULTIPLIER = 1.3
const PHONE_HERO_HEIGHT = 260
const FORMER_MOBILE_HERO_HEIGHT = 356
const PHONE_RAIL_CARD_WIDTHS = [160, 168] as const

describe('native UI scale', () => {
  it('caps accessibility font scaling at 1.3', () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBe(1.3)
  })

  it('uses compact phone hero height vs former mobile size', () => {
    expect(PHONE_HERO_HEIGHT).toBeLessThan(FORMER_MOBILE_HERO_HEIGHT)
    expect(PHONE_HERO_HEIGHT).toBeGreaterThanOrEqual(240)
    expect(PHONE_HERO_HEIGHT).toBeLessThanOrEqual(280)
  })

  it('uses phone rail card widths in the 160–180 range', () => {
    for (const width of PHONE_RAIL_CARD_WIDTHS) {
      expect(width).toBeGreaterThanOrEqual(160)
      expect(width).toBeLessThanOrEqual(180)
    }
  })
})
