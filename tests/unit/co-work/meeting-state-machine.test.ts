import { describe, expect, it } from 'vitest'

import {
  MEETING_LIFECYCLE_STATES,
  canTransitionMeetingLifecycle,
  initialMeetingMachineState,
  meetingLifecycleLabel,
  meetingStateReducer,
  resolveMeetingLifecycleAction,
} from '~/co-work/lib/meeting-state-machine'

describe('meeting state machine', () => {
  it('exposes every required lifecycle state', () => {
    expect(MEETING_LIFECYCLE_STATES).toEqual([
      'LOBBY',
      'WAITING_FOR_HOST',
      'JOINING',
      'CONNECTED',
      'RECONNECTING',
      'CONNECTED_WITH_AUDIO_ONLY',
      'SCREEN_SHARING',
      'LEAVING',
      'ENDED',
      'REMOVED',
      'LOCKED',
    ])
  })

  it('moves through join, reconnect and connected states', () => {
    const joining = meetingStateReducer(initialMeetingMachineState, { type: 'JOIN' })
    const reconnecting = meetingStateReducer(joining, { type: 'RECONNECT' })
    const connected = meetingStateReducer(reconnecting, { type: 'CONNECTED' })
    expect(joining.lifecycle).toBe('JOINING')
    expect(reconnecting.lifecycle).toBe('RECONNECTING')
    expect(connected.lifecycle).toBe('CONNECTED')
  })

  it('supports connected audio-only and restores it after screen share', () => {
    const audioOnly = meetingStateReducer(initialMeetingMachineState, {
      type: 'CONNECTED',
      audioOnly: true,
    })
    expect(audioOnly.lifecycle).toBe('CONNECTED_WITH_AUDIO_ONLY')
    const sharing = meetingStateReducer(audioOnly, { type: 'SHARE_STARTED' })
    expect(sharing.lifecycle).toBe('SCREEN_SHARING')
    expect(sharing.previousConnectedState).toBe('CONNECTED_WITH_AUDIO_ONLY')
    const stopped = meetingStateReducer(sharing, { type: 'SHARE_STOPPED' })
    expect(stopped.lifecycle).toBe('CONNECTED_WITH_AUDIO_ONLY')
  })

  it('selects screen-share view and restores gallery after sharing', () => {
    const sharing = meetingStateReducer(initialMeetingMachineState, { type: 'SHARE_STARTED' })
    expect(sharing.lifecycle).toBe('SCREEN_SHARING')
    expect(sharing.viewMode).toBe('screen-share')
    expect(sharing.uiMode).toBe('maximized')
    expect(sharing.participantStripMinimized).toBe(false)
    const stopped = meetingStateReducer(sharing, { type: 'SHARE_STOPPED' })
    expect(stopped.viewMode).toBe('gallery')
    expect(stopped.uiMode).toBe('normal')
    expect(stopped.controlsVisible).toBe(true)
  })

  it('does not let CONNECTED clobber SCREEN_SHARING', () => {
    const sharing = meetingStateReducer(initialMeetingMachineState, { type: 'SHARE_STARTED' })
    const ignored = meetingStateReducer(sharing, { type: 'CONNECTED' })
    expect(ignored.lifecycle).toBe('SCREEN_SHARING')
    expect(canTransitionMeetingLifecycle('SCREEN_SHARING', 'CONNECTED')).toBe(false)
    expect(canTransitionMeetingLifecycle('SCREEN_SHARING', 'CONNECTED', 'SHARE_STOPPED')).toBe(true)
  })

  it('toggles maximized UI and can auto-hide controls', () => {
    const maximized = meetingStateReducer(initialMeetingMachineState, {
      type: 'SET_UI_MODE',
      uiMode: 'maximized',
    })
    expect(maximized.uiMode).toBe('maximized')
    expect(maximized.participantStripMinimized).toBe(true)
    expect(maximized.controlsVisible).toBe(true)
    const hidden = meetingStateReducer(maximized, { type: 'SET_CONTROLS', visible: false })
    expect(hidden.controlsVisible).toBe(false)
    const pinned = meetingStateReducer(hidden, { type: 'SET_CONTROLS_PINNED', pinned: true })
    expect(pinned.controlsPinned).toBe(true)
    expect(pinned.controlsVisible).toBe(true)
  })

  it('keeps removed, locked, leave and ended states explicit', () => {
    expect(meetingStateReducer(initialMeetingMachineState, { type: 'REMOVED' }).lifecycle).toBe(
      'REMOVED',
    )
    expect(meetingStateReducer(initialMeetingMachineState, { type: 'LOCKED' }).lifecycle).toBe(
      'LOCKED',
    )
    expect(meetingStateReducer(initialMeetingMachineState, { type: 'LEAVE' }).lifecycle).toBe(
      'LEAVING',
    )
    expect(meetingStateReducer(initialMeetingMachineState, { type: 'ENDED' }).lifecycle).toBe(
      'ENDED',
    )
  })

  it('blocks soft transitions out of terminal states', () => {
    const ended = meetingStateReducer(initialMeetingMachineState, { type: 'ENDED' })
    expect(meetingStateReducer(ended, { type: 'CONNECTED' }).lifecycle).toBe('ENDED')
    expect(meetingStateReducer(ended, { type: 'JOIN' }).lifecycle).toBe('ENDED')
  })

  it('defaults local mirror ON and stores explicit layout preferences', () => {
    expect(initialMeetingMachineState.mirrorLocalVideo).toBe(true)
    const speaker = meetingStateReducer(initialMeetingMachineState, {
      type: 'SET_VIEW',
      viewMode: 'speaker',
    })
    const unmirrored = meetingStateReducer(speaker, {
      type: 'SET_MIRROR_LOCAL_VIDEO',
      enabled: false,
    })
    expect(unmirrored.viewMode).toBe('speaker')
    expect(unmirrored.mirrorLocalVideo).toBe(false)
  })

  it('keeps Gallery selected while screen share stays active', () => {
    const sharing = meetingStateReducer(initialMeetingMachineState, { type: 'SHARE_STARTED' })
    const gallery = meetingStateReducer(sharing, { type: 'SET_VIEW', viewMode: 'gallery' })
    const stillSharing = meetingStateReducer(gallery, { type: 'SHARE_STARTED' })
    expect(stillSharing.lifecycle).toBe('SCREEN_SHARING')
    expect(stillSharing.viewMode).toBe('gallery')
  })

  it('expands the participant filmstrip when entering Speaker view', () => {
    const minimized = meetingStateReducer(initialMeetingMachineState, {
      type: 'TOGGLE_PARTICIPANT_STRIP',
    })
    expect(minimized.participantStripMinimized).toBe(true)
    const speaker = meetingStateReducer(minimized, { type: 'SET_VIEW', viewMode: 'speaker' })
    expect(speaker.viewMode).toBe('speaker')
    expect(speaker.participantStripMinimized).toBe(false)
  })

  it('minimizes and restores the participant filmstrip', () => {
    const minimized = meetingStateReducer(initialMeetingMachineState, {
      type: 'TOGGLE_PARTICIPANT_STRIP',
    })
    expect(minimized.participantStripMinimized).toBe(true)
    expect(
      meetingStateReducer(minimized, { type: 'TOGGLE_PARTICIPANT_STRIP' })
        .participantStripMinimized,
    ).toBe(false)
  })

  it('resolves lifecycle from signals with stable priority', () => {
    expect(
      resolveMeetingLifecycleAction('LOBBY', { waitingForHost: true })?.type,
    ).toBe('WAIT_FOR_HOST')
    expect(resolveMeetingLifecycleAction('WAITING_FOR_HOST', { joining: true })?.type).toBe('JOIN')
    expect(
      resolveMeetingLifecycleAction('JOINING', { inMeeting: true, audioOnly: true }),
    ).toEqual({ type: 'CONNECTED', audioOnly: true })
    expect(
      resolveMeetingLifecycleAction('CONNECTED', {
        inMeeting: true,
        screenSharing: true,
      })?.type,
    ).toBe('SHARE_STARTED')
    expect(
      resolveMeetingLifecycleAction('SCREEN_SHARING', {
        inMeeting: true,
        screenSharing: false,
      })?.type,
    ).toBe('SHARE_STOPPED')
    expect(
      resolveMeetingLifecycleAction('SCREEN_SHARING', {
        inMeeting: true,
      }),
    ).toBeNull()
    expect(
      resolveMeetingLifecycleAction('CONNECTED', { mediaReconnecting: true })?.type,
    ).toBe('RECONNECT')
    expect(resolveMeetingLifecycleAction('CONNECTED', { ended: true })?.type).toBe('ENDED')
    expect(resolveMeetingLifecycleAction('ENDED', { inMeeting: true })).toBeNull()
    expect(resolveMeetingLifecycleAction('LOBBY', { locked: true })?.type).toBe('LOCKED')
  })

  it('labels each lifecycle state for UI', () => {
    expect(meetingLifecycleLabel('WAITING_FOR_HOST')).toBe('Waiting for host')
    expect(meetingLifecycleLabel('CONNECTED_WITH_AUDIO_ONLY')).toBe('Connected (audio only)')
    expect(meetingLifecycleLabel('SCREEN_SHARING')).toBe('Screen sharing')
  })
})
