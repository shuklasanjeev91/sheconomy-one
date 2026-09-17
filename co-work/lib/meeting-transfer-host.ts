import { meetingRoleFromFlags } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingParticipant } from '~/co-work/lib/types'

/** Admitted members who can receive host (Zoom-style transfer target list). */
export function transferHostCandidates(
  participants: MeetingParticipant[],
  currentUserId: string,
): MeetingParticipant[] {
  return participants.filter((participant) => {
    if (participant.status !== 'admitted') return false
    if (participant.user_id === currentUserId) return false
    const role = meetingRoleFromFlags({
      role: participant.role,
      isHost: participant.is_host,
    })
    return role !== 'host'
  })
}
