import { describe, expect, it } from 'vitest'

import {
  meetingTileActionLabel,
  meetingTileMenuActions,
  resolveParticipantsToolbarBadge,
} from '~/co-work/lib/meeting-tile-actions'
import { meetingToolbarSecurityKeys } from '~/co-work/lib/meeting-toolbar'
import { participantRowActions } from '~/co-work/lib/meeting-participant-actions'
import { togglePinnedIdentity } from '~/co-work/lib/meeting-stage-focus'
import { resolveMeetingKeyboardAction } from '~/co-work/lib/meeting-keyboard-shortcuts'

describe('Zoom parity batch 6 — tile menus, lower hand, security, badges', () => {
  it('builds tile menu actions for pin/spotlight/lower-hand', () => {
    expect(
      meetingTileMenuActions({
        isSelf: false,
        canModerate: true,
        isPinned: false,
        isSpotlighted: false,
        handRaised: true,
      }),
    ).toEqual(['pin', 'spotlight', 'lower_hand'])

    expect(
      meetingTileMenuActions({
        isSelf: true,
        canModerate: true,
        isPinned: true,
        isSpotlighted: false,
        handRaised: true,
      }),
    ).toEqual(['unpin'])

    expect(
      meetingTileMenuActions({
        isSelf: false,
        isScreen: true,
        canModerate: true,
        isPinned: false,
        isSpotlighted: false,
        handRaised: false,
      }),
    ).toEqual([])

    expect(meetingTileActionLabel('spotlight')).toMatch(/spotlight/i)
  })

  it('puts View profile first in the tile menu when a profile can open', () => {
    expect(
      meetingTileMenuActions({
        isSelf: false,
        canModerate: false,
        isPinned: false,
        isSpotlighted: false,
        handRaised: false,
        canViewProfile: true,
      }),
    ).toEqual(['view_profile', 'pin'])

    expect(
      meetingTileMenuActions({
        isSelf: false,
        isScreen: true,
        canModerate: false,
        isPinned: false,
        isSpotlighted: false,
        handRaised: false,
        canViewProfile: true,
      }),
    ).toEqual([])

    expect(meetingTileActionLabel('view_profile')).toBe('View profile')
  })

  it('toggles pinned identities with a max of three', () => {
    let pins: string[] = []
    pins = togglePinnedIdentity(pins, 'a')
    pins = togglePinnedIdentity(pins, 'b')
    pins = togglePinnedIdentity(pins, 'c')
    pins = togglePinnedIdentity(pins, 'd')
    expect(pins).toEqual(['a', 'b', 'c'])
    pins = togglePinnedIdentity(pins, 'b')
    expect(pins).toEqual(['a', 'c'])
  })

  it('exposes lower_hand when the target has a raised hand', () => {
    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: true,
        isVideoOff: true,
        handRaised: true,
      }),
    ).toContain('lower_hand')
    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: true,
        isVideoOff: true,
        handRaised: false,
      }),
    ).not.toContain('lower_hand')
  })

  it('expands Security flyout with waiting room + mute/video on entry', () => {
    const keys = meetingToolbarSecurityKeys('host')
    expect(keys).toEqual([
      'lock_meeting',
      'waiting_room',
      'mute_on_join',
      'video_off_on_join',
      'mute_all',
      'ask_all_to_mute',
      'ask_all_to_unmute',
    ])
    expect(meetingToolbarSecurityKeys('participant')).toEqual([])
  })

  it('prioritizes waiting room then hands on the Participants badge', () => {
    expect(
      resolveParticipantsToolbarBadge({
        waitingCount: 2,
        raisedHandCount: 5,
        participantCount: 12,
      }),
    ).toBe(2)
    expect(
      resolveParticipantsToolbarBadge({
        waitingCount: 0,
        raisedHandCount: 3,
        participantCount: 12,
      }),
    ).toBe(3)
    expect(
      resolveParticipantsToolbarBadge({
        waitingCount: 0,
        raisedHandCount: 0,
        participantCount: 12,
      }),
    ).toBe(12)
  })

  it('keeps expanded Alt shortcuts from batch 5', () => {
    expect(
      resolveMeetingKeyboardAction({
        key: 'c',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe('toggle_captions')
  })
})
