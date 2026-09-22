import { describe, expect, it } from 'vitest'

import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import {
  isMeetingNonverbalStatusId,
  meetingNonverbalEmoji,
  meetingNonverbalLabel,
  MEETING_NONVERBAL_STATUSES,
} from '~/co-work/lib/meeting-nonverbal'
import {
  playMeetingJoinChime,
  resolveMeetingPresenceSound,
} from '~/co-work/lib/meeting-join-sounds'
import {
  MEETING_KEYBOARD_SHORTCUTS,
  resolveMeetingKeyboardAction,
} from '~/co-work/lib/meeting-keyboard-shortcuts'
import { parseMeetingGalleryPrefs } from '~/co-work/lib/meeting-gallery-prefs'
import { parseMeetingMediaPrefs } from '~/co-work/lib/meeting-media-prefs'
import { meetingToolbarMoreKeys } from '~/co-work/lib/meeting-toolbar'

function cameraTrack(
  identity: string,
  opts?: { cameraOn?: boolean; isLocal?: boolean },
): TrackReferenceOrPlaceholder {
  return {
    participant: {
      identity,
      isSpeaking: false,
      isLocal: !!opts?.isLocal,
      isCameraEnabled: opts?.cameraOn !== false,
    },
    source: Track.Source.Camera,
    publication: opts?.cameraOn === false ? { isMuted: true } : { isMuted: false, track: {} },
  } as TrackReferenceOrPlaceholder
}

describe('Zoom parity batch 3 — hide non-video, nonverbal, sounds, shortcuts', () => {
  it('hides camera-off remotes from gallery when hideNonVideoParticipants is on', () => {
    const tracks = [
      cameraTrack('host', { cameraOn: true }),
      cameraTrack('guest-off', { cameraOn: false }),
      cameraTrack('me', { cameraOn: true, isLocal: true }),
    ]
    const result = composeMeetingStageTracks(tracks, 'me', 'gallery', null, {
      hideNonVideoParticipants: true,
    })
    const ids = result.stageTracks.map((t) => t.participant.identity)
    expect(ids).toContain('host')
    expect(ids).toContain('me')
    expect(ids).not.toContain('guest-off')
  })

  it('exposes nonverbal feedback catalog', () => {
    expect(MEETING_NONVERBAL_STATUSES.length).toBeGreaterThanOrEqual(5)
    expect(isMeetingNonverbalStatusId('yes')).toBe(true)
    expect(isMeetingNonverbalStatusId('nope')).toBe(false)
    expect(meetingNonverbalLabel('break')).toMatch(/break/i)
    expect(meetingNonverbalEmoji('yes')).toBeTruthy()
  })

  it('resolves join/leave sound deltas', () => {
    expect(resolveMeetingPresenceSound({ previousCount: 2, nextCount: 3 })).toBe('join')
    expect(resolveMeetingPresenceSound({ previousCount: 3, nextCount: 2 })).toBe('leave')
    expect(resolveMeetingPresenceSound({ previousCount: 1, nextCount: 1, isInitial: true })).toBe(
      null,
    )
    expect(typeof playMeetingJoinChime).toBe('function')
  })

  it('maps Alt keyboard shortcuts and ignores editable targets', () => {
    expect(
      resolveMeetingKeyboardAction({ key: 'a', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }),
    ).toBe('toggle_mute')
    expect(
      resolveMeetingKeyboardAction({
        key: 'v',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target: { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget,
      }),
    ).toBe(null)
    expect(MEETING_KEYBOARD_SHORTCUTS.some((row) => row.action === 'show_shortcuts')).toBe(true)
  })

  it('parses new gallery/media prefs and surfaces them in More', () => {
    expect(parseMeetingGalleryPrefs({ hideNonVideoParticipants: true }).hideNonVideoParticipants).toBe(
      true,
    )
    expect(parseMeetingMediaPrefs({ stopIncomingVideo: true, enterExitSound: false })).toMatchObject({
      stopIncomingVideo: true,
      enterExitSound: false,
    })
    const more = meetingToolbarMoreKeys({
      viewerRole: 'participant',
      supportsVideo: true,
      reactionsOnPrimary: true,
      hasKeyboardShortcuts: true,
    })
    expect(more).toContain('hide_non_video')
    expect(more).toContain('stop_incoming_video')
    expect(more).toContain('enter_exit_sound')
    expect(more).toContain('keyboard_shortcuts')
  })
})
