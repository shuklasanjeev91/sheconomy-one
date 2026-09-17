import { fetchNetworkSummary } from '~/community/lib/network'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { formatInviteDisplayTime } from '~/lib/calendar/invite-time'
import {
  buildMeetingInviteEmailText,
  formatMeetingIdForEmail,
} from '~/lib/calendar/meeting-invite-email'
import { buildCalendarLinks } from '~/lib/calendar/ics'
import { supabase } from '~/lib/supabase/client'

import { getMeetingShareUrl } from '~/co-work/lib/meetings'
import { BRAND_COWORK_LABEL } from '~/config/brand'
import type { Meeting, MeetingInviteCandidate, MeetingInvitee } from '~/co-work/lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidInviteEmail(email: string) {
  return EMAIL_RE.test(email.trim())
}

export function parseMeetingInvitees(value: unknown): MeetingInvitee[] {
  if (!Array.isArray(value)) return []

  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const row = raw as Record<string, unknown>
      const type = row.type === 'email' ? 'email' : 'user'
      const email = typeof row.email === 'string' ? row.email : undefined
      const id = typeof row.id === 'string' ? row.id : email ? `email:${email}` : ''
      const name =
        typeof row.name === 'string'
          ? row.name
          : typeof row.full_name === 'string'
            ? row.full_name
            : email ?? 'Guest'

      if (!id) return null

      return {
        id,
        type,
        name,
        email,
        avatar: typeof row.avatar === 'string' ? row.avatar : typeof row.avatar_url === 'string' ? row.avatar_url : null,
        headline: typeof row.headline === 'string' ? row.headline : null,
        invited_at: typeof row.invited_at === 'string' ? row.invited_at : undefined,
        status: (row.status as MeetingInvitee['status']) ?? 'pending',
      } satisfies MeetingInvitee
    })
    .filter((row): row is MeetingInvitee => !!row)
}

export function inviteeKey(invitee: MeetingInvitee) {
  return invitee.type === 'email' ? `email:${(invitee.email ?? invitee.id).toLowerCase()}` : `user:${invitee.id}`
}

export function mergeInvitees(existing: MeetingInvitee[], next: MeetingInvitee[]) {
  const map = new Map<string, MeetingInvitee>()
  for (const item of existing) map.set(inviteeKey(item), item)
  for (const item of next) map.set(inviteeKey(item), item)
  return [...map.values()]
}

export function candidateToInvitee(candidate: MeetingInviteCandidate): MeetingInvitee {
  return {
    id: candidate.user_id,
    type: 'user',
    name: candidate.full_name,
    email: candidate.email ?? undefined,
    avatar: candidate.avatar_url,
    headline: candidate.headline,
    status: 'pending',
  }
}

export function emailToInvitee(email: string): MeetingInvitee {
  const normalized = email.trim().toLowerCase()
  return {
    id: `email:${normalized}`,
    type: 'email',
    name: normalized,
    email: normalized,
    status: 'pending',
  }
}

export async function searchInviteCandidates(
  userId: string,
  query: string,
): Promise<MeetingInviteCandidate[]> {
  const trimmed = query.trim()

  if (!trimmed) {
    const summary = await fetchNetworkSummary(userId)
    return summary.connections.slice(0, 24).map((member) => ({
      user_id: member.user_id,
      full_name: member.full_name,
      username: member.username,
      email: null,
      avatar_url: member.avatar_url,
      headline: member.headline,
      source: 'connection' as const,
    }))
  }

  if (isValidInviteEmail(trimmed)) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, avatar_url, headline')
      .eq('is_deleted', false)
      .ilike('email', trimmed)
      .neq('id', userId)
      .limit(5)

    if (byEmail?.length) {
      return byEmail.map((row) => ({
        user_id: row.id,
        full_name: row.full_name ?? row.username ?? 'Member',
        username: row.username,
        email: row.email,
        avatar_url: row.avatar_url,
        headline: row.headline,
        source: 'search' as const,
      }))
    }
  }

  const pattern = `%${trimmed}%`
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email, avatar_url, headline')
    .eq('is_deleted', false)
    .or(`full_name.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern}`)
    .neq('id', userId)
    .limit(20)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    user_id: row.id,
    full_name: row.full_name ?? row.username ?? 'Member',
    username: row.username,
    email: row.email,
    avatar_url: row.avatar_url,
    headline: row.headline,
    source: 'search' as const,
  }))
}

