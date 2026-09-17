import { describe, expect, it } from 'vitest'

import {
  meetingVideoMirrorTransform,
  shouldMirrorMeetingVideo,
} from '~/co-work/lib/meeting-video-mirror'

describe('meeting video mirror policy', () => {
  it('mirrors local camera self-view by default', () => {
    expect(
      shouldMirrorMeetingVideo({
        isLocal: true,
        source: 'camera',
      }),
    ).toBe(true)
    expect(
      shouldMirrorMeetingVideo({
        mirrorLocalVideo: true,
        isLocal: true,
        isScreenShare: false,
      }),
    ).toBe(true)
  })

  it('never mirrors remote participants', () => {
    expect(
      shouldMirrorMeetingVideo({
        mirrorLocalVideo: true,
        isLocal: false,
        source: 'camera',
      }),
    ).toBe(false)
  })

  it('never mirrors screen share (local or remote)', () => {
    expect(
      shouldMirrorMeetingVideo({
        mirrorLocalVideo: true,
        isLocal: true,
        isScreenShare: true,
      }),
    ).toBe(false)
    expect(
      shouldMirrorMeetingVideo({
        mirrorLocalVideo: true,
        isLocal: true,
        source: 'screen_share',
      }),
    ).toBe(false)
  })

  it('respects Mirror my video OFF', () => {
    expect(
      shouldMirrorMeetingVideo({
        mirrorLocalVideo: false,
        isLocal: true,
        source: 'camera',
      }),
    ).toBe(false)
  })

  it('exposes the web scaleX transform only when mirrored', () => {
    expect(meetingVideoMirrorTransform(true)).toBe('scaleX(-1)')
    expect(meetingVideoMirrorTransform(false)).toBeUndefined()
  })
})
