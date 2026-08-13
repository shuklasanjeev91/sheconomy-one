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
  resolveFeatureNavIntent,
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

describe('feature nav intent', () => {
  const press = (over: {
    href: string
    feature: Parameters<typeof canAccessFeature>[1]
    tier: Parameters<typeof canAccessFeature>[0]
    isAuthenticated?: boolean
    isTierKnown?: boolean
  }) =>
    resolveFeatureNavIntent({
      isAuthenticated: true,
      isTierKnown: true,
      ...over,
    })

  it('lets verified females straight through to community and chat', () => {
    expect(press({ href: '/community', feature: 'community', tier: 'female' })).toEqual({
      kind: 'navigate',
      href: '/community',
    })
    expect(press({ href: '/chat', feature: 'chat', tier: 'female' })).toEqual({
      kind: 'navigate',
      href: '/chat',
    })
  })

  it('sends limited members to verification and guests to sign-in', () => {
    expect(press({ href: '/community', feature: 'community', tier: 'male' })).toEqual({
      kind: 'verify',
      returnTo: '/community',
    })
    expect(
      press({ href: '/chat', feature: 'chat', tier: 'guest', isAuthenticated: false }),
    ).toEqual({ kind: 'sign-in', href: '/chat' })
  })

  it('navigates instead of gating while the profile is still unknown', () => {
    // An unsettled profile resolves to the limited tier. Gating on it is what made
    // a verified member's tab press turn into a dropped verification request.
    for (const feature of ['community', 'chat'] as const) {
      expect(
        press({ href: `/${feature}`, feature, tier: 'male', isTierKnown: false }),
      ).toEqual({ kind: 'navigate', href: `/${feature}` })
    }
  })

  it('keeps shared surfaces reachable for every tier', () => {
    expect(press({ href: '/', feature: 'commerce', tier: 'male' }).kind).toBe('navigate')
    expect(press({ href: '/class', feature: 'class', tier: 'guest' }).kind).toBe('navigate')
  })

  it('resolveFeatureNavHref does not divert while the tier is unknown', () => {
    expect(String(resolveFeatureNavHref('male', '/community', 'community', false))).toBe(
      '/community',
    )
    expect(String(resolveFeatureNavHref('male', '/community', 'community', true))).toMatch(
      /human=verify/,
    )
  })
})
