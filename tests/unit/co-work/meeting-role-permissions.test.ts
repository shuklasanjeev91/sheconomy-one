import { describe, expect, it } from 'vitest'

import {
  canAdmitParticipants,
  canChangeCriticalMeetingSettings,
  canChangeParticipantPermissions,
  canEditOrCancelMeeting,
  canEditOrCancelMeetingForUser,
  canEndMeetingForEveryone,
  canManageMeeting,
  canManageMeetingChat,
  canManageMeetingRoles,
  canModerateParticipant,
  canOpenHostTools,
  canSendHostsOnlyChat,
  canTransferHost,
  meetingRoleBadgeLabel,
  meetingRoleFromFlags,
} from '../../../co-work/lib/meeting-role-permissions'

describe('meeting role permissions', () => {
  it('allows hosts and co-hosts to manage meeting participants', () => {
    expect(canManageMeeting('host')).toBe(true)
    expect(canManageMeeting('co_host')).toBe(true)
    expect(canManageMeeting('participant')).toBe(false)
  })

  it('allows hosts and co-hosts to edit or cancel meetings', () => {
    expect(canEditOrCancelMeeting('host')).toBe(true)
    expect(canEditOrCancelMeeting('co_host')).toBe(true)
    expect(canEditOrCancelMeeting('participant')).toBe(false)
    expect(
      canEditOrCancelMeetingForUser({ userId: 'a', hostId: 'a', viewerRole: 'participant' }),
    ).toBe(true)
    expect(
      canEditOrCancelMeetingForUser({ userId: 'b', hostId: 'a', viewerRole: 'co_host' }),
    ).toBe(true)
    expect(
      canEditOrCancelMeetingForUser({ userId: 'b', hostId: 'a', viewerRole: 'participant' }),
    ).toBe(false)
  })

  it('prevents co-hosts from moderating hosts or peer co-hosts', () => {
    expect(canModerateParticipant('co_host', 'participant')).toBe(true)
    expect(canModerateParticipant('co_host', 'co_host')).toBe(false)
    expect(canModerateParticipant('co_host', 'host')).toBe(false)
    expect(canModerateParticipant('host', 'co_host')).toBe(true)
    expect(canModerateParticipant('host', 'host')).toBe(false)
  })

  it('reserves role assignment, transfer, end, and critical settings for hosts', () => {
    expect(canManageMeetingRoles('host')).toBe(true)
    expect(canManageMeetingRoles('co_host')).toBe(false)
    expect(canTransferHost('host')).toBe(true)
    expect(canTransferHost('co_host')).toBe(false)
    expect(canEndMeetingForEveryone('host')).toBe(true)
    expect(canEndMeetingForEveryone('co_host')).toBe(false)
    expect(canChangeCriticalMeetingSettings('host')).toBe(true)
    expect(canChangeCriticalMeetingSettings('co_host')).toBe(false)
  })

  it('lets co-hosts admit guests and manage host chat', () => {
    expect(canAdmitParticipants('co_host')).toBe(true)
    expect(canAdmitParticipants('participant')).toBe(false)
    expect(canManageMeetingChat('co_host')).toBe(true)
    expect(canSendHostsOnlyChat('co_host')).toBe(true)
    expect(canSendHostsOnlyChat('participant')).toBe(false)
  })

  it('opens Host tools for host and co-host but reserves permission toggles for host', () => {
    expect(canOpenHostTools('host')).toBe(true)
    expect(canOpenHostTools('co_host')).toBe(true)
    expect(canOpenHostTools('participant')).toBe(false)
    expect(canChangeParticipantPermissions('host')).toBe(true)
    expect(canChangeParticipantPermissions('co_host')).toBe(false)
  })

  it('renders uppercase role badges for host and co-host only', () => {
    expect(meetingRoleBadgeLabel('host')).toBe('HOST')
    expect(meetingRoleBadgeLabel('co_host')).toBe('CO-HOST')
    expect(meetingRoleBadgeLabel('participant')).toBeNull()
  })

  it('derives role from flags when role column is missing', () => {
    expect(meetingRoleFromFlags({ isHost: true })).toBe('host')
    expect(meetingRoleFromFlags({ hostId: 'a', userId: 'a' })).toBe('host')
    expect(meetingRoleFromFlags({ role: 'co_host', isHost: false })).toBe('co_host')
    expect(meetingRoleFromFlags({})).toBe('participant')
  })
})
