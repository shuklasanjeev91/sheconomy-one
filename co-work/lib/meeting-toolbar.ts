import type { MeetingRole } from '~/co-work/lib/types'
import {
  canChangeCriticalMeetingSettings,
  canEndMeetingForEveryone,
  canManageMeeting,
  canOpenHostTools,
} from '~/co-work/lib/meeting-role-permissions'

/**
 * Toolbar mode mirrors Zoom product surfaces:
 * - `web` → Zoom iPad / desktop dock (tablet+ and laptop+)
 * - `mobile` → Zoom phone dock only
 */
export type MeetingToolbarMode = 'web' | 'mobile'

/** Primary dock controls — lean Zoom-style set; everything else lives in More. */
export type MeetingToolbarPrimaryKey =
  | 'mic'
  | 'camera'
  | 'security'
  | 'participants'
  | 'chat'
  | 'reactions'
  | 'raise_hand'
  | 'share_screen'
  | 'whiteboard'
  | 'captions'
  | 'docs'
  | 'apps'
  | 'invite'
  | 'browse'
  | 'record'
  | 'stop_record'
  | 'more'
  | 'leave'
  | 'end_meeting'

export type MeetingToolbarOverflowKey =
  | 'audio_settings'
  | 'chat'
  | 'raise_hand'
  | 'reactions'
  | 'record'
  | 'background'
  | 'whiteboard'
  | 'meeting_info'
  | 'share_link'
  | 'fullscreen'
  | 'minimize'
  | 'picture_in_picture'
  | 'mute_all'
  | 'ask_all_to_mute'
  | 'ask_all_to_unmute'
  | 'remove_all_except_host'
  | 'lock_meeting'
  | 'waiting_room'
  | 'mute_on_join'
  | 'video_off_on_join'
  | 'manage_participants'
  | 'view_dense_gallery'
  | 'mirror_video'
  | 'hide_self_view'
  | 'hide_non_video'
  | 'active_speakers_only'
  | 'side_by_side'
  | 'stop_incoming_video'
  | 'enter_exit_sound'
  | 'keyboard_shortcuts'
  | 'maximize'
  | 'pin_toolbar'
  | 'original_sound'
  | 'hd_video'
  | 'captions'
  | 'invite'
  | 'host_tools'
  | 'breakout_rooms'
  | 'polls'
  | 'qna'
  | 'dual_monitor'
  | 'annotate_share'
  | 'request_remote_control'
  | 'share_screen'
  | 'disconnect_audio'
  | 'settings'
  | 'safe_driving'

export type MeetingToolbarMoreSection = {
  title: string
  keys: MeetingToolbarOverflowKey[]
}

export function meetingToolbarMode(input: {
  compact?: boolean
  mode?: MeetingToolbarMode
}): MeetingToolbarMode {
  if (input.mode === 'web' || input.mode === 'mobile') return input.mode
  return input.compact ? 'mobile' : 'web'
}

/**
 * Zoom primary dock:
 *
 * Mobile (Zoom phone — Sheconomy branded):
 *   Mute · Video · Share · Chat · More · End
 *
 * iPad / large (Zoom tablet & desktop):
 *   Mute · Stop Video · Participants · Chat · Reactions · Start Share ·
 *   Captions · Whiteboard · Docs · Apps · More · End
 */
export function meetingToolbarPrimaryKeys(input: {
  viewerRole: MeetingRole
  supportsVideo?: boolean
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  /** @deprecated Minimize always lives in More (Zoom-style). */
  hasBrowse?: boolean
  /** Phone only → Zoom mobile UI. Tablet/desktop use web UI. */
  compact?: boolean
  /** Explicit mode override (tests / special surfaces). */
  mode?: MeetingToolbarMode
  /** Host/co-host may start cloud recording. */
  supportsRecording?: boolean
  /** Actively recording — keep Stop on the primary dock. */
  recording?: boolean
  hasReactions?: boolean
  hasRaiseHand?: boolean
  hasWhiteboard?: boolean
  hasDocs?: boolean
  hasApps?: boolean
}): MeetingToolbarPrimaryKey[] {
  const mode = meetingToolbarMode(input)
  const keys: MeetingToolbarPrimaryKey[] = ['mic']
  if (input.supportsVideo !== false) keys.push('camera')

  if (mode === 'mobile') {
    if (input.supportsScreenShare) keys.push('share_screen')
    keys.push('chat')
    if (input.supportsRecording && input.recording) keys.push('stop_record')
    keys.push('more', 'leave')
    if (canEndMeetingForEveryone(input.viewerRole)) keys.push('end_meeting')
    return keys
  }

  // Zoom iPad / large dock — Security & Record live under More / Host tools.
  keys.push('participants', 'chat')
  if (input.hasReactions !== false) keys.push('reactions')
  if (input.hasRaiseHand !== false) keys.push('raise_hand')
  if (input.supportsScreenShare) keys.push('share_screen')
  if (input.supportsLiveCaptions !== false) keys.push('captions')
  if (input.hasWhiteboard !== false) keys.push('whiteboard')
  if (input.hasDocs !== false) keys.push('docs')
  if (input.hasApps !== false) keys.push('apps')
  if (input.supportsRecording && input.recording) keys.push('stop_record')
  keys.push('more')
  if (canEndMeetingForEveryone(input.viewerRole)) keys.push('end_meeting')
  else keys.push('leave')
  return keys
}

