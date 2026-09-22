import type { MeetingRole } from '~/co-work/lib/types'
import {
  canChangeCriticalMeetingSettings,
  canManageMeeting,
  canManageMeetingRoles,
  canModerateParticipant,
  canTransferHost,
} from '~/co-work/lib/meeting-role-permissions'

export type ParticipantRowActionKey =
  | 'mute'
  | 'ask_to_unmute'
  | 'stop_video'
  | 'make_co_host'
  | 'remove'
  | 'put_in_waiting_room'
  | 'lower_hand'
  | 'ask_to_mute'
  | 'remove_co_host'
  | 'make_host'

export type HostBulkActionKey = 'mute_all' | 'ask_all_to_unmute' | 'remove_all_except_host' | 'lock_meeting'

/** Primary + overflow actions available on an admitted participant row. */
export function participantRowActions(input: {
  viewerRole: MeetingRole
  targetRole: MeetingRole
  isSelf: boolean
  isMuted: boolean
  isVideoOff: boolean
  handRaised?: boolean
}): ParticipantRowActionKey[] {
  const { viewerRole, targetRole, isSelf, isMuted, isVideoOff, handRaised } = input
  if (isSelf) return []

  const actions: ParticipantRowActionKey[] = []
  const canModerateTarget = canModerateParticipant(viewerRole, targetRole)

  if (canModerateTarget) {
    if (!isMuted) actions.push('mute')
    if (isMuted) actions.push('ask_to_unmute')
    if (!isVideoOff) actions.push('stop_video')
    if (handRaised) actions.push('lower_hand')
    actions.push('put_in_waiting_room')
    actions.push('remove')
    actions.push('ask_to_mute')
  }

  if (canManageMeetingRoles(viewerRole)) {
    if (targetRole === 'participant') actions.push('make_co_host')
    if (targetRole === 'co_host') actions.push('remove_co_host')
    if (canTransferHost(viewerRole)) actions.push('make_host')
  }

  return actions
}

/** Host/co-host bulk controls shown above the participant list. */
export function hostBulkActions(viewerRole: MeetingRole): HostBulkActionKey[] {
  if (!canManageMeeting(viewerRole)) return []

  const actions: HostBulkActionKey[] = ['ask_all_to_unmute']
  if (canChangeCriticalMeetingSettings(viewerRole)) {
    actions.unshift('mute_all')
    actions.push('remove_all_except_host', 'lock_meeting')
  }
  return actions
}
