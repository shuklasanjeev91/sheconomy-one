import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('androidPresentNeedsNativeUpdate', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('react-native')
    vi.doUnmock('expo-constants')
    vi.resetModules()
  })

  it('flags store builds below MediaProjection versionCode 170', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }))
    vi.doMock('expo-constants', () => ({ default: { nativeBuildVersion: '167' } }))
    const { androidPresentNeedsNativeUpdate, ANDROID_PRESENT_MIN_VERSION_CODE } = await import(
      '~/co-work/lib/android-present-build'
    )
    expect(ANDROID_PRESENT_MIN_VERSION_CODE).toBe(170)
    expect(androidPresentNeedsNativeUpdate()).toBe(true)
  })

  it('allows versionCode 170+', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }))
    vi.doMock('expo-constants', () => ({ default: { nativeBuildVersion: '170' } }))
    const { androidPresentNeedsNativeUpdate } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentNeedsNativeUpdate()).toBe(false)
  })

  it('is false on iOS', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }))
    vi.doMock('expo-constants', () => ({ default: { nativeBuildVersion: '1' } }))
    const { androidPresentNeedsNativeUpdate } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentNeedsNativeUpdate()).toBe(false)
  })
})
