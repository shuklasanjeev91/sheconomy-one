import { describe, expect, it } from 'vitest'

import {
  meetingMobileMoreGridKeys,
  meetingMobileMoreGridLabel,
} from '~/co-work/lib/meeting-mobile-more'

describe('meetingMobileMoreGridKeys & labels (Zoom mobile More parity)', () => {
  it('shows Zoom core + Background / Whiteboard / Record / Safe driving', () => {
    const hostWithAllCaps = meetingMobileMoreGridKeys({
      viewerRole: 'host',
      supportsScreenShare: true,
      supportsLiveCaptions: true,
      hasWhiteboard: true,
      hasBackground: true,
      supportsRecording: true,
      hasHostTools: true,
      hasSafeDriving: true,
    })

    expect(hostWithAllCaps).toEqual([
      'manage_participants',
      'captions',
      'polls',
      'disconnect_audio',
      'meeting_info',
      'host_tools',
      'settings',
      'background',
      'whiteboard',
      'record',
      'safe_driving',
    ])
  })

  it('omits host tools / record for participants', () => {
    const participantNoRec = meetingMobileMoreGridKeys({
      viewerRole: 'participant',
      supportsScreenShare: true,
      supportsLiveCaptions: true,
      hasWhiteboard: true,
      hasBackground: true,
      supportsRecording: false,
    })

    expect(participantNoRec).not.toContain('record')
    expect(participantNoRec).not.toContain('host_tools')
    expect(participantNoRec).toContain('settings')
    expect(participantNoRec).toContain('background')
    expect(participantNoRec).toContain('safe_driving')
    expect(participantNoRec).toContain('captions')
  })

  it('resolves user-facing labels for mobile More sheet items', () => {
    expect(meetingMobileMoreGridLabel('record')).toBe('Record')
    expect(meetingMobileMoreGridLabel('background')).toBe('Background')
    expect(meetingMobileMoreGridLabel('captions')).toBe('Show captions')
    expect(meetingMobileMoreGridLabel('share_screen')).toBe('Start share')
    expect(meetingMobileMoreGridLabel('polls')).toBe('Apps')
    expect(meetingMobileMoreGridLabel('disconnect_audio')).toBe('Disconnect audio')
    expect(meetingMobileMoreGridLabel('host_tools')).toBe('Host tools')
    expect(meetingMobileMoreGridLabel('safe_driving')).toBe('Safe driving')
  })
})
