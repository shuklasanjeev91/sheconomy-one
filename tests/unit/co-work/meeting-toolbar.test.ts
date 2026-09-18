import { describe, expect, it } from 'vitest'

import {
  MEETING_SIDE_PANEL_Z_INDEX,
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarMoreKeys,
  meetingToolbarPrimaryKeys,
  meetingToolbarSecurityKeys,
} from '../../../co-work/lib/meeting-toolbar'

describe('meeting toolbar layout', () => {
  it('orders primary dock with Reactions and Hand after Chat', () => {
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
      'reactions',
      'raise_hand',
      'browse',
      'share_screen',
      'captions',
      'invite',
      'more',
      'leave',
    ])
  })

  it('adds Security, End, and Stop recording for hosts while recording', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: true,
      }),
    ).toEqual([
      'mic',
      'camera',
      'security',
      'participants',
      'chat',
      'reactions',
      'raise_hand',
      'browse',
      'share_screen',
      'captions',
      'invite',
      'stop_record',
      'more',
      'leave',
      'end_meeting',
    ])
  })

  it('puts Record on the primary dock for host and co-host when allowed', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: false,
      }),
    ).toContain('record')

    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'co_host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: false,
      }),
    ).toContain('record')
  })

  it('keeps Captions on compact primary and moves Invite to More', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        compact: true,
      }),
    ).toEqual([
      'mic',
      'camera',
      'security',
      'participants',
      'chat',
      'reactions',
      'raise_hand',
      'browse',
      'share_screen',
      'captions',
      'more',
      'leave',
      'end_meeting',
    ])

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
        compact: true,
        supportsLiveCaptions: true,
        hasInvite: true,
        reactionsOnPrimary: true,
        raiseHandOnPrimary: true,
        recordOnPrimary: true,
      }),
    ).toEqual([
      'minimize',
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'maximize',
      'audio_settings',
      'background',
      'meeting_info',
      'invite',
      'share_link',
      'fullscreen',
      'picture_in_picture',
      'host_tools',
    ])
  })

  it('keeps Security flyout slim and groups More without duplicate reactions', () => {
    expect(meetingToolbarSecurityKeys('host')).toEqual([
      'lock_meeting',
      'mute_all',
      'ask_all_to_mute',
      'ask_all_to_unmute',
    ])
    expect(meetingToolbarSecurityKeys('co_host')).toEqual([])
    expect(meetingToolbarSecurityKeys('participant')).toEqual([])

    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'co_host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
      }),
    ).toContain('security')

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
        reactionsOnPrimary: true,
        raiseHandOnPrimary: true,
        recording: true,
      }),
    ).toEqual([
      'minimize',
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'maximize',
      'audio_settings',
      'background',
      'meeting_info',
      'share_link',
      'fullscreen',
      'picture_in_picture',
      'host_tools',
    ])

    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'co_host',
        supportsRecording: false,
        supportsVideo: true,
        hasAudioSettings: true,
        hasShareLink: false,
        reactionsOnPrimary: true,
        raiseHandOnPrimary: true,
      }),
    ).toEqual([
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'maximize',
      'audio_settings',
      'background',
      'meeting_info',
      'host_tools',
      'ask_all_to_mute',
      'ask_all_to_unmute',
      'manage_participants',
    ])
  })

  it('surfaces polls, Q&A, breakouts, and dense gallery in More', () => {
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
        hasDenseGallery: true,
        hasPolls: true,
        hasQa: true,
        hasBreakouts: true,
        reactionsOnPrimary: true,
        raiseHandOnPrimary: true,
        recordOnPrimary: true,
      }),
    ).toEqual([
      'minimize',
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'maximize',
      'view_dense_gallery',
      'audio_settings',
      'background',
      'meeting_info',
      'share_link',
      'fullscreen',
      'picture_in_picture',
      'polls',
      'qna',
      'breakout_rooms',
      'host_tools',
    ])
  })

  it('keeps the toolbar above side panels so it stays tappable while chat/people are open', () => {
    expect(MEETING_TOOLBAR_Z_INDEX).toBeGreaterThan(MEETING_SIDE_PANEL_Z_INDEX)
  })
})
