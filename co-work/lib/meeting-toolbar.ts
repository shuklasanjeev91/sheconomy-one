import type { MeetingRole } from '~/co-work/lib/types'
import {
  canChangeCriticalMeetingSettings,
  canEndMeetingForEveryone,
  canManageMeeting,
} from '~/co-work/lib/meeting-role-permissions'

/** Primary dock controls for the Zoom-style meeting toolbar. */
export type MeetingToolbarPrimaryKey =
  | 'mic'
  | 'camera'
  | 'security'
  | 'participants'
  | 'chat'
  | 'share_screen'
  | 'captions'
  | 'invite'
  | 'browse'
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

/**
 * Desktop / roomy primary order.
 * Hosts get Security + End Meeting; everyone keeps Mic/Camera.
 * Minimize sits early so it stays on the first row on iPad (not clipped after Invite).
 */
export function meetingToolbarPrimaryKeys(input: {
  viewerRole: MeetingRole
  supportsVideo?: boolean
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  /** Show primary Minimize control (mini-player + other Sheconomy tabs). Default true. */
  hasBrowse?: boolean
}): MeetingToolbarPrimaryKey[] {
  const keys: MeetingToolbarPrimaryKey[] = ['mic']
  if (input.supportsVideo !== false) keys.push('camera')
  if (canChangeCriticalMeetingSettings(input.viewerRole)) keys.push('security')
  keys.push('participants', 'chat')
  if (input.hasBrowse !== false) keys.push('browse')
  if (input.supportsScreenShare) keys.push('share_screen')
  if (input.supportsLiveCaptions !== false) keys.push('captions')
  keys.push('invite')
  keys.push('more', 'leave')
  if (canEndMeetingForEveryone(input.viewerRole)) keys.push('end_meeting')
  return keys
}

/** Items that belong in the dedicated host Security flyout. */
export function meetingToolbarSecurityKeys(viewerRole: MeetingRole): MeetingToolbarOverflowKey[] {
  if (!canChangeCriticalMeetingSettings(viewerRole)) return []
  return ['lock_meeting', 'mute_all', 'ask_all_to_mute', 'ask_all_to_unmute', 'remove_all_except_host']
}

/** Items that belong in the More flyout (never duplicate Security primary). */
export function meetingToolbarMoreKeys(input: {
  viewerRole: MeetingRole
  supportsRecording?: boolean
  supportsVideo?: boolean
  hasAudioSettings?: boolean
  hasShareLink?: boolean
  hasFullscreen?: boolean
  hasMinimize?: boolean
  hasPictureInPicture?: boolean
}): MeetingToolbarOverflowKey[] {
  const keys: MeetingToolbarOverflowKey[] = []
  if (input.hasAudioSettings) keys.push('audio_settings')
  keys.push('raise_hand', 'reactions')
  if (input.supportsRecording) keys.push('record')
  if (input.supportsVideo !== false) keys.push('background')
  keys.push('meeting_info')
  if (input.hasShareLink) keys.push('share_link')
  if (input.hasFullscreen) keys.push('fullscreen')
  // Also list Minimize in More so users who look there (Zoom habit) find it.
  if (input.hasMinimize) keys.push('minimize')
  if (input.hasPictureInPicture) keys.push('picture_in_picture')

  if (canManageMeeting(input.viewerRole) && !canChangeCriticalMeetingSettings(input.viewerRole)) {
    // Co-host moderate shortcuts live in More (hosts use the Security button).
    keys.push('ask_all_to_mute', 'ask_all_to_unmute', 'manage_participants')
  }
  return keys
}

/** Toolbar must sit above side panels / captions so it stays tappable. */
export const MEETING_TOOLBAR_Z_INDEX = 150
export const MEETING_SIDE_PANEL_Z_INDEX = 35
