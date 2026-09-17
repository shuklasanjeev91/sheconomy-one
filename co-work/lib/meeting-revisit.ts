import type { Meeting } from '~/co-work/lib/types'
import { formatMeetingInstantForViewer } from '~/lib/calendar/timezone'
import { coWorkRoutes } from '~/lib/routes'

export type MeetingRevisitCard = {
  meetingId: string
  title: string
  whenLabel: string
  badge: string
  hostName: string | null
  href: string
  isLive: boolean
}

const UPCOMING_STATUSES = new Set<Meeting['status']>(['scheduled', 'instant', 'active'])

export function formatMeetingWhenLabel(meeting: Pick<Meeting, 'scheduled_at' | 'started_at' | 'created_at' | 'time_zone'>) {
  const raw = meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at
  if (!raw) return 'Time TBD'
  // Viewer-local timezone — host and invitee see different wall clocks for the same UTC instant.
  return formatMeetingInstantForViewer(raw)
}

export function buildMeetingRevisitCards(
  meetings: Meeting[],
  userId: string,
  limit = 4,
): MeetingRevisitCard[] {
  return meetings
    .filter((meeting) => UPCOMING_STATUSES.has(meeting.status))
    .sort((a, b) => {
      const aAt = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.MAX_SAFE_INTEGER
      const bAt = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.MAX_SAFE_INTEGER
      return aAt - bAt
    })
    .slice(0, limit)
    .map((meeting) => {
      const isHost = meeting.host_id === userId
      const isLive = meeting.status === 'active' || meeting.status === 'instant'
      return {
        meetingId: meeting.id,
        title: meeting.title,
        whenLabel: formatMeetingWhenLabel(meeting),
        badge: isLive ? 'Live now' : isHost ? 'Hosting' : 'Invited',
        hostName: meeting.host?.full_name ?? meeting.host?.username ?? null,
        href: coWorkRoutes.meeting(meeting.meeting_code),
        isLive,
      }
    })
}
