import { describe, expect, it } from 'vitest'

import {
  canAccessFeature,
  canAccessPath,
  getAccessDeniedRedirect,
  getAccessTier,
  getGuestSignInReturnTo,
  getVisibleFeatures,
  hasVerifiedFemaleAccess,
} from '~/lib/auth/access'

describe('access tiers (skip verification / women-first)', () => {
  it('only verified females get the full tier', () => {
    expect(getAccessTier(false, null, null)).toBe('guest')
    expect(getAccessTier(true, false, false)).toBe('male')
    expect(getAccessTier(true, true, false)).toBe('male')
    expect(getAccessTier(true, true, true)).toBe('female')
    expect(hasVerifiedFemaleAccess(true, true)).toBe(true)
    expect(hasVerifiedFemaleAccess(true, false)).toBe(false)
  })

  it('guests and limited members share Commerce, Classes, and Co-Work', () => {
    for (const tier of ['guest', 'male'] as const) {
      expect(canAccessFeature(tier, 'commerce')).toBe(true)
      expect(canAccessFeature(tier, 'class')).toBe(true)
      expect(canAccessFeature(tier, 'co-work')).toBe(true)
      expect(canAccessFeature(tier, 'community')).toBe(false)
      expect(canAccessFeature(tier, 'chat')).toBe(false)
      expect(canAccessFeature(tier, 'account')).toBe(false)
    }
    expect(getVisibleFeatures('guest')).toEqual(
      expect.arrayContaining(['commerce', 'class', 'co-work']),
    )
  })

  it('verified females can open women-first routes', () => {
    expect(canAccessPath('female', '/community', true)).toBe(true)
    expect(canAccessPath('female', '/chat', true)).toBe(true)
    expect(canAccessPath('male', '/community', false)).toBe(false)
    expect(canAccessPath('guest', '/community')).toBe(false)
    expect(canAccessPath('guest', '/class')).toBe(true)
    expect(canAccessPath('guest', '/co-work')).toBe(true)
  })

  it('does not force guests to sign in for class / co-work', () => {
    expect(getGuestSignInReturnTo('guest', '/class')).toBeNull()
    expect(getGuestSignInReturnTo('guest', '/co-work')).toBeNull()
    expect(getGuestSignInReturnTo('guest', '/community')).toBe('/community')
  })

  it('sends limited members away from community toward a safe browse path', () => {
    const redirect = String(getAccessDeniedRedirect('male', '/community', false))
    expect(redirect).toMatch(/gender=restricted/)
  })
})