/** Overflow keys for tablet / desktop More (web + native). */
export function meetingToolbarWideMoreKeys(input: {
  viewerRole: MeetingRole
  hasHostTools?: boolean
  hasAudioSettings?: boolean
  hasCaptions?: boolean
  hasSettings?: boolean
  hasVideoEffects?: boolean
  hasDisconnectAudio?: boolean
  hasRaiseHand?: boolean
  /** Record (host) or request-to-record (participant), as in Zoom's More. */
  supportsRecording?: boolean
}): MeetingToolbarOverflowKey[] {
  const keys: MeetingToolbarOverflowKey[] = []
  if (input.hasHostTools ?? canOpenHostTools(input.viewerRole)) keys.push('host_tools')
  if (input.hasRaiseHand !== false) keys.push('raise_hand')
  if (input.hasAudioSettings !== false) keys.push('audio_settings')
  if (input.hasCaptions !== false) keys.push('captions')
  if (input.supportsRecording) keys.push('record')
  if (input.hasSettings !== false) keys.push('settings')
  if (input.hasVideoEffects !== false) keys.push('background')
  if (input.hasDisconnectAudio !== false) keys.push('disconnect_audio')
  return keys
}

/** @deprecated Prefer meetingToolbarWideMoreKeys — same behavior. */
export const meetingToolbarIpadMoreKeys = meetingToolbarWideMoreKeys

/**
 * Host Security flyout — lock + waiting room + mute/video on entry + room audio asks.
 * Bulk people danger (remove all) lives on the Participants panel.
 */
export function meetingToolbarSecurityKeys(viewerRole: MeetingRole): MeetingToolbarOverflowKey[] {
  if (!canChangeCriticalMeetingSettings(viewerRole)) return []
  return [
    'lock_meeting',
    'waiting_room',
    'mute_on_join',
    'video_off_on_join',
    'mute_all',
    'ask_all_to_mute',
    'ask_all_to_unmute',
  ]
}

/** Flat More keys (for tests / consumers that don't need sections). */
export function meetingToolbarMoreKeys(input: {
  viewerRole: MeetingRole
  supportsRecording?: boolean
  supportsVideo?: boolean
  hasAudioSettings?: boolean
  hasShareLink?: boolean
  hasFullscreen?: boolean
  hasMinimize?: boolean
  hasPictureInPicture?: boolean
  compact?: boolean
  mode?: MeetingToolbarMode
  supportsLiveCaptions?: boolean
  hasInvite?: boolean
  hasViewControls?: boolean
  /** When reactions/hand are on the primary dock, omit from More. */
  reactionsOnPrimary?: boolean
  raiseHandOnPrimary?: boolean
  captionsOnPrimary?: boolean
  whiteboardOnPrimary?: boolean
  inviteOnPrimary?: boolean
  /** Hide start-record in More while Record/Stop is on the primary dock. */
  recording?: boolean
  recordOnPrimary?: boolean
  hasDenseGallery?: boolean
  hasBreakouts?: boolean
  hasPolls?: boolean
  hasQa?: boolean
  hasWhiteboard?: boolean
  hasDualMonitor?: boolean
  hasAnnotateShare?: boolean
  hasRemoteControl?: boolean
  hasKeyboardShortcuts?: boolean
  supportsScreenShare?: boolean
}): MeetingToolbarOverflowKey[] {
  return meetingToolbarMoreSections(input).flatMap((section) => section.keys)
}

