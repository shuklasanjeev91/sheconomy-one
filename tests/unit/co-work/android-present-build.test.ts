import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('androidPresentUnavailable', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('react-native')
    vi.resetModules()
  })

  it('blocks Present on ancient Android binaries without MediaProjection', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: {},
    }))
    const { androidPresentUnavailable, ANDROID_PRESENT_UNAVAILABLE_MESSAGE } = await import(
      '~/co-work/lib/android-present-build'
    )
    expect(androidPresentUnavailable(150)).toBe(true)
    expect(ANDROID_PRESENT_UNAVAILABLE_MESSAGE).toMatch(/Play Store/i)
  })

  it('blocks Present on 6.0.19 binaries that stripped FGS', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: { WebRTCModule: { getDisplayMedia: () => {} } },
    }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(196)).toBe(true)
  })

  it('allows Present on Android binaries that ship MediaProjection again', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: { WebRTCModule: {} },
    }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(197)).toBe(false)
  })

  it('blocks Present when versionCode cannot be read and WebRTC is missing', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      NativeModules: {},
    }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(null)).toBe(true)
  })

  it('is false on iOS', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
      NativeModules: {},
    }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(100)).toBe(false)
  })
})
