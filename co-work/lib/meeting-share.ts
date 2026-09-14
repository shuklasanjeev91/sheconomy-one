import type { SharePayload } from '~/lib/share'
import { getMeetingShareUrl } from '~/lib/share'

import type { Meeting } from '~/co-work/lib/types'

function formatMeetingCode(code: string): string {
  const clean = code.replace(/\s/g, '').toUpperCase()
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`.trim()
}

function meetingDateTime(meeting: Meeting): { date: string; time: string } {
  const raw = meeting.scheduled_at ?? meeting.started_at
  if (!raw) return { date: 'To be announced', time: 'To be announced' }

  const date = new Date(raw)
  const options = { timeZone: meeting.time_zone ?? undefined }
  try {
    return {
      date: new Intl.DateTimeFormat(undefined, {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date),
      time: new Intl.DateTimeFormat(undefined, {
        ...options,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date),
    }
  } catch {
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
  }
}

/** Zoom-style meeting invitation. The URL is appended once by the share layer. */
export function buildMeetingSharePayload(meeting: Meeting): SharePayload {
  const { date, time } = meetingDateTime(meeting)
  const host = meeting.host?.full_name || meeting.host?.username || 'SHEconomy member'
  const lines = [
    meeting.title,
    meeting.description?.trim() || null,
    '',
    `Date: ${date}`,
    `Time: ${time}`,
    `Host: ${host}`,
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
  ].filter((line): line is string => line !== null)

  return {
    url: getMeetingShareUrl(meeting.meeting_code),
    title: meeting.title,
    text: lines.join('\n'),
  }
}