/** Grouped More menu sections — Zoom web vs Zoom mobile hierarchy. */
export function meetingToolbarMoreSections(input: {
  viewerRole: MeetingRole
  supportsRecording?: boolean
  supportsVideo?: boolean
  hasAudioSettings?: boolean
  hasShareLink?: boolean
  hasFullscreen?: boolean
  hasMinimize?: boolean
  hasPictureInPicture?: boolean
  compact?: boolean
  mode?: MeetingToolbarMode
  supportsLiveCaptions?: boolean
  hasInvite?: boolean
  hasViewControls?: boolean
  hasDenseGallery?: boolean
  reactionsOnPrimary?: boolean
  raiseHandOnPrimary?: boolean
  captionsOnPrimary?: boolean
  whiteboardOnPrimary?: boolean
  inviteOnPrimary?: boolean
  recording?: boolean
  /** When true, Record lives on the primary dock — omit from More. */
  recordOnPrimary?: boolean
  hasBreakouts?: boolean
  hasPolls?: boolean
  hasQa?: boolean
  hasWhiteboard?: boolean
  hasDualMonitor?: boolean
  hasAnnotateShare?: boolean
  hasRemoteControl?: boolean
  hasKeyboardShortcuts?: boolean
  supportsScreenShare?: boolean
}): MeetingToolbarMoreSection[] {
  const mode = meetingToolbarMode(input)
  const isMobile = mode === 'mobile'

  const view: MeetingToolbarOverflowKey[] = []
  if (input.hasViewControls !== false) {
    // Gallery / speaker / shared screen are stage pages reached by swiping (Zoom mobile).
    view.push('mirror_video', 'hide_self_view')
    if (isMobile) {
      view.push('hide_non_video', 'stop_incoming_video', 'hd_video')
    } else {
      view.push(
        'hide_non_video',
        'active_speakers_only',
        'side_by_side',
        'stop_incoming_video',
        'maximize',
        'pin_toolbar',
      )
    }
    if (input.hasDenseGallery) view.push('view_dense_gallery')
  }

  const media: MeetingToolbarOverflowKey[] = []
  if (input.hasAudioSettings) media.push('audio_settings')
  if (!isMobile) {
    media.push('original_sound', 'hd_video', 'enter_exit_sound')
  }
  if (input.supportsVideo !== false) media.push('background')

  const apps: MeetingToolbarOverflowKey[] = []
  if (input.whiteboardOnPrimary !== true && input.hasWhiteboard !== false) {
    apps.push('whiteboard')
  }
  if (input.hasPolls) apps.push('polls')
  if (input.hasQa) apps.push('qna')
  if (input.hasBreakouts) apps.push('breakout_rooms')
  if (input.hasAnnotateShare) apps.push('annotate_share')
  if (input.hasRemoteControl) apps.push('request_remote_control')

  const meeting: MeetingToolbarOverflowKey[] = ['meeting_info']
  if (isMobile) meeting.push('chat')
  if (input.raiseHandOnPrimary !== true) meeting.push('raise_hand')
  if (input.reactionsOnPrimary !== true) meeting.push('reactions')
  if (input.captionsOnPrimary !== true && input.supportsLiveCaptions !== false) {
    meeting.push('captions')
  }
  if (input.supportsRecording && !input.recording && input.recordOnPrimary !== true) {
    meeting.push('record')
  }
  if (input.inviteOnPrimary !== true && input.hasInvite !== false) meeting.push('invite')
  if (input.hasShareLink) meeting.push('share_link')
  if (input.hasFullscreen) meeting.push('fullscreen')
  if (input.hasPictureInPicture) meeting.push('picture_in_picture')
  if (input.hasKeyboardShortcuts && !isMobile) meeting.push('keyboard_shortcuts')
  if (input.hasDualMonitor && !isMobile) meeting.push('dual_monitor')

  const host: MeetingToolbarOverflowKey[] = []
  if (canOpenHostTools(input.viewerRole)) {
    host.push('host_tools')
  }
  if (isMobile && canChangeCriticalMeetingSettings(input.viewerRole)) {
    for (const key of meetingToolbarSecurityKeys(input.viewerRole)) {
      if (!host.includes(key)) host.push(key)
    }
  }
  if (canManageMeeting(input.viewerRole) && !canChangeCriticalMeetingSettings(input.viewerRole)) {
    host.push('ask_all_to_mute', 'ask_all_to_unmute', 'manage_participants')
  }

  const sections: MeetingToolbarMoreSection[] = []
  if (isMobile) {
    // Zoom mobile More: Meeting grid actions + captions live here; Share is on the dock.
    const mobileMeeting: MeetingToolbarOverflowKey[] = ['meeting_info', 'manage_participants']
    if (input.raiseHandOnPrimary !== true) mobileMeeting.push('raise_hand')
    if (input.reactionsOnPrimary !== true) mobileMeeting.push('reactions')
    if (input.captionsOnPrimary !== true && input.supportsLiveCaptions !== false) {
      mobileMeeting.push('captions')
    }
    mobileMeeting.push('disconnect_audio', 'settings', 'safe_driving')
    if (input.supportsRecording && !input.recording && input.recordOnPrimary !== true) {
      mobileMeeting.push('record')
    }
    if (input.inviteOnPrimary !== true && input.hasInvite !== false) mobileMeeting.push('invite')
    if (input.hasShareLink) mobileMeeting.push('share_link')
    if (input.hasMinimize) {
      sections.push({ title: 'Browse', keys: ['minimize'] })
    }
    sections.push({ title: 'Meeting', keys: mobileMeeting })
    if (media.length) sections.push({ title: 'Audio & video', keys: media })
    if (view.length) sections.push({ title: 'View', keys: view })
    if (apps.length) sections.push({ title: 'Apps', keys: apps })
    if (host.length) sections.push({ title: 'Host', keys: host })
    return sections
  }

  if (input.hasMinimize) {
    sections.push({ title: 'Browse', keys: ['minimize'] })
  }

  // Zoom web More: View → Audio & video → Apps → Meeting → Host
  // Raise/react/captions already on primary when reactionsOnPrimary — meeting list stays info/share.
  const webMeeting = meeting.filter(
    (key) => key !== 'raise_hand' && key !== 'reactions' && key !== 'captions' && key !== 'record',
  )
  if (input.raiseHandOnPrimary !== true) media.unshift('raise_hand')
  if (input.reactionsOnPrimary !== true) media.unshift('reactions')
  if (input.captionsOnPrimary !== true && input.supportsLiveCaptions !== false) {
    media.push('captions')
  }
  if (input.supportsRecording && !input.recording && input.recordOnPrimary !== true) {
    media.push('record')
  }

  if (view.length) sections.push({ title: 'View', keys: view })
  if (media.length) sections.push({ title: 'Audio & video', keys: media })
  if (apps.length) sections.push({ title: 'Apps', keys: apps })
  if (webMeeting.length) sections.push({ title: 'Meeting', keys: webMeeting })
  if (host.length) sections.push({ title: 'Host', keys: host })
  return sections
}

