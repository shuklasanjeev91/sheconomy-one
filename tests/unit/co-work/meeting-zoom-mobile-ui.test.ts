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
  meetingToolbarIpadMoreKeys,
  meetingToolbarPrimaryKeys,
} from '~/co-work/lib/meeting-toolbar'

describe('Zoom mobile UI branding helpers', () => {
  it('keeps Mute · Video · Chat · More · End on phone dock only', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        compact: true,
      }),
    ).toEqual(['mic', 'camera', 'chat', 'more', 'leave', 'end_meeting'])
  })

  it('uses Zoom iPad/large primary dock when not compact', () => {
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
      'share_screen',
      'captions',
      'whiteboard',
      'docs',
      'apps',
      'more',
      'end_meeting',
    ])
  })

  it('builds Zoom-iPad More popover keys', () => {
    expect(
      meetingToolbarIpadMoreKeys({
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
      'audio_settings',
      'captions',
      'settings',
      'background',
      'disconnect_audio',
    ])
  })

  it('builds Zoom-mobile More grid with Sheconomy-safe labels', () => {
    const keys = meetingMobileMoreGridKeys({
      viewerRole: 'host',
      supportsScreenShare: true,
      supportsLiveCaptions: true,
      hasWhiteboard: true,
      hasHostTools: true,
    })
    expect(keys).toEqual([
      'manage_participants',
      'share_screen',
      'captions',
      'polls',
      'disconnect_audio',
      'meeting_info',
      'whiteboard',
      'host_tools',
      'settings',
      'safe_driving',
    ])
    expect(meetingMobileMoreGridLabel('safe_driving')).toBe('Safe driving')
    expect(meetingMobileMoreGridLabel('share_screen')).toBe('Start share')
    expect(meetingMobileMoreGridLabel('polls')).toBe('Apps')
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
