import type { SharePayload } from '~/lib/share'
import { getMeetingShareUrl } from '~/lib/share'
import {
  buildCalendarLinks,
  buildMeetingCalendarEvent,
  type CalendarEventInput,
} from '~/lib/calendar/ics'
import { resolveDeviceIanaTimeZone } from '~/lib/calendar/timezone'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import { BRAND_COWORK_LABEL, BRAND_NAME } from '~/config/brand'

const DEFAULT_DURATION_MS = 60 * 60 * 1000

export type MeetingShareSchedule = {
  startsAt: string
  endsAt: string
  /** True when times were inferred for a live/instant meeting. */
  inferred: boolean
}

/** Resolve a shareable start/end even for live instant meetings (Zoom-style). */
export function resolveMeetingShareSchedule(meeting: Meeting, now = new Date()): MeetingShareSchedule {
  const startsRaw = meeting.scheduled_at ?? meeting.started_at
  if (startsRaw) {
    const start = new Date(startsRaw)
    const end = meeting.scheduled_end_at
      ? new Date(meeting.scheduled_end_at)
      : new Date(start.getTime() + DEFAULT_DURATION_MS)
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start) {
      return { startsAt: start.toISOString(), endsAt: end.toISOString(), inferred: false }
    }
  }

  const start = now
  const end = new Date(now.getTime() + DEFAULT_DURATION_MS)
  return { startsAt: start.toISOString(), endsAt: end.toISOString(), inferred: true }
}

function formatShareDateTime(iso: string, timeZone: string) {
  try {
    return {
      date: new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone,
      }).format(new Date(iso)),
      time: new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
        timeZoneName: 'short',
      }).format(new Date(iso)),
    }
  } catch {
    const date = new Date(iso)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
  }
}

export function buildMeetingCalendarEventInput(meeting: Meeting): CalendarEventInput {
  const schedule = resolveMeetingShareSchedule(meeting)
  const joinUrl = getMeetingShareUrl(meeting.meeting_code)
  const passcode = meeting.security_settings?.passcode
  const description = [
    meeting.description?.trim(),
    `Join ${BRAND_COWORK_LABEL}: ${joinUrl}`,
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
    passcode ? `Passcode: ${passcode}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    title: meeting.title,
    description,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    location: `${BRAND_COWORK_LABEL} · ${formatMeetingCode(meeting.meeting_code)}`,
    url: joinUrl,
    uid: `meeting-${meeting.meeting_code}@sheconomy`,
    attendees:
      meeting.invitees?.flatMap((invitee) => (invitee.email ? [invitee.email] : [])) ?? [],
  }
}

export function buildMeetingCalendarShareLinks(meeting: Meeting) {
  const schedule = resolveMeetingShareSchedule(meeting)
  const joinUrl = getMeetingShareUrl(meeting.meeting_code)
  const passcode = meeting.security_settings?.passcode
  // Keep calendar deeplink query strings short so mailto / WhatsApp stay under URL limits.
  const shortDetails = [
    `Join: ${joinUrl}`,
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
    passcode ? `Passcode: ${passcode}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  const input: CalendarEventInput = {
    title: meeting.title,
    description: shortDetails,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    location: `${BRAND_COWORK_LABEL} · ${formatMeetingCode(meeting.meeting_code)}`,
    url: joinUrl,
    uid: `meeting-${meeting.meeting_code}@sheconomy`,
  }
  const { google, outlook } = buildCalendarLinks(input)
  const start = new Date(input.startsAt)
  const end = new Date(input.endsAt!)
  const yahoo = new URL('https://calendar.yahoo.com/')
  yahoo.searchParams.set('v', '60')
  yahoo.searchParams.set('title', input.title)
  yahoo.searchParams.set(
    'st',
    start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, ''),
  )
  yahoo.searchParams.set(
    'et',
    end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, ''),
  )
  yahoo.searchParams.set('desc', shortDetails)
  if (input.location) yahoo.searchParams.set('in_loc', input.location)
  return { google, outlook, yahoo: yahoo.toString(), event: input }
}

type MeetingInvitationOptions = {
  /** Include the HTTPS join URL in the body (omit when the share layer attaches `url`). */
  includeJoinUrl?: boolean
}

/** Zoom-style invitation block used for social / email / copy invitation. */
export function buildMeetingInvitationText(
  meeting: Meeting,
  options: MeetingInvitationOptions = {},
): string {
  const { includeJoinUrl = true } = options
  const schedule = resolveMeetingShareSchedule(meeting)
  const timeZone = resolveDeviceIanaTimeZone()
  const { date, time } = formatShareDateTime(schedule.startsAt, timeZone)
  const host = meeting.host?.full_name || meeting.host?.username || `${BRAND_NAME} host`
  const joinUrl = getMeetingShareUrl(meeting.meeting_code)
  const passcode = meeting.security_settings?.passcode

  const lines = [
    `${BRAND_COWORK_LABEL} Meeting Invitation`,
    '',
    meeting.title,
    meeting.description?.trim() || null,
    '',
    `Host: ${host}`,
    schedule.inferred ? 'Time: Starting now (approx. 1 hour)' : `Date: ${date}`,
    schedule.inferred ? null : `Time: ${time}`,
    '',
    includeJoinUrl ? `Join ${BRAND_COWORK_LABEL} Meeting` : null,
    includeJoinUrl ? joinUrl : null,
    includeJoinUrl ? '' : null,
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
    passcode ? `Passcode: ${passcode}` : null,
    '',
    'Add to Calendar from the meeting page (Calendar icon).',
    '',
    '—',
    `Shared via ${BRAND_COWORK_LABEL}`,
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}

/**
 * Zoom-style meeting invitation for the share sheet.
 * The share layer appends `url` once for destinations that need a link.
 * Calendar add is via sheet icons — not raw Google/Outlook URLs in the message.
 */
export function buildMeetingSharePayload(meeting: Meeting): SharePayload {
  return {
    url: getMeetingShareUrl(meeting.meeting_code),
    title: `${meeting.title} · ${BRAND_COWORK_LABEL}`,
    text: buildMeetingInvitationText(meeting, { includeJoinUrl: false }),
  }
}

/** ICS contents for Apple Calendar / download / share as attachment. */
export function buildMeetingShareIcs(meeting: Meeting): string {
  const schedule = resolveMeetingShareSchedule(meeting)
  return buildMeetingCalendarEvent({
    title: meeting.title,
    description: meeting.description,
    scheduledAt: schedule.startsAt,
    scheduledEndAt: schedule.endsAt,
    meetingCode: meeting.meeting_code,
    passcode: meeting.security_settings?.passcode,
    attendeeEmails:
      meeting.invitees?.flatMap((invitee) => (invitee.email ? [invitee.email] : [])) ?? [],
  })
}
