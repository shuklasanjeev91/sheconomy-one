/**
 * Zoom-mobile More sheet: reaction strip + icon grid (Sheconomy branding).
 */

import type { MeetingRole } from '~/co-work/lib/types'
import { canOpenHostTools } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingToolbarOverflowKey } from '~/co-work/lib/meeting-toolbar'

/** Ordered Zoom-mobile More grid keys (3 columns). */
export function meetingMobileMoreGridKeys(input: {
  viewerRole: MeetingRole
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  hasWhiteboard?: boolean
  hasHostTools?: boolean
  hasApps?: boolean
}): MeetingToolbarOverflowKey[] {
  const keys: MeetingToolbarOverflowKey[] = ['manage_participants']
  if (input.supportsScreenShare !== false) keys.push('share_screen')
  if (input.supportsLiveCaptions !== false) keys.push('captions')
  // Zoom “Apps” row — polls / Q&A / whiteboard entry points.
  if (input.hasApps !== false) keys.push('polls')
  keys.push('disconnect_audio', 'meeting_info')
  if (input.hasWhiteboard !== false) keys.push('whiteboard')
  if (input.hasHostTools ?? canOpenHostTools(input.viewerRole)) {
    keys.push('host_tools')
  }
  keys.push('settings', 'safe_driving')
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
