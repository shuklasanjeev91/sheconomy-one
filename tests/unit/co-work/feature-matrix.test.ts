import { describe, expect, it } from 'vitest'

import { breakoutMediaRoomName } from '~/co-work/lib/meeting-breakouts'
import {
  MEETING_SUBSCRIBE_ALL_BELOW,
  resolveSubscribeCameraIdentities,
} from '~/co-work/lib/meeting-selective-subscribe'
import {
  meetingGalleryScrollLayout,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { mapMeetingSecurityJoinError } from '~/co-work/lib/meeting-security'
import { meetingToolbarMoreKeys, meetingToolbarPrimaryKeys } from '~/co-work/lib/meeting-toolbar'
import type { MeetingStageTrack } from '~/co-work/lib/meeting-stage-tracks'

/**
 * Cross-platform Co-Work feature matrix (web + iOS + Android).
 * Pure helpers only — no media SDK/DOM. Guards Zoom-like 1–N room behavior.
 */
describe('co-work feature matrix (web + native)', () => {
  it('exposes host primary controls including share, more, end on Zoom dock', () => {
    const keys = meetingToolbarPrimaryKeys({
      viewerRole: 'host',
      supportsVideo: true,
      supportsScreenShare: true,
      supportsLiveCaptions: true,
      supportsRecording: true,
    })
    for (const key of [
      'mic',
      'camera',
      'participants',
      'chat',
      'reactions',
      'share_screen',
      'captions',
      'whiteboard',
      'docs',
      'apps',
      'more',
      'end_meeting',
    ] as const) {
      expect(keys).toContain(key)
    }
  })

  it('exposes participant More keys for polls and Q&A without host-only breakouts unless enabled', () => {
    const participant = meetingToolbarMoreKeys({
      viewerRole: 'participant',
      supportsVideo: true,
      hasPolls: true,
      hasQa: true,
      hasBreakouts: false,
      reactionsOnPrimary: true,
      raiseHandOnPrimary: true,
    })
    expect(participant).toContain('polls')
    expect(participant).toContain('qna')
    expect(participant).not.toContain('breakout_rooms')
    expect(participant).not.toContain('host_tools')

    const host = meetingToolbarMoreKeys({
      viewerRole: 'host',
      supportsVideo: true,
      hasPolls: true,
      hasQa: true,
      hasBreakouts: true,
      reactionsOnPrimary: true,
      raiseHandOnPrimary: true,
    })
    expect(host).toContain('breakout_rooms')
    expect(host).toContain('host_tools')
  })

  it('builds breakout media room names from the shared main room id', () => {
    expect(breakoutMediaRoomName('mainroom', 'bo-uuid')).toBe('mainroom__bo__bo-uuid')
  })

  it('maps MEETING_FULL to a user-facing capacity message', () => {
    expect(mapMeetingSecurityJoinError('MEETING_FULL')).toMatch(/full/i)
  })

  it('fills one screen of the gallery and scrolls the rest of a large room', () => {
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 9,
        denseGallery: false,
        breakpoint: 'mobile',
      }),
    ).toBe(9)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 25,
        denseGallery: true,
        breakpoint: 'large-desktop',
      }),
    ).toBe(25)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 9,
        denseGallery: true,
        breakpoint: 'mobile',
      }),
    ).toBe(12)

    const gallery = meetingGalleryScrollLayout(100, {
      screenSize: 12,
      width: 390,
      height: 700,
    })
    expect(gallery.scrolls).toBe(true)
    expect(gallery.columns * gallery.visibleRows).toBe(12)
    expect(gallery.rows).toBe(Math.ceil(100 / gallery.columns))
  })

  it('composes gallery stage with every remote + local camera (1–N peers)', () => {
    const tracks = [0, 1, 2, 3].map((n) => ({
      participant: { identity: `u${n}`, isSpeaking: false },
      source: 'camera',
      publication: undefined,
    })) as unknown as MeetingStageTrack[]

    const stage = composeMeetingStageTracks(tracks, 'u0', 'gallery', null, false)
    expect(stage.stageTracks).toHaveLength(4)
    expect(stage.filmstripTracks).toHaveLength(0)
  })

  it(`subscribes all cameras below ${MEETING_SUBSCRIBE_ALL_BELOW} remotes`, () => {
    const remotes = Array.from({ length: MEETING_SUBSCRIBE_ALL_BELOW }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0'],
      }),
    ).toEqual(remotes)
  })

  it('only subscribes on-screen cameras in larger rooms', () => {
    const remotes = Array.from({ length: 25 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1'],
        speakingIdentities: ['u20'],
      }),
    ).toEqual(['u0', 'u1', 'u20'])
  })
})
