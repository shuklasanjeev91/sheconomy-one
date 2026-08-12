import { describe, expect, it } from 'vitest'

import {
  resolvePostOnboardingHref,
  shouldOfferContactsAfterOnboarding,
} from '~/features/auth/services/onboarding'

describe('resolvePostOnboardingHref', () => {
  it('prefers an explicit safe returnTo over intents', () => {
    expect(resolvePostOnboardingHref(['learning'], '/orders')).toBe('/orders')
  })

  it('routes by intent priority', () => {
    expect(resolvePostOnboardingHref(['shopping', 'selling'])).toBe('/create-my-shop')
    expect(resolvePostOnboardingHref(['hiring'])).toBe('/community/jobs')
    expect(resolvePostOnboardingHref(['networking'])).toBe('/community')
    expect(resolvePostOnboardingHref(['learning'])).toBe('/class')
    expect(resolvePostOnboardingHref(['shopping'])).toBe('/')
    expect(resolvePostOnboardingHref([])).toBe('/')
  })
})

describe('shouldOfferContactsAfterOnboarding', () => {
  it('offers contacts only for commerce/shopping landings', () => {
    expect(shouldOfferContactsAfterOnboarding(['shopping'])).toBe(true)
    expect(shouldOfferContactsAfterOnboarding(['learning'])).toBe(false)
    expect(shouldOfferContactsAfterOnboarding(['selling'])).toBe(false)
    expect(shouldOfferContactsAfterOnboarding(['shopping'], '/community')).toBe(false)
  })
})
