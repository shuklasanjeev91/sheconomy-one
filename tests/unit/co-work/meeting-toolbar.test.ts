import { describe, expect, it } from 'vitest'

import {
  MEETING_SIDE_PANEL_Z_INDEX,
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarMode,
  meetingToolbarMoreKeys,
  meetingToolbarMoreSections,
  meetingToolbarPrimaryKeys,
  meetingToolbarPrimaryLabel,
  meetingToolbarSecurityKeys,
} from '../../../co-work/lib/meeting-toolbar'

describe('meeting toolbar layout', () => {
  it('maps compact → Zoom mobile UI and roomy → Zoom web', () => {
    expect(meetingToolbarMode({ compact: true })).toBe('mobile')
    expect(meetingToolbarMode({ compact: false })).toBe('web')
    expect(meetingToolbarMode({ mode: 'mobile' })).toBe('mobile')
    expect(meetingToolbarMode({ mode: 'web', compact: true })).toBe('web')
  })

  it('keeps a lean Zoom iPad/large primary dock', () => {
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
      'share_screen',
      'captions',
      'whiteboard',
      'docs',
      'apps',
      'more',
      'leave',
    ])
  })

  it('adds End for hosts on Zoom iPad/large dock (Security/Record in More)', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: false,
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
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsRecording: true,
      }),
    ).not.toContain('security')
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsRecording: true,
      }),
    ).not.toContain('record')
  })

  it('uses Zoom mobile primary dock: Mute · Video · Chat · More · End', () => {
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
      'chat',
      'more',
      'leave',
      'end_meeting',
    ])

    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'participant',
        supportsVideo: true,
        supportsScreenShare: true,
        mode: 'mobile',
      }),
    ).toContain('chat')
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'participant',
        supportsVideo: true,
        supportsScreenShare: true,
        mode: 'mobile',
      }),
    ).not.toContain('share_screen')
  })

  it('keeps Stop recording on the Zoom mobile primary dock while recording', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: true,
        compact: true,
      }),
    ).toEqual([
      'mic',
      'camera',
      'chat',
      'stop_record',
      'more',
      'leave',
      'end_meeting',
    ])
  })

  it('puts Record in More (not primary dock) for host and co-host on Zoom iPad/large', () => {
    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: false,
      }),
    ).not.toContain('record')

    expect(
      meetingToolbarPrimaryKeys({
        viewerRole: 'co_host',
        supportsVideo: true,
        supportsScreenShare: true,
        supportsLiveCaptions: true,
        supportsRecording: true,
        recording: false,
      }),
    ).not.toContain('record')

    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'host',
        supportsRecording: true,
        recordOnPrimary: false,
      }),
    ).toContain('record')
  })

  it('shortens Zoom mobile dock captions', () => {
    expect(
      meetingToolbarPrimaryLabel('camera', { mode: 'mobile', videoEnabled: true }),
    ).toBe('Stop video')
    expect(
      meetingToolbarPrimaryLabel('camera', { mode: 'web', videoEnabled: true }),
    ).toBe('Stop Video')
    expect(meetingToolbarPrimaryLabel('participants', { mode: 'mobile' })).toBe('People')
    expect(meetingToolbarPrimaryLabel('share_screen', { mode: 'mobile' })).toBe('Share')
    expect(meetingToolbarPrimaryLabel('reactions', { mode: 'web' })).toBe('Reactions')
    expect(meetingToolbarPrimaryLabel('share_screen', { mode: 'web' })).toBe('Start share')
    expect(meetingToolbarPrimaryLabel('docs', { mode: 'web' })).toBe('Docs')
    expect(meetingToolbarPrimaryLabel('apps', { mode: 'web' })).toBe('Apps')
  })

  it('orders Zoom mobile More: Meeting (chat) → AV → View → Apps → Host', () => {
    const sections = meetingToolbarMoreSections({
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
      reactionsOnPrimary: false,
      raiseHandOnPrimary: false,
      captionsOnPrimary: false,
      whiteboardOnPrimary: false,
      inviteOnPrimary: false,
      recordOnPrimary: false,
    })

    expect(sections.map((s) => s.title)).toEqual([
      'Browse',
      'Meeting',
      'Audio & video',
      'View',
      'Apps',
      'Host',
    ])
    expect(sections.find((s) => s.title === 'Meeting')?.keys).toEqual(
      expect.arrayContaining([
        'manage_participants',
        'raise_hand',
        'reactions',
        'captions',
        'share_screen',
        'disconnect_audio',
        'settings',
        'safe_driving',
        'record',
      ]),
    )
    expect(sections.find((s) => s.title === 'Meeting')?.keys).not.toContain('chat')
    expect(sections.find((s) => s.title === 'View')?.keys).not.toContain('active_speakers_only')
    expect(sections.find((s) => s.title === 'View')?.keys).toContain('hd_video')

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
        supportsScreenShare: true,
        reactionsOnPrimary: false,
        raiseHandOnPrimary: false,
        captionsOnPrimary: false,
        whiteboardOnPrimary: false,
        inviteOnPrimary: false,
        recordOnPrimary: false,
      }),
    ).toEqual(
      expect.arrayContaining([
        'minimize',
        'meeting_info',
        'manage_participants',
        'raise_hand',
        'reactions',
        'captions',
        'share_screen',
        'disconnect_audio',
        'settings',
        'safe_driving',
        'record',
        'invite',
        'share_link',
        'host_tools',
      ]),
    )
    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'host',
        supportsRecording: true,
        supportsVideo: true,
        compact: true,
        supportsLiveCaptions: true,
      }),
    ).not.toContain('chat')
  })

  it('keeps Security flyout slim and groups Zoom web More without duplicate reactions', () => {
    expect(meetingToolbarSecurityKeys('host')).toEqual([
      'lock_meeting',
      'waiting_room',
      'mute_on_join',
      'video_off_on_join',
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
    ).not.toContain('security')
    expect(
      meetingToolbarMoreKeys({
        viewerRole: 'host',
        hasAudioSettings: true,
      }),
    ).toEqual(expect.arrayContaining(['host_tools']))

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
        raiseHandOnPrimary: false,
        captionsOnPrimary: false,
        whiteboardOnPrimary: false,
        inviteOnPrimary: false,
        recording: true,
        recordOnPrimary: true,
      }),
    ).toEqual([
      'minimize',
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'hide_non_video',
      'active_speakers_only',
      'side_by_side',
      'stop_incoming_video',
      'maximize',
      'pin_toolbar',
      'raise_hand',
      'audio_settings',
      'original_sound',
      'hd_video',
      'enter_exit_sound',
      'background',
      'captions',
      'whiteboard',
      'meeting_info',
      'invite',
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
        raiseHandOnPrimary: false,
        captionsOnPrimary: false,
        whiteboardOnPrimary: false,
        inviteOnPrimary: false,
      }),
    ).toEqual([
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'hide_non_video',
      'active_speakers_only',
      'side_by_side',
      'stop_incoming_video',
      'maximize',
      'pin_toolbar',
      'raise_hand',
      'audio_settings',
      'original_sound',
      'hd_video',
      'enter_exit_sound',
      'background',
      'captions',
      'whiteboard',
      'meeting_info',
      'invite',
      'host_tools',
      'ask_all_to_mute',
      'ask_all_to_unmute',
      'manage_participants',
    ])
  })

  it('surfaces polls, Q&A, breakouts, and dense gallery in Zoom web More', () => {
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
        raiseHandOnPrimary: false,
        captionsOnPrimary: false,
        whiteboardOnPrimary: false,
        inviteOnPrimary: false,
        recordOnPrimary: true,
      }),
    ).toEqual([
      'minimize',
      'view_gallery',
      'view_speaker',
      'view_screen_share',
      'mirror_video',
      'hide_self_view',
      'hide_non_video',
      'active_speakers_only',
      'side_by_side',
      'stop_incoming_video',
      'maximize',
      'pin_toolbar',
      'view_dense_gallery',
      'raise_hand',
      'audio_settings',
      'original_sound',
      'hd_video',
      'enter_exit_sound',
      'background',
      'captions',
      'whiteboard',
      'polls',
      'qna',
      'breakout_rooms',
      'meeting_info',
      'invite',
      'share_link',
      'fullscreen',
      'picture_in_picture',
      'host_tools',
    ])
  })

  it('keeps the toolbar above side panels so it stays tappable while chat/people are open', () => {
    expect(MEETING_TOOLBAR_Z_INDEX).toBeGreaterThan(MEETING_SIDE_PANEL_Z_INDEX)
  })
})
