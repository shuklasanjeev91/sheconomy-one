import { describe, expect, it } from 'vitest'

import {
  calendarOnboardingCopy,
  calendarOnboardingProviderLabel,
} from '~/co-work/lib/meeting-calendar-onboarding'
import {
  meetingMobileMoreGridKeys,
  meetingMobileMoreGridLabel,
} from '~/co-work/lib/meeting-mobile-more'
import {
  meetingToolbarWideMoreKeys,
  meetingToolbarPrimaryKeys,
} from '~/co-work/lib/meeting-toolbar'

describe('Zoom mobile UI branding helpers', () => {
  it('keeps Mute · Video · Share · Chat · Reactions · More · End on phone dock only', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        compact: true,
      }),
    ).toEqual(['mic', 'camera', 'share_screen', 'chat', 'reactions', 'more', 'leave', 'end_meeting'])
  })

  it('uses tablet/desktop primary dock when not compact', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        compact: false,
      }),
    ).toEqual([
      'mic',
      'camera',
      'participants',
      'chat',
      'reactions',
      'raise_hand',
      'share_screen',
      'captions',
      'whiteboard',
      'docs',
      'apps',
      'more',
      'end_meeting',
    ])
  })

  it('builds tablet/desktop More popover keys', () => {
    expect(
      meetingToolbarWideMoreKeys({
        viewerRole: 'host',
        hasHostTools: true,
        hasAudioSettings: true,
        hasCaptions: true,
        hasSettings: true,
        hasVideoEffects: true,
        hasDisconnectAudio: true,
      }),
    ).toEqual([
      'host_tools',
      'raise_hand',
      'audio_settings',
      'captions',
      'settings',
      'background',
      'disconnect_audio',
    ])
  })

  it('offers Record in the tablet/desktop More for participants too', () => {
    expect(
      meetingToolbarWideMoreKeys({
        viewerRole: 'participant',
        hasHostTools: false,
        supportsRecording: true,
      }),
    ).toContain('record')
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsRecording: true,
        recording: true,
        compact: false,
      }),
    ).toContain('stop_record')
  })

  it('builds Zoom-mobile More grid with Sheconomy-safe labels', () => {
    const keys = meetingMobileMoreGridKeys({
      viewerRole: 'host',
      supportsScreenShare: true,
      supportsLiveCaptions: true,
      hasWhiteboard: true,
      hasHostTools: true,
      hasBackground: true,
      supportsRecording: true,
    })
    expect(keys).toEqual([
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
    expect(meetingMobileMoreGridLabel('safe_driving')).toBe('Safe driving')
    expect(meetingMobileMoreGridLabel('share_screen')).toBe('Start share')
    expect(meetingMobileMoreGridLabel('polls')).toBe('Apps')
    expect(meetingMobileMoreGridLabel('captions')).toBe('Show captions')
    expect(meetingMobileMoreGridLabel('background')).toBe('Background')
  })

  it('uses Sheconomy copy for calendar onboarding', () => {
    const copy = calendarOnboardingCopy()
    expect(copy.title).toBe('Make scheduling simple')
    expect(copy.body).toContain('Sheconomy Meetings')
    expect(copy.body).not.toMatch(/zoom/i)
    expect(calendarOnboardingProviderLabel('google')).toBe('Google')
    expect(calendarOnboardingProviderLabel('device')).toBe('Device calendar')
  })
})
