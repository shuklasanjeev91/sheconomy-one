import { afterEach, describe, expect, it, vi } from 'vitest'

import { Linking, Platform } from 'react-native'

import { openAppStore, storeUrlCandidates } from '~/lib/updates/open-store'
import { startPlayImmediateUpdate } from '~/lib/updates/play-in-app-update'

vi.mock('react-native', () => ({
  Linking: {
    openURL: vi.fn(async () => undefined),
  },
  Platform: {
    OS: 'ios',
  },
}))

vi.mock('~/lib/updates/play-in-app-update', () => ({
  startPlayImmediateUpdate: vi.fn(async () => 'unavailable'),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  Platform.OS = 'ios'
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

  it('falls back to the Play Store listing after a cancelled forced Android in-app update', async () => {
    Platform.OS = 'android'
    vi.mocked(startPlayImmediateUpdate).mockResolvedValueOnce('cancelled')

    await expect(openAppStore({ fallbackOnCancel: true })).resolves.toBe(true)

    expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=com.sheconomy.ecommerce')
  })

  it('does not open the listing after a user-cancelled optional Android in-app update', async () => {
    Platform.OS = 'android'
    vi.mocked(startPlayImmediateUpdate).mockResolvedValueOnce('cancelled')

    await expect(openAppStore()).resolves.toBe(true)

    expect(Linking.openURL).not.toHaveBeenCalled()
  })
})
