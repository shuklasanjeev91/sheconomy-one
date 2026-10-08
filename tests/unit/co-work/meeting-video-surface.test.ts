import { describe, expect, it } from 'vitest'

import {
  meetingVideoObjectFit,
  meetingVideoTrackRemountKey,
  nextMeetingVideoSurfaceSize,
} from '~/co-work/lib/meeting-video-surface'

describe('meeting video surface remounts', () => {
  it('ignores sub-snap layout jitter that would remount RTCView', () => {
    const first = nextMeetingVideoSurfaceSize(null, { w: 366, h: 221 })
    const second = nextMeetingVideoSurfaceSize(first, { w: 369, h: 224 })
    expect(second).toBe(first)
  })

  it('updates when the tile actually changes size', () => {
    const first = nextMeetingVideoSurfaceSize(null, { w: 360, h: 220 })
    const second = nextMeetingVideoSurfaceSize(first, { w: 720, h: 400 })
    expect(second).not.toBe(first)
    expect(second.w).toBeGreaterThan(first.w)
  })

  it('does not remount when camera capture resolution changes', () => {
    const surfaceA = { w: 360, h: 220 }
    const surfaceB = { w: 720, h: 400 }
    expect(
      meetingVideoTrackRemountKey({
        trackSid: 'TR_1',
        streamId: 'stream-a',
        surface: surfaceA,
        isScreen: false,
        mirrored: true,
      }),
    ).toBe(
      meetingVideoTrackRemountKey({
        trackSid: 'TR_1',
        streamId: 'stream-a',
        surface: surfaceB,
        isScreen: false,
        mirrored: true,
      }),
    )
  })

  it('snaps with a wider threshold so speak borders do not thrash surfaces', () => {
    const first = nextMeetingVideoSurfaceSize(null, { w: 360, h: 220 })
    const second = nextMeetingVideoSurfaceSize(first, { w: 372, h: 228 })
    expect(second).toBe(first)
  })

  it('forms a valid remount key with mediaReadyToken streamId', () => {
    const key = meetingVideoTrackRemountKey({
      trackSid: 'TR_123',
      streamId: 'stream-ready-token',
      surface: { w: 640, h: 480 },
      isScreen: false,
      mirrored: true,
    })
    expect(key).toBe('TR_123-stream-ready-token-cam-m')
  })
})

describe('meeting video surface fit', () => {
  it('contains screen shares', () => {
    expect(meetingVideoObjectFit({ isScreen: true, videoWidth: 1920, videoHeight: 1080 })).toBe(
      'contain',
    )
  })

  it('covers camera video when the video and tile aspects are close', () => {
    expect(
      meetingVideoObjectFit({
        videoWidth: 1280,
        videoHeight: 720,
        tileWidth: 640,
        tileHeight: 360,
      }),
    ).toBe('cover')
  })

  it('contains camera video when portrait and landscape orientation disagree', () => {
    expect(
      meetingVideoObjectFit({
        videoWidth: 720,
        videoHeight: 1280,
        tileWidth: 640,
        tileHeight: 360,
      }),
    ).toBe('contain')
    expect(
      meetingVideoObjectFit({
        videoWidth: 1280,
        videoHeight: 720,
        tileWidth: 360,
        tileHeight: 640,
      }),
    ).toBe('contain')
  })
})
