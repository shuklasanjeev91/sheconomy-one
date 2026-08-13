import { describe, expect, it } from 'vitest'

import {
  canAccessFeature,
  canAccessPath,
  getAccessDeniedRedirect,
  getAccessTier,
  getGuestSignInReturnTo,
  getVisibleFeatures,
  hasVerifiedFemaleAccess,
  resolveFeatureNavHref,
  sanitizeReturnPath,
} from '~/lib/auth/access'

describe('access tiers (skip verification / women-first)', () => {
  it('only verified females get the full tier', () => {
    expect(getAccessTier(false, null, null)).toBe('guest')
    expect(getAccessTier(true, false, false)).toBe('male')
    expect(getAccessTier(true, true, false)).toBe('male')
    expect(getAccessTier(true, false, true)).toBe('male')
    expect(getAccessTier(true, true, true)).toBe('female')
    expect(hasVerifiedFemaleAccess(true, true)).toBe(true)
    expect(hasVerifiedFemaleAccess(true, false)).toBe(false)
    expect(hasVerifiedFemaleAccess(false, true)).toBe(false)
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

  it('limits unverified or male members to Commerce, Class, and Co-Work routes', () => {
    for (const path of ['/', '/listing/example', '/class', '/class/video', '/co-work', '/co-work/join']) {
      expect(canAccessPath('male', path, false)).toBe(true)
    }

    for (const path of [
      '/community',
      '/chat',
      '/notifications',
      '/profile',
      '/settings',
      '/create-my-shop',
      '/vendor',
    ]) {
      expect(canAccessPath('male', path, false)).toBe(false)
      expect(canAccessPath('female', path, true)).toBe(true)
    }
  })

  it('does not force guests to sign in for class / co-work', () => {
    expect(getGuestSignInReturnTo('guest', '/class')).toBeNull()
    expect(getGuestSignInReturnTo('guest', '/co-work')).toBeNull()
    expect(getGuestSignInReturnTo('guest', '/community')).toBe('/community')
  })

  it('opens Human verification for limited members on community / chat', () => {
    const redirect = String(getAccessDeniedRedirect('male', '/community', false))
    expect(redirect).toMatch(/human=verify/)
    expect(redirect).toMatch(/returnTo=/)
    expect(redirect).not.toMatch(/gender=restricted/)

    const chatNav = String(resolveFeatureNavHref('male', '/chat', 'chat'))
    expect(chatNav).toMatch(/human=verify/)

    const communityNav = String(resolveFeatureNavHref('male', '/community', 'community'))
    expect(communityNav).toMatch(/human=verify/)
  })

  it('keeps account gate on the restricted modal path for limited members', () => {
    const redirect = String(getAccessDeniedRedirect('male', '/settings', false))
    expect(redirect).toMatch(/gender=restricted/)
  })

  it('preserves Community intent after auth via Human verification open', () => {
    const path = sanitizeReturnPath('/community', 'male', false)
    expect(path).toMatch(/human=verify/)
    expect(decodeURIComponent(path)).toContain('/community')
  })

  it('preserves Create store intent after auth via Human verification open', () => {
    const path = sanitizeReturnPath('/create-my-shop', 'male', false)
    expect(path).toMatch(/human=verify/)
    expect(decodeURIComponent(path)).toContain('/create-my-shop')
  })
})
