import { getMeetingShareUrl } from '~/lib/share'
import { shareBlob } from '~/lib/platform/shareBlob'

export type CalendarEventInput = {
  title: string
  description?: string | null
  /** ISO start time */
  startsAt: string
  /** Duration minutes; default 60 */
  durationMinutes?: number
  /** Explicit ISO end time takes precedence over duration. */
  endsAt?: string
  location?: string | null
  url?: string | null
  uid?: string
  attendees?: string[]
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toIcsUtc(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function escapeIcs(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldIcsLine(line: string) {
  const chunks: string[] = []
  let remaining = line
  while (new TextEncoder().encode(remaining).length > 75) {
    let cut = Math.min(73, remaining.length)
    while (cut > 1 && new TextEncoder().encode(remaining.slice(0, cut)).length > 73) cut -= 1
    chunks.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut)
  }
  chunks.push(remaining)
  return chunks.join('\r\n ')
}

/** Build a VEVENT ICS payload for calendar apps (web + native). */
export function buildIcsEvent(input: CalendarEventInput): string {
  const start = new Date(input.startsAt)
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error('Calendar event requires a valid end time after its start time')
  }
  const uid = input.uid ?? `${start.getTime()}@sheconomy`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SHEconomy//Co-Work//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
  ]
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcs(input.description.trim())}`)
  }
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcs(input.location.trim())}`)
  }
  if (input.url?.trim()) {
    lines.push(`URL:${input.url.trim()}`)
  }
  for (const attendee of input.attendees ?? []) {
    const email = attendee.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`)
    }
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

export function buildMeetingCalendarEvent(input: {
  title: string
  description?: string | null
  scheduledAt: string
  scheduledEndAt?: string | null
  meetingCode: string
  passcode?: string | null
  attendeeEmails?: string[]
  durationMinutes?: number
}) {
  const joinUrl = getMeetingShareUrl(input.meetingCode)
  const description = [
    input.description?.trim(),
    `Join: ${joinUrl}`,
    `Meeting code: ${input.meetingCode}`,
    input.passcode?.trim() ? `Passcode: ${input.passcode.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  return buildIcsEvent({
    title: input.title,
    description,
    startsAt: input.scheduledAt,
    endsAt: input.scheduledEndAt ?? undefined,
    durationMinutes: input.durationMinutes ?? 60,
    location: `Co-Work ${input.meetingCode}`,
    url: joinUrl,
    uid: `meeting-${input.meetingCode}@sheconomy`,
    attendees: input.attendeeEmails,
  })
}

export function buildCalendarLinks(input: CalendarEventInput) {
  const start = new Date(input.startsAt)
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000)
  const dates = `${toIcsUtc(start)}/${toIcsUtc(end)}`
  const details = [input.description, input.url].filter(Boolean).join('\n\n')
  const google = new URL('https://calendar.google.com/calendar/render')
  google.searchParams.set('action', 'TEMPLATE')
  google.searchParams.set('text', input.title)
  google.searchParams.set('dates', dates)
  google.searchParams.set('details', details)
  if (input.location) google.searchParams.set('location', input.location)

  const outlook = new URL('https://outlook.office.com/calendar/0/deeplink/compose')
  outlook.searchParams.set('path', '/calendar/action/compose')
  outlook.searchParams.set('rru', 'addevent')
  outlook.searchParams.set('subject', input.title)
  outlook.searchParams.set('startdt', start.toISOString())
  outlook.searchParams.set('enddt', end.toISOString())
  outlook.searchParams.set('body', details)
  if (input.location) outlook.searchParams.set('location', input.location)
  return { google: google.toString(), outlook: outlook.toString() }
}

/** Download / share an ICS file on web, iOS, and Android. */
export async function shareIcsFile(
  ics: string,
  filename = 'sheconomy-event.ics',
): Promise<'shared' | 'failed'> {
  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    await shareBlob(blob, filename, 'text/calendar')
    return 'shared'
  } catch {
    return 'failed'
  }
}
