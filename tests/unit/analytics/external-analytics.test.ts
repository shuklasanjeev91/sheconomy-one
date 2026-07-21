import { describe, expect, it } from 'vitest'

import { ANALYTICS_CONFIG } from '~/lib/analytics/config'
import {
  compactAnalyticsProperties,
  sanitizeAnalyticsEventName,
} from '~/lib/analytics/types'

describe('analytics helpers', () => {
  it('keeps legacy provider IDs as defaults', () => {
    expect(ANALYTICS_CONFIG.googleTagManagerId).toBe('GTM-5Q46HTDR')
    expect(ANALYTICS_CONFIG.googleAnalyticsId).toBe('G-ZQWD6CCEPY')
    expect(ANALYTICS_CONFIG.metaPixelId).toBe('871397487664970')
    expect(ANALYTICS_CONFIG.clarityProjectId).toBe('vgpk0whxnd')
  })

  it('sanitizes custom event names', () => {
    expect(sanitizeAnalyticsEventName(' Add To Cart! ')).toBe('add_to_cart')
    expect(sanitizeAnalyticsEventName('View-Item')).toBe('view_item')
  })

  it('drops undefined analytics properties', () => {
    expect(
      compactAnalyticsProperties({
        currency: 'INR',
        value: 10,
        transaction_id: undefined,
        active: true,
      }),
    ).toEqual({
      currency: 'INR',
      value: 10,
      active: true,
    })
  })
})
