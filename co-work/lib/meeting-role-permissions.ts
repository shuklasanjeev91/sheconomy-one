import type { MeetingRole } from './types'

export type MeetingChatAudience = 'everyone' | 'hosts' | 'private'

/** Host + co-host can manage the live room (admit, mute asks, remove participants). */
export function canManageMeeting(viewerRole: MeetingRole): boolean {
  return viewerRole === 'host' || viewerRole === 'co_host'
}

/** Edit schedule/details or cancel a meeting — host + co-host. */
export function canEditOrCancelMeeting(viewerRole: MeetingRole): boolean {
  return canManageMeeting(viewerRole)
}

/** Open Zoom-style Host tools sheet — host + co-host. */
export function canOpenHostTools(viewerRole: MeetingRole): boolean {
  return canManageMeeting(viewerRole)
}

/**
 * Change live participant permissions (share / chat / unmute / video) — host only.
 * Co-hosts can view Host tools but cannot flip these toggles.
 */
export function canChangeParticipantPermissions(viewerRole: MeetingRole): boolean {
  return canChangeCriticalMeetingSettings(viewerRole)
}

/**
 * Out-of-meeting gate when we have host_id and/or an explicit viewer role
 * (e.g. My Meetings list, schedule edit screen).
 */
export function canEditOrCancelMeetingForUser(input: {
  userId: string
  hostId: string
  viewerRole?: MeetingRole | null
}): boolean {
  if (input.hostId === input.userId) return true
  return canEditOrCancelMeeting(meetingRoleFromFlags({ role: input.viewerRole }))
}

/** Mute / stop-video / remove a specific participant. */
export function canModerateParticipant(
  viewerRole: MeetingRole,
  targetRole: MeetingRole,
): boolean {
  if (viewerRole === 'host') return targetRole !== 'host'
  if (viewerRole === 'co_host') return targetRole === 'participant'
  return false
}

/** Assign co-host, remove co-host, transfer host — host only. */
export function canManageMeetingRoles(viewerRole: MeetingRole): boolean {
  return viewerRole === 'host'
}

/** End meeting for everyone — host only. */
export function canEndMeetingForEveryone(viewerRole: MeetingRole): boolean {
  return viewerRole === 'host'
}

/** Transfer host role — host only. */
export function canTransferHost(viewerRole: MeetingRole): boolean {
  return viewerRole === 'host'
}

/**
 * Critical settings: lock room, host-leave behavior, security toggles,
 * remove-all, force mute-all — host only.
 */
export function canChangeCriticalMeetingSettings(viewerRole: MeetingRole): boolean {
  return viewerRole === 'host'
}

/** Admit / reject waiting-room guests. */
export function canAdmitParticipants(viewerRole: MeetingRole): boolean {
  return canManageMeeting(viewerRole)
}

/** Hosts-only chat + soft-delete others' messages. */
export function canManageMeetingChat(viewerRole: MeetingRole): boolean {
  return canManageMeeting(viewerRole)
}

export function canSendHostsOnlyChat(viewerRole: MeetingRole): boolean {
  return canManageMeetingChat(viewerRole)
}

export function meetingRoleBadgeLabel(role: MeetingRole | null | undefined): string | null {
  if (role === 'host') return 'HOST'
  if (role === 'co_host') return 'CO-HOST'
  return null
}

export function meetingRoleFromFlags(input: {
  role?: MeetingRole | null
  isHost?: boolean | null
  hostId?: string | null
  userId?: string | null
}): MeetingRole {
  if (input.role === 'host' || input.role === 'co_host' || input.role === 'participant') {
    return input.role
  }
  if (input.isHost) return 'host'
  if (input.hostId && input.userId && input.hostId === input.userId) return 'host'
  return 'participant'
}
