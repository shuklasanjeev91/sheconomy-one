import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('getMediaCapabilities cross-platform', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('react-native')
    vi.resetModules()
  })

  it('enables screen share on Android (MediaProjection Present)', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }))
    const { getMediaCapabilities } = await import('~/co-work/lib/media')
    const caps = getMediaCapabilities()
    expect(caps.platform).toBe('android')
    expect(caps.supportsVideo).toBe(true)
    expect(caps.supportsScreenShare).toBe(true)
    expect(caps.supportsRecording).toBe(true)
    expect(caps.supportsLiveCaptions).toBe(true)
  })

  it('enables screen share on iOS (ReplayKit picker path)', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }))
    const { getMediaCapabilities } = await import('~/co-work/lib/media')
    const caps = getMediaCapabilities()
    expect(caps.platform).toBe('ios')
    expect(caps.supportsScreenShare).toBe(true)
    expect(caps.supportsVideo).toBe(true)
  })
})
