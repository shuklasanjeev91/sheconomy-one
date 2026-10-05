import { afterEach, describe, expect, it, vi } from 'vitest'

import { storeUrlCandidates } from '~/lib/updates/open-store'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('storeUrlCandidates', () => {
  it('opens the App Store app before the web listing on iOS', () => {
    vi.stubEnv('EXPO_PUBLIC_IOS_APP_STORE_URL', '')
    expect(storeUrlCandidates('ios')).toEqual([
      'itms-apps://apps.apple.com/app/id6499198194',
      'https://apps.apple.com/app/id6499198194',
    ])
  })

  it('opens the Play Store app before the web listing on Android', () => {
    vi.stubEnv('EXPO_PUBLIC_ANDROID_PLAY_STORE_URL', '')
    const [first, second] = storeUrlCandidates('android')
    expect(first).toBe('market://details?id=com.sheconomy.ecommerce')
    expect(second).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.sheconomy\.ecommerce/)
  })
})
