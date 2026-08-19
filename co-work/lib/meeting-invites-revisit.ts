import { filterMeetingsWithinRetention } from '~/co-work/lib/meetings'
import { inviteeKey, parseMeetingInvitees } from '~/co-work/lib/invites'
import type { Meeting, MeetingInvitee } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

import { formatMeetingWhenLabel } from '~/co-work/lib/meeting-revisit'

const MEETING_SELECT =
  'id, title, description, meeting_code, host_id, status, scheduled_at, started_at, ended_at, time_zone, max_participants, room_id, security_settings, meeting_options, invitees, created_at, host:profiles!meetings_host_id_fkey(full_name, username, avatar_url)'

const UPCOMING_STATUSES = new Set<Meeting['status']>(['scheduled', 'instant', 'active'])

export type MeetingInviteRevisitCard = {
  meetingId: string
  title: string
  whenLabel: string
  hostName: string | null
  href: string
  isLive: boolean
}

function mapMeeting(row: Record<string, unknown>): Meeting {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    meeting_code: row.meeting_code as string,
    host_id: row.host_id as string,
    status: row.status as Meeting['status'],
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    time_zone: (row.time_zone as string | null) ?? null,
    max_participants: (row.max_participants as number | null) ?? null,
    room_id: (row.room_id as string | null) ?? null,
    security_settings: null,
    meeting_options: null,
    created_at: (row.created_at as string | null) ?? null,
    is_recurring: null,
    repeat: null,
    invitees: parseMeetingInvitees(row.invitees),
    host: (row.host as Meeting['host']) ?? null,
  }
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? ''
}

function isPendingInviteForUser(invitee: MeetingInvitee, userId: string, userEmail: string) {
  if (invitee.status === 'joined') return false
  if (invitee.type === 'user') return invitee.id === userId
  const inviteEmail = normalizeEmail(invitee.email ?? invitee.id.replace(/^email:/, ''))
  return !!userEmail && inviteEmail === userEmail
}

export function buildMeetingInviteRevisitCards(
  meetings: Meeting[],
  userId: string,
  userEmail: string | null | undefined,
  limit = 4,
): MeetingInviteRevisitCard[] {
  const email = normalizeEmail(userEmail)

  return meetings
    .filter((meeting) => UPCOMING_STATUSES.has(meeting.status))
    .filter((meeting) => meeting.host_id !== userId)
    .filter((meeting) =>
      (meeting.invitees ?? []).some((invitee) => isPendingInviteForUser(invitee, userId, email)),
    )
    .sort((a, b) => {
      const aAt = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.MAX_SAFE_INTEGER
      const bAt = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.MAX_SAFE_INTEGER
      return aAt - bAt
    })
    .slice(0, limit)
    .map((meeting) => ({
      meetingId: meeting.id,
      title: meeting.title,
      whenLabel: formatMeetingWhenLabel(meeting),
      hostName: meeting.host?.full_name ?? meeting.host?.username ?? null,
      href: coWorkRoutes.meeting(meeting.meeting_code),
      isLive: meeting.status === 'active' || meeting.status === 'instant',
    }))
}

export async function fetchPendingMeetingInvites(
  userId: string,
  userEmail?: string | null,
): Promise<Meeting[]> {
  const email = normalizeEmail(userEmail)

  const base = () =>
    supabase
      .from('meetings')
      .select(MEETING_SELECT)
      .neq('host_id', userId)
      .in('status', ['scheduled', 'instant', 'active'])
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(20)

  const [byUser, byEmail, participantRows] = await Promise.all([
    base().contains('invitees', [{ id: userId, type: 'user' }]),
    email
      ? base().contains('invitees', [{ id: `email:${email}`, type: 'email' }])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.from('meeting_participants').select('meeting_id').eq('user_id', userId),
  ])

  const participantIds = new Set(
    (participantRows.data ?? []).map((row) => String(row.meeting_id)).filter(Boolean),
  )

  const byId = new Map<string, Meeting>()
  for (const row of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) {
    const meeting = mapMeeting(row as Record<string, unknown>)
    if (participantIds.has(meeting.id)) continue

    const pendingInvite = (meeting.invitees ?? []).some((invitee) =>
      isPendingInviteForUser(invitee, userId, email),
    )
    if (pendingInvite) byId.set(meeting.id, meeting)
  }

  return filterMeetingsWithinRetention([...byId.values()])
}

/** Dedupe cards when the same invite appears under user id and email keys. */
export function dedupeMeetingInvitees(invitees: MeetingInvitee[]) {
  const map = new Map<string, MeetingInvitee>()
  for (const invitee of invitees) map.set(inviteeKey(invitee), invitee)
  return [...map.values()]
}
