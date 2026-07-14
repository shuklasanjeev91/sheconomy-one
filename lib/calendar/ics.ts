import { getMeetingShareUrl } from '~/lib/share'
import { shareBlob } from '~/lib/platform/shareBlob'

export type CalendarEventInput = {
  title: string
  description?: string | null
  /** ISO start time */
  startsAt: string
  /** Duration minutes; default 60 */
  durationMinutes?: number
  location?: string | null
  url?: string | null
  uid?: string
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

/** Build a VEVENT ICS payload for calendar apps (web + native). */
export function buildIcsEvent(input: CalendarEventInput): string {
  const start = new Date(input.startsAt)
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000)
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
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function buildMeetingCalendarEvent(input: {
  title: string
  description?: string | null
  scheduledAt: string
  meetingCode: string
  durationMinutes?: number
}) {
  return buildIcsEvent({
    title: input.title,
    description: input.description,
    startsAt: input.scheduledAt,
    durationMinutes: input.durationMinutes ?? 60,
    location: `Co-Work ${input.meetingCode}`,
    url: getMeetingShareUrl(input.meetingCode),
    uid: `meeting-${input.meetingCode}@sheconomy`,
  })
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
