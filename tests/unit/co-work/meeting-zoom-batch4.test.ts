import { describe, expect, it } from 'vitest'

import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { shouldShowSpeakingWhileMuted } from '~/co-work/lib/meeting-speaking-while-muted'
import { parseMeetingGalleryPrefs } from '~/co-work/lib/meeting-gallery-prefs'
import { meetingToolbarMoreKeys } from '~/co-work/lib/meeting-toolbar'
import {
  initialMeetingMachineState,
  meetingStateReducer,
} from '~/co-work/lib/meeting-state-machine'

function cameraTrack(
  identity: string,
  opts?: { speaking?: boolean; cameraOn?: boolean },
): TrackReferenceOrPlaceholder {
  return {
    participant: {
      identity,
      isSpeaking: !!opts?.speaking,
      isCameraEnabled: opts?.cameraOn !== false,
    },
    source: Track.Source.Camera,
    publication:
      opts?.cameraOn === false ? { isMuted: true } : { isMuted: false, track: {} },
  } as TrackReferenceOrPlaceholder
}

describe('Zoom parity batch 4 — host actions, speaking-muted, gallery filters', () => {
  it('shows speaking-while-muted only when muted and input is hot', () => {
    expect(
      shouldShowSpeakingWhileMuted({ muted: true, inputLevel: 0.4 }),
    ).toBe(true)
    expect(
      shouldShowSpeakingWhileMuted({ muted: false, inputLevel: 0.9 }),
    ).toBe(false)
    expect(
      shouldShowSpeakingWhileMuted({ muted: true, inputLevel: 0.02 }),
    ).toBe(false)
  })

  it('filters gallery to active speakers when enabled', () => {
    const tracks = [
      cameraTrack('a', { speaking: true }),
      cameraTrack('b', { speaking: false }),
      cameraTrack('me', { speaking: false }),
    ]
    const result = composeMeetingStageTracks(tracks, 'me', 'gallery', 'a', {
      activeSpeakersOnly: true,
    })
    const ids = result.stageTracks.map((t) => t.participant.identity)
    expect(ids).toContain('a')
    expect(ids).toContain('me')
    expect(ids).not.toContain('b')
  })

  it('persists side-by-side and active-speakers prefs in gallery prefs + machine', () => {
    expect(
      parseMeetingGalleryPrefs({ sideBySideShare: true, activeSpeakersOnly: true }),
    ).toMatchObject({ sideBySideShare: true, activeSpeakersOnly: true })

    let state = initialMeetingMachineState
    state = meetingStateReducer(state, { type: 'SET_SIDE_BY_SIDE_SHARE', enabled: true })
    state = meetingStateReducer(state, { type: 'SET_ACTIVE_SPEAKERS_ONLY', enabled: true })
    expect(state.sideBySideShare).toBe(true)
    expect(state.activeSpeakersOnly).toBe(true)
  })

  it('surfaces active speakers + side-by-side in More', () => {
    const more = meetingToolbarMoreKeys({
      viewerRole: 'participant',
      supportsVideo: true,
      reactionsOnPrimary: true,
    })
    expect(more).toContain('active_speakers_only')
    expect(more).toContain('side_by_side')
  })
})
