import type { MeetingRole } from '~/co-work/lib/types'
import {
  canChangeCriticalMeetingSettings,
  canEndMeetingForEveryone,
  canManageMeeting,
  canOpenHostTools,
} from '~/co-work/lib/meeting-role-permissions'

/** Primary dock controls for the Zoom-style meeting toolbar. */
export type MeetingToolbarPrimaryKey =
  | 'mic'
  | 'camera'
  | 'security'
  | 'participants'
  | 'chat'
  | 'reactions'
  | 'raise_hand'
  | 'share_screen'
  | 'captions'
  | 'invite'
  | 'browse'
  | 'stop_record'
  | 'more'
  | 'leave'
  | 'end_meeting'

export type MeetingToolbarOverflowKey =
  | 'audio_settings'
  | 'raise_hand'
  | 'reactions'
  | 'record'
  | 'background'
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
  | 'manage_participants'
  | 'view_gallery'
  | 'view_speaker'
  | 'view_screen_share'
  | 'view_dense_gallery'
  | 'mirror_video'
  | 'hide_self_view'
  | 'maximize'
  | 'captions'
  | 'invite'
  | 'host_tools'
  | 'breakout_rooms'
  | 'polls'
  | 'qna'

export type MeetingToolbarMoreSection = {
  title: string
  keys: MeetingToolbarOverflowKey[]
}

/**
 * Primary dock order (Zoom ease-of-use):
 * Mic → Camera → Security? → Participants → Chat → Reactions → Hand →
 * Minimize? → Share? → Captions → Invite? → Stop recording? → More → Leave → End?
 */
export function meetingToolbarPrimaryKeys(input: {
  viewerRole: MeetingRole
  supportsVideo?: boolean
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  /** Show primary Minimize control (mini-player + other Sheconomy tabs). Default true. */
  hasBrowse?: boolean
  /** Phone / compact: Invite moves to More to cut horizontal scroll. Captions stay primary. */
  compact?: boolean
  /** Host is actively recording — surface Stop on the dock. */
  recording?: boolean
  hasReactions?: boolean
  hasRaiseHand?: boolean
}): MeetingToolbarPrimaryKey[] {
  const compact = input.compact === true
  const keys: MeetingToolbarPrimaryKey[] = ['mic']
  if (input.supportsVideo !== false) keys.push('camera')
  if (canChangeCriticalMeetingSettings(input.viewerRole)) keys.push('security')
  else if (canOpenHostTools(input.viewerRole)) keys.push('security')
  keys.push('participants', 'chat')
  if (input.hasReactions !== false) keys.push('reactions')
  if (input.hasRaiseHand !== false) keys.push('raise_hand')
  if (input.hasBrowse !== false) keys.push('browse')
  if (input.supportsScreenShare) keys.push('share_screen')
  if (input.supportsLiveCaptions !== false) keys.push('captions')
  if (!compact) keys.push('invite')
  if (input.recording && canEndMeetingForEveryone(input.viewerRole)) {
    keys.push('stop_record')
  }
  keys.push('more', 'leave')
  if (canEndMeetingForEveryone(input.viewerRole)) keys.push('end_meeting')
  return keys
}

/**
 * Host Security flyout — lock + room audio asks only.
 * Bulk people danger (remove all) lives on the Participants panel.
 */
export function meetingToolbarSecurityKeys(viewerRole: MeetingRole): MeetingToolbarOverflowKey[] {
  if (!canChangeCriticalMeetingSettings(viewerRole)) return []
  return ['lock_meeting', 'mute_all', 'ask_all_to_mute', 'ask_all_to_unmute']
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
  supportsLiveCaptions?: boolean
  hasInvite?: boolean
  hasViewControls?: boolean
  /** When reactions/hand are on the primary dock, omit from More. */
  reactionsOnPrimary?: boolean
  raiseHandOnPrimary?: boolean
  /** Hide start-record in More while Stop is on the primary dock. */
  recording?: boolean
}): MeetingToolbarOverflowKey[] {
  return meetingToolbarMoreSections(input).flatMap((section) => section.keys)
}

/** Grouped More menu sections for clearer hierarchy. */
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
  supportsLiveCaptions?: boolean
  hasInvite?: boolean
  hasViewControls?: boolean
  hasDenseGallery?: boolean
  reactionsOnPrimary?: boolean
  raiseHandOnPrimary?: boolean
  recording?: boolean
  hasBreakouts?: boolean
  hasPolls?: boolean
  hasQa?: boolean
}): MeetingToolbarMoreSection[] {
  const view: MeetingToolbarOverflowKey[] = []
  if (input.hasViewControls !== false) {
    view.push('view_gallery', 'view_speaker', 'view_screen_share', 'mirror_video', 'hide_self_view', 'maximize')
    if (input.hasDenseGallery) view.push('view_dense_gallery')
  }

  const media: MeetingToolbarOverflowKey[] = []
  if (input.hasAudioSettings) media.push('audio_settings')
  if (input.raiseHandOnPrimary === false) media.push('raise_hand')
  if (input.reactionsOnPrimary === false) media.push('reactions')
  if (input.supportsRecording && !input.recording) media.push('record')
  if (input.supportsVideo !== false) media.push('background')

  const meeting: MeetingToolbarOverflowKey[] = []
  meeting.push('meeting_info')
  if (input.compact && input.hasInvite !== false) meeting.push('invite')
  if (input.hasShareLink) meeting.push('share_link')
  if (input.hasFullscreen) meeting.push('fullscreen')
  if (input.hasPictureInPicture) meeting.push('picture_in_picture')
  if (input.hasPolls) meeting.push('polls')
  if (input.hasQa) meeting.push('qna')
  if (input.hasBreakouts) meeting.push('breakout_rooms')

  const host: MeetingToolbarOverflowKey[] = []
  if (canOpenHostTools(input.viewerRole)) {
    host.push('host_tools')
  }
  if (canManageMeeting(input.viewerRole) && !canChangeCriticalMeetingSettings(input.viewerRole)) {
    host.push('ask_all_to_mute', 'ask_all_to_unmute', 'manage_participants')
  }

  const sections: MeetingToolbarMoreSection[] = []
  // Pin minimize at the top so native More Modal always shows the bubble
  // action without scrolling past View / Audio sections.
  if (input.hasMinimize) {
    sections.push({ title: 'Browse', keys: ['minimize'] })
  }
  if (view.length) sections.push({ title: 'View', keys: view })
  if (media.length) sections.push({ title: 'Audio & video', keys: media })
  if (meeting.length) sections.push({ title: 'Meeting', keys: meeting })
  if (host.length) sections.push({ title: 'Host', keys: host })
  return sections
}

/** Toolbar must sit above side panels / captions so it stays tappable. */
export const MEETING_TOOLBAR_Z_INDEX = 150
export const MEETING_SIDE_PANEL_Z_INDEX = 35
/** Caption band above video/panels, just under the control dock. */
export const MEETING_CAPTIONS_Z_INDEX = MEETING_TOOLBAR_Z_INDEX - 30
export const MEETING_REACTION_TRAY_Z_INDEX = MEETING_TOOLBAR_Z_INDEX + 20
/**
 * Portaled More / Security menus escape InstantMeetingHost overflow via
 * document.body — they must also clear that host's z-index (90_000) or clicks
 * look like a no-op (menu paints underneath the meeting overlay).
 */
export const MEETING_PORTAL_Z_INDEX = 100_000
