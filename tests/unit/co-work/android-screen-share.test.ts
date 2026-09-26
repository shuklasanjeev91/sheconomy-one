import { describe, expect, it } from 'vitest'

import {
  SCREEN_SHARE_PUBLISH_OPTIONS,
  isLocalScreenShareTrackReady,
  isScreenShareSource,
} from '~/co-work/lib/livekit-screen-share'
import { ANDROID_PRESENT_UNAVAILABLE_MESSAGE } from '~/co-work/lib/android-present-build'
import { Track } from 'livekit-client'
import { softMediaToggleFailure } from '~/co-work/lib/meeting-mobile'

describe('Android screen-share publish contract', () => {
  it('publishes a single VP8 layer (no simulcast) for cross-platform subscribers', () => {
    expect(SCREEN_SHARE_PUBLISH_OPTIONS.videoCodec).toBe('vp8')
    expect(SCREEN_SHARE_PUBLISH_OPTIONS.simulcast).toBe(false)
    expect(SCREEN_SHARE_PUBLISH_OPTIONS.screenShareSimulcastLayers).toEqual([])
    expect(SCREEN_SHARE_PUBLISH_OPTIONS.source).toBe(Track.Source.ScreenShare)
  })

  it('recognizes screen-share track sources', () => {
    expect(isScreenShareSource(Track.Source.ScreenShare)).toBe(true)
    expect(isScreenShareSource(Track.Source.Camera)).toBe(false)
  })

  it('rejects ended or missing media tracks as not ready', () => {
    expect(isLocalScreenShareTrackReady(null)).toBe(false)
    expect(
      isLocalScreenShareTrackReady({
        track: {
          mediaStreamTrack: { readyState: 'ended', enabled: true },
        },
      } as never),
    ).toBe(false)
    expect(
      isLocalScreenShareTrackReady({
        track: {
          mediaStreamTrack: { readyState: 'live', enabled: true },
        },
      } as never),
    ).toBe(true)
  })

  it('preserves Play-update copy when Android Present is blocked on old binaries', () => {
    expect(softMediaToggleFailure('screen_share', new Error(ANDROID_PRESENT_UNAVAILABLE_MESSAGE))).toBe(
      ANDROID_PRESENT_UNAVAILABLE_MESSAGE,
    )
  })

  it('preserves MediaProjection blank-frame errors in soft toggle copy', () => {
    expect(
      softMediaToggleFailure(
        'screen_share',
        new Error('Screen share started without video frames. Update SHEconomy to the latest Android build'),
      ),
    ).toMatch(/without video frames/i)
  })

  it('preserves iOS ReplayKit blank-frame errors in soft toggle copy', () => {
    expect(
      softMediaToggleFailure(
        'screen_share',
        new Error(
          'Screen share started without video frames. Choose SHEconomy → Start Broadcast, keep the red status bar visible, and try again.',
        ),
      ),
    ).toMatch(/Start Broadcast/i)
  })
})
