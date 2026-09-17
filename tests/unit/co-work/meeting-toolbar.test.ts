import { describe, expect, it } from 'vitest'

import {
  MEETING_SIDE_PANEL_Z_INDEX,
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarMoreKeys,
  meetingToolbarPrimaryKeys,
  meetingToolbarSecurityKeys,
} from '../../../co-work/lib/meeting-toolbar'

describe('meeting toolbar layout', () => {
  it('orders the desktop participant dock Mic → Camera → Participants → Chat → Minimize → Share → Captions → Invite → More → Leave', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'participant',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
      }),
    ).toEqual([
      'mic',
      'camera',
      'participants',
      'chat',
      'browse',
      'share_screen',
      'captions',
      'invite',
      'more',
      'leave',
    ])
  })

  it('adds Security and End Meeting for hosts', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
      }),
    ).toEqual([
      'mic',
      'camera',
      'security',
      'participants',
      'chat',
      'browse',
      'share_screen',
      'captions',
      'invite',
      'more',
      'leave',
      'end_meeting',
    ])
  })

  it('keeps Security flyout host-only and lists Minimize in More for discoverability', () => {
    expect(meetingToolbarSecurityKeys('host')).toEqual([
      'lock_meeting',
      'mute_all',
      'ask_all_to_mute',
      'ask_all_to_unmute',
      'remove_all_except_host',
    ])
    expect(meetingToolbarSecurityKeys('co_host')).toEqual([])
    expect(meetingToolbarSecurityKeys('participant')).toEqual([])

    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'host',
        supportsRecording: true,
        supportsVideo: true,
        hasAudioSettings: true,
        hasShareLink: true,
        hasFullscreen: true,
        hasMinimize: true,
        hasPictureInPicture: true,
      }),
    ).toEqual([
      'audio_settings',
      'raise_hand',
      'reactions',
      'record',
      'background',
      'meeting_info',
      'share_link',
      'fullscreen',
      'minimize',
      'picture_in_picture',
    ])

    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'co_host',
        supportsRecording: false,
        supportsVideo: true,
        hasAudioSettings: true,
        hasShareLink: false,
      }),
    ).toEqual([
      'audio_settings',
      'raise_hand',
      'reactions',
      'background',
      'meeting_info',
      'ask_all_to_mute',
      'ask_all_to_unmute',
      'manage_participants',
    ])
  })

  it('keeps the toolbar above side panels so it stays tappable while chat/people are open', () => {
    expect(MEETING_TOOLBAR_Z_INDEX).toBeGreaterThan(MEETING_SIDE_PANEL_Z_INDEX)
  })
})
