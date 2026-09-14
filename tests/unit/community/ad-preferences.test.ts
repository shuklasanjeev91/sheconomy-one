import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AD_PREFERENCES,
  normalizeAdPreferences,
} from '~/community/lib/ad-preferences'

describe('advertising preference defaults', () => {
  it('defaults every behavioral and external analytics choice to false', () => {
    expect(DEFAULT_AD_PREFERENCES).toEqual({
      personalizedAds: false,
      retargetingNotifications: false,
      externalAnalytics: false,
    })
    expect(normalizeAdPreferences(undefined)).toEqual(DEFAULT_AD_PREFERENCES)
    expect(normalizeAdPreferences({})).toEqual(DEFAULT_AD_PREFERENCES)
  })

  it('accepts explicit booleans from the app preference shape', () => {
    expect(
      normalizeAdPreferences({
        personalizedAds: true,
        retargetingNotifications: true,
        externalAnalytics: true,
      }),
    ).toEqual({
      personalizedAds: true,
      retargetingNotifications: true,
      externalAnalytics: true,
    })
  })

  it('maps audience membership to retargeting when the dedicated column is absent', () => {
    expect(
      normalizeAdPreferences({
        personalized_ads: false,
        audience_membership_allowed: true,
      }),
    ).toEqual({
      personalizedAds: false,
      retargetingNotifications: true,
      externalAnalytics: false,
    })
  })

  it('normalizes database column names', () => {
    expect(
      normalizeAdPreferences({
        personalized_ads: true,
        retargeting_notifications: false,
        external_analytics: true,
      }),
    ).toEqual({
      personalizedAds: true,
      retargetingNotifications: false,
      externalAnalytics: true,
    })
  })

  it('does not treat truthy or malformed values as consent', () => {
    expect(
      normalizeAdPreferences({
        personalizedAds: 'true',
        retargetingNotifications: 1,
        externalAnalytics: {},
      }),
    ).toEqual(DEFAULT_AD_PREFERENCES)
    expect(normalizeAdPreferences('true')).toEqual(DEFAULT_AD_PREFERENCES)
  })
})
