import { describe, expect, it } from 'vitest'

import {
  MEETING_SUBSCRIBE_ALL_BELOW,
  MeetingVideoQuality,
  meetingCameraQualityForTile,
  resolveSubscribeCameraIdentities,
} from '~/co-work/lib/meeting-selective-subscribe'

describe('resolveSubscribeCameraIdentities', () => {
  it('subscribes every remote when the room is small (1–N Zoom gallery)', () => {
    const remotes = Array.from({ length: MEETING_SUBSCRIBE_ALL_BELOW }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1'],
      }),
    ).toEqual(remotes)
  })

  it('does not decode off-screen cameras in a 12-person room', () => {
    const remotes = Array.from({ length: 12 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1'],
      }),
    ).toEqual(['u0', 'u1'])
  })

  it('caps to visible page + filmstrip + speakers in large rooms', () => {
    const remotes = Array.from({ length: 80 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1', 'u2'],
        filmstripIdentities: ['u10'],
        speakingIdentities: ['u50'],
      }),
    ).toEqual(['u0', 'u1', 'u2', 'u10', 'u50'])
  })
})

describe('meetingCameraQualityForTile', () => {
  it('uses the low layer for thumbnails and dense phone grids', () => {
    expect(meetingCameraQualityForTile({ width: 132, height: 84 })).toBe(MeetingVideoQuality.LOW)
    expect(meetingCameraQualityForTile({ width: 120, height: 155 })).toBe(MeetingVideoQuality.LOW)
    expect(meetingCameraQualityForTile({ width: 0, height: 0 })).toBe(MeetingVideoQuality.LOW)
  })

  it('uses the medium layer for mid-size tiles', () => {
    expect(meetingCameraQualityForTile({ width: 190, height: 300 })).toBe(MeetingVideoQuality.MEDIUM)
    expect(meetingCameraQualityForTile({ width: 340, height: 200 })).toBe(MeetingVideoQuality.MEDIUM)
  })

  it('only decodes 720p for large tiles with HD video on', () => {
    expect(meetingCameraQualityForTile({ width: 390, height: 640 })).toBe(MeetingVideoQuality.HIGH)
    expect(meetingCameraQualityForTile({ width: 390, height: 640, hdVideo: false })).toBe(
      MeetingVideoQuality.MEDIUM,
    )
  })
})