export async function updateMeetingInvitees(meetingId: string, invitees: MeetingInvitee[]) {
  const stamped = invitees.map((invitee) => ({
    ...invitee,
    invited_at: invitee.invited_at ?? new Date().toISOString(),
  }))

  const { error } = await supabase.rpc('update_meeting_invitees_secure', {
    meeting_id_input: meetingId,
    invitees_input: stamped,
  })
  if (error) throw new Error(error.message)
  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
  return stamped
}

type InviteResponse = {
  ok?: boolean
  error?: string
  invited?: number
  notifications?: number
  emailsSent?: number
  mailtoLinks?: string[]
}

/** Send invites via sheconomy_db edge function (in-app + email when configured). */
export async function sendMeetingInvites(input: {
  meetingId: string
  invitees: MeetingInvitee[]
  message?: string
}) {
  const unique = mergeInvitees([], input.invitees)
  if (unique.length === 0) {
    throw new Error('Add at least one person to invite')
  }

  const { data, error } = await supabase.functions.invoke('meeting-invite', {
    body: {
      meetingId: input.meetingId,
      invitees: unique,
      message: input.message?.trim() || undefined,
    },
  })

  const payload = (data ?? {}) as InviteResponse
  if (payload.error) throw new Error(payload.error)
  if (error) {
    // FunctionsHttpError often only says "non-2xx" — prefer body error when present.
    throw new Error(payload.error || error.message || 'Failed to send invites')
  }

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)

  return payload
}

export function buildInviteMailtoLink(meeting: Meeting, invitee: MeetingInvitee, hostName: string) {
  const url = getMeetingShareUrl(meeting.meeting_code)
  const startsAt = meeting.scheduled_at ?? meeting.started_at ?? new Date().toISOString()
  const display = formatInviteDisplayTime({
    startsAt,
    endsAt: meeting.scheduled_end_at,
    inviteeTimeZone: invitee.timeZone,
    hostTimeZone: meeting.time_zone,
  })
  const passcode = meeting.security_settings?.passcode
  const calendar = buildCalendarLinks({
    title: meeting.title,
    description: [
      meeting.description,
      `Join: ${url}`,
      `Meeting code: ${meeting.meeting_code}`,
      passcode ? `Passcode: ${passcode}` : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    startsAt,
    endsAt: meeting.scheduled_end_at ?? undefined,
    url,
  })

  const text = buildMeetingInviteEmailText({
    brandLabel: BRAND_COWORK_LABEL,
    meetingTitle: meeting.title,
    hostName,
    dateLabel: display.dateLabel,
    timeLabel: display.timeLabel,
    endsLabel: display.endsLabel,
    joinUrl: url,
    meetingIdLabel: formatMeetingIdForEmail(meeting.meeting_code),
    passcode: passcode || null,
    googleCalendarUrl: calendar.google,
    outlookCalendarUrl: calendar.outlook,
    timezoneNote:
      display.source === 'utc'
        ? 'Times shown in UTC.'
        : `Shown in your timezone (${display.timeZone}).`,
    hostZoneHint: display.hostZoneHint,
  })

  const subject = encodeURIComponent(`Join Co-Work: ${meeting.title}`)
  const body = encodeURIComponent(text)
  const to = encodeURIComponent(invitee.email ?? '')
  return `mailto:${to}?subject=${subject}&body=${body}`
}

export function formatInviteeLabel(invitee: MeetingInvitee) {
  if (invitee.type === 'email') return invitee.email ?? invitee.name
  return invitee.name
}
