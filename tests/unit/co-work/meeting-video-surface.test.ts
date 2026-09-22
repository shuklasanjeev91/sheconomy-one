import { describe, expect, it } from 'vitest'

import {
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
})
