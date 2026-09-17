import type { MeetingModerationSettings, MeetingParticipant, MeetingRole } from '~/co-work/lib/types'

export type HostLeaveBehavior = MeetingModerationSettings['host_leave_behavior']

/** Copy for the host “End meeting” confirmation dialog. */
export function endMeetingConfirmCopy() {
  return {
    title: 'End meeting for everyone?',
    message:
      'This stops the meeting for all participants, ends screen sharing, and closes the session.',
    cancelLabel: 'Cancel',
    confirmLabel: 'End Meeting',
  } as const
}

/**
 * Explain what happens if the host leaves without ending, based on moderation
 * settings and who is still admitted in the room.
 */
export function hostLeaveConfirmCopy(input: {
  behavior: HostLeaveBehavior | null | undefined
  participants: Array<Pick<MeetingParticipant, 'user_id' | 'status' | 'role' | 'is_host'>>
  hostUserId: string
}) {
  const admitted = input.participants.filter((p) => p.status === 'admitted')
  const eligible = pickEligibleHostSuccessor({
    participants: admitted,
    hostUserId: input.hostUserId,
  })
  const behavior = input.behavior === 'transfer_to_co_host' ? 'transfer_to_co_host' : 'end'

  if (behavior === 'transfer_to_co_host' && eligible) {
    const label =
      eligible.role === 'co_host' || eligible.is_host
        ? 'a co-host'
        : 'another participant'
    return {
      title: 'Leave meeting?',
      message: `Your host role will transfer to ${label}. The meeting continues for everyone else.`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Leave',
      willEndMeeting: false,
    } as const
  }

  return {
    title: 'Leave meeting?',
    message:
      behavior === 'transfer_to_co_host'
        ? 'No eligible host is available, so leaving will end the meeting for everyone.'
        : 'Leaving as host will end the meeting for everyone.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Leave',
    willEndMeeting: true,
  } as const
}

/** Prefer co-host, otherwise any admitted non-host participant. */
export function pickEligibleHostSuccessor(input: {
  participants: Array<{
    user_id: string
    status?: string
    role?: MeetingRole | null
    is_host?: boolean | null
  }>
  hostUserId: string
}): { user_id: string; role?: MeetingRole | null; is_host?: boolean | null } | null {
  const pool = input.participants.filter(
    (p) =>
      p.user_id !== input.hostUserId &&
      (p.status == null || p.status === 'admitted'),
  )
  const coHost = pool.find((p) => p.role === 'co_host')
  if (coHost) return coHost
  return pool[0] ?? null
}

export function shouldEndLiveKitRoomAfterHostLeave(input: {
  previousRole: MeetingRole | null | undefined
  meetingStatus: string | null | undefined
}): boolean {
  if (input.previousRole !== 'host') return false
  return input.meetingStatus === 'ended' || input.meetingStatus === 'cancelled'
}