/** Short dock labels for Zoom mobile (icon + caption under control). */
export function meetingToolbarPrimaryLabel(
  key: MeetingToolbarPrimaryKey,
  input: {
    mode?: MeetingToolbarMode
    compact?: boolean
    audioEnabled?: boolean
    videoEnabled?: boolean
    screenSharing?: boolean
    recording?: boolean
    participantCount?: number
  },
): string {
  const mode = meetingToolbarMode(input)
  const mobile = mode === 'mobile'
  switch (key) {
    case 'mic':
      return input.audioEnabled === false ? 'Unmute' : 'Mute'
    case 'camera':
      return input.videoEnabled === false
        ? mobile
          ? 'Start video'
          : 'Start Video'
        : mobile
          ? 'Stop video'
          : 'Stop Video'
    case 'participants':
      return mobile ? 'People' : 'Participants'
    case 'chat':
      return 'Chat'
    case 'share_screen':
      return input.screenSharing ? (mobile ? 'Stop' : 'Stop share') : mobile ? 'Share' : 'Start share'
    case 'reactions':
      return 'Reactions'
    case 'raise_hand':
      return 'Hand'
    case 'security':
      return 'Security'
    case 'record':
      return 'Record'
    case 'stop_record':
      return mobile ? 'Stop' : 'Stop recording'
    case 'more':
      return 'More'
    case 'leave':
      return 'Leave'
    case 'end_meeting':
      return 'End'
    case 'captions':
      return mobile ? 'CC' : 'Show captions'
    case 'docs':
      return 'Docs'
    case 'apps':
      return 'Apps'
    case 'invite':
      return 'Invite'
    case 'whiteboard':
      return mobile ? 'Board' : 'Whiteboard'
    case 'browse':
      return 'Minimize'
    default:
      return key
  }
}

/** Toolbar must sit above side panels / captions so mic & camera stay tappable. */
export const MEETING_TOOLBAR_Z_INDEX = 220
export const MEETING_SIDE_PANEL_Z_INDEX = 35
/** Caption band above video/panels, just under the control dock. */
export const MEETING_CAPTIONS_Z_INDEX = MEETING_TOOLBAR_Z_INDEX - 40
export const MEETING_REACTION_TRAY_Z_INDEX = MEETING_TOOLBAR_Z_INDEX + 20
/**
 * Portaled More / Security menus escape InstantMeetingHost overflow via
 * document.body — they must also clear that host's z-index (90_000) or clicks
 * look like a no-op (menu paints underneath the meeting overlay).
 */
export const MEETING_PORTAL_Z_INDEX = 100_000
