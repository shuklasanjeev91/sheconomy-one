import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('androidPresentUnavailable', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('react-native')
    vi.resetModules()
  })

  it('blocks Present on older Android binaries without MediaProjection FGS', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }))
    const { androidPresentUnavailable, ANDROID_PRESENT_UNAVAILABLE_MESSAGE } = await import(
      '~/co-work/lib/android-present-build'
    )
    expect(androidPresentUnavailable(177)).toBe(true)
    expect(ANDROID_PRESENT_UNAVAILABLE_MESSAGE).toMatch(/Play Store/i)
  })

  it('allows Present on Android binaries that ship MediaProjection', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(182)).toBe(false)
  })

  it('blocks Present when the native versionCode cannot be read', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(null)).toBe(true)
  })

  it('is false on iOS', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }))
    const { androidPresentUnavailable } = await import('~/co-work/lib/android-present-build')
    expect(androidPresentUnavailable(100)).toBe(false)
  })
})
