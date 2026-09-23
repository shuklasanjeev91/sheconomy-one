import { describe, expect, it } from 'vitest'

import { breakoutLiveKitRoomName } from '~/co-work/lib/meeting-breakouts'
import {
  MEETING_SUBSCRIBE_ALL_BELOW,
  resolveSubscribeCameraIdentities,
} from '~/co-work/lib/meeting-selective-subscribe'
import {
  paginateMeetingGallery,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { mapMeetingSecurityJoinError } from '~/co-work/lib/meeting-security'
import { meetingToolbarMoreKeys, meetingToolbarPrimaryKeys } from '~/co-work/lib/meeting-toolbar'
import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'

/**
 * Cross-platform Co-Work feature matrix (web + iOS + Android).
 * Pure helpers only — no LiveKit/DOM. Guards Zoom-like 1–N room behavior.
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

  it('builds breakout LiveKit room names from the shared main room id', () => {
    expect(breakoutLiveKitRoomName('mainroom', 'bo-uuid')).toBe('mainroom__bo__bo-uuid')
  })

  it('maps MEETING_FULL to a user-facing capacity message', () => {
    expect(mapMeetingSecurityJoinError('MEETING_FULL')).toMatch(/full/i)
  })

  it('paginates gallery with denser mobile pages so large rooms need fewer swipes', () => {
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

    const tiles = Array.from({ length: 100 }, (_, i) => i)
    const page = paginateMeetingGallery(tiles, 0, 12)
    expect(page.items).toHaveLength(12)
    expect(page.pageCount).toBe(9)
  })

  it('composes gallery stage with every remote + local camera (1–N peers)', () => {
    const tracks = [0, 1, 2, 3].map((n) => ({
      participant: { identity: `u${n}`, isSpeaking: false },
      source: Track.Source.Camera,
      publication: undefined,
    })) as unknown as TrackReferenceOrPlaceholder[]

    const stage = composeMeetingStageTracks(tracks, 'u0', 'gallery', null, false)
    expect(stage.stageTracks).toHaveLength(4)
    expect(stage.filmstripTracks).toHaveLength(0)
  })

  it(`subscribes all cameras below ${MEETING_SUBSCRIBE_ALL_BELOW} remotes`, () => {
    const remotes = Array.from({ length: 10 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0'],
      }),
    ).toEqual(remotes)
  })
})
