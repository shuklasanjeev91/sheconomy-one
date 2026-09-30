/**
 * Zoom-mobile More sheet grid — Sheconomy branded, fuller than stock Zoom.
 *
 * Zoom core row + Virtual background / Whiteboard / Record / Safe driving so
 * hosts are not stuck hunting under Settings for everyday controls.
 */

import type { MeetingRole } from '~/co-work/lib/types'
import { canOpenHostTools } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingToolbarOverflowKey } from '~/co-work/lib/meeting-toolbar'

/** Ordered More grid keys (3 columns). */
export function meetingMobileMoreGridKeys(input: {
  viewerRole: MeetingRole
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  hasWhiteboard?: boolean
  hasHostTools?: boolean
  hasApps?: boolean
  supportsRecording?: boolean
  hasBackground?: boolean
  hasSafeDriving?: boolean
}): MeetingToolbarOverflowKey[] {
  // Share is a one-tap button on the phone dock (Zoom), not a More item.
  const keys: MeetingToolbarOverflowKey[] = [
    'manage_participants',
    'captions',
    'polls', // Apps
    'disconnect_audio',
    'meeting_info',
  ]

  if (input.hasHostTools ?? canOpenHostTools(input.viewerRole)) {
    keys.push('host_tools')
  }
  keys.push('settings')

  if (input.hasBackground !== false) keys.push('background')
  if (input.hasWhiteboard !== false) keys.push('whiteboard')
  if (input.supportsRecording === true) keys.push('record')
  if (input.hasSafeDriving !== false) keys.push('safe_driving')

  return keys
}

export function meetingMobileMoreGridLabel(key: MeetingToolbarOverflowKey): string {
  switch (key) {
    case 'manage_participants':
      return 'Participants'
    case 'share_screen':
      return 'Start share'
    case 'captions':
      return 'Show captions'
    case 'whiteboard':
      return 'Whiteboard'
    case 'background':
      return 'Background'
    case 'record':
      return 'Record'
    case 'polls':
      return 'Apps'
    case 'disconnect_audio':
      return 'Disconnect audio'
    case 'meeting_info':
      return 'Meeting info'
    case 'host_tools':
      return 'Host tools'
    case 'settings':
      return 'Settings'
    case 'safe_driving':
      return 'Safe driving'
    default:
      return key.replace(/_/g, ' ')
  }
}
