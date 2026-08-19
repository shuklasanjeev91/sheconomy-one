import { fetchMeetingByCode, formatMeetingCode } from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'

export type RecentMeetingRevisitCard = {
  code: string
  codeLabel: string
  title: string
  badge: string
  href: string
}

const REJOINABLE_STATUSES = new Set<Meeting['status']>(['scheduled', 'instant', 'active'])

function meetingBadge(meeting: Meeting | null, code: string) {
  if (!meeting) return 'Recent room'
  if (meeting.status === 'active') return 'Live now'
  if (meeting.status === 'instant') return 'Instant room'
  if (meeting.status === 'scheduled') return 'Scheduled'
  return 'Recent room'
}

export function buildRecentMeetingRevisitCards(
  meetings: Array<{ code: string; meeting: Meeting | null }>,
  limit = 4,
): RecentMeetingRevisitCard[] {
  return meetings.slice(0, limit).map(({ code, meeting }) => ({
    code,
    codeLabel: formatMeetingCode(code),
    title: meeting?.title?.trim() || `Meeting ${formatMeetingCode(code)}`,
    badge: meetingBadge(meeting, code),
    href: coWorkRoutes.meeting(code),
  }))
}

export async function fetchRecentMeetingRevisitCards(
  codes: string[],
  limit = 4,
): Promise<RecentMeetingRevisitCard[]> {
  const unique = [...new Set(codes.map((code) => code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).filter(Boolean))]
  const resolved = await Promise.all(
    unique.slice(0, limit).map(async (code) => ({
      code,
      meeting: await fetchMeetingByCode(code),
    })),
  )

  const prioritized = resolved.sort((a, b) => {
    const aLive = a.meeting && REJOINABLE_STATUSES.has(a.meeting.status) ? 1 : 0
    const bLive = b.meeting && REJOINABLE_STATUSES.has(b.meeting.status) ? 1 : 0
    return bLive - aLive
  })

  return buildRecentMeetingRevisitCards(prioritized, limit)
}

export function recentMeetingsSeeAllHref() {
  return coWorkRoutes.meetings
}
