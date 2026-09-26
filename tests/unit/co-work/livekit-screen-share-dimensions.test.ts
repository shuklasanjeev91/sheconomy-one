import { describe, expect, it, vi } from 'vitest'

import {
  forceScreenShareTrackSettings,
  nativeCapturerReportsVideoSize,
  peekUnpatchedVideoSize,
  patchLiveKitWaitForDimensions,
} from '~/co-work/lib/livekit-patch-dimensions'

describe('livekit screen-share dimension patch', () => {
  it('forceScreenShareTrackSettings fills 0×0 getSettings with 720p', () => {
    const track = {
      kind: 'video',
      getSettings: vi.fn(() => ({ width: 0, height: 0, frameRate: 0 })),
    } as unknown as MediaStreamTrack

    forceScreenShareTrackSettings(track)
    const settings = track.getSettings()
    expect(settings.width).toBe(1280)
    expect(settings.height).toBe(720)
  })

  it('forceScreenShareTrackSettings leaves real dimensions alone', () => {
    const track = {
      kind: 'video',
      getSettings: vi.fn(() => ({ width: 1920, height: 1080, frameRate: 30 })),
    } as unknown as MediaStreamTrack

    forceScreenShareTrackSettings(track)
    expect(track.getSettings()).toEqual({ width: 1920, height: 1080, frameRate: 30 })
  })

  it('peekUnpatchedVideoSize still sees the real 0×0 capture after the fallback patch', () => {
    const track = {
      kind: 'video',
      getSettings: vi.fn(() => ({ width: 0, height: 0, frameRate: 0 })),
    } as unknown as MediaStreamTrack

    forceScreenShareTrackSettings(track)
    expect(track.getSettings().width).toBe(1280)
    expect(peekUnpatchedVideoSize(track)).toEqual({ width: 0, height: 0 })
  })

  it('detects Android MediaProjection settings that report size keys', () => {
    const track = {
      kind: 'video',
      getSettings: vi.fn(() => ({
        deviceId: 'screen-capture',
        groupId: '',
        width: 1080,
        height: 2400,
        frameRate: 30,
      })),
    } as unknown as MediaStreamTrack

    expect(nativeCapturerReportsVideoSize(track)).toBe(true)
  })

  it('treats iOS ReplayKit settings (no width/height keys) as size-less', () => {
    // ScreenCaptureController.getSettings / empty getDisplayMedia trackInfo.
    const replayKit = {
      kind: 'video',
      getSettings: vi.fn(() => ({
        deviceId: 'screen-capture',
        groupId: '',
        frameRate: 30,
      })),
    } as unknown as MediaStreamTrack
    const empty = {
      kind: 'video',
      getSettings: vi.fn(() => ({})),
    } as unknown as MediaStreamTrack

    expect(nativeCapturerReportsVideoSize(replayKit)).toBe(false)
    expect(nativeCapturerReportsVideoSize(empty)).toBe(false)

    forceScreenShareTrackSettings(empty)
    // Forced 720p must not flip the capturer to "reports size".
    expect(empty.getSettings().width).toBe(1280)
    expect(nativeCapturerReportsVideoSize(empty)).toBe(false)
    expect(peekUnpatchedVideoSize(empty)).toEqual({ width: 0, height: 0 })
  })

  it('patchLiveKitWaitForDimensions is idempotent', () => {
    expect(() => {
      patchLiveKitWaitForDimensions()
      patchLiveKitWaitForDimensions()
    }).not.toThrow()
  })
})
