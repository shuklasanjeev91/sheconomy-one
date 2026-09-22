import { Linking, Platform } from 'react-native'

import type { Meeting } from '~/co-work/lib/types'
import {
  buildMeetingCalendarShareLinks,
  buildMeetingShareIcs,
  resolveMeetingShareSchedule,
} from '~/co-work/lib/meeting-share'
import { getMeetingShareUrl } from '~/lib/share'
import { shareIcsFile } from '~/lib/calendar/ics'
import { resolveDeviceIanaTimeZone } from '~/lib/calendar/timezone'

export type AddMeetingCalendarResult =
  | 'saved'
  | 'opened'
  | 'shared'
  | 'cancelled'
  | 'failed'

export type WebCalendarFallback = 'ics' | 'google' | 'outlook'

type WritableCalendarCandidate = {
  allowsModifications?: boolean
  isPrimary?: boolean
  source?: { name?: string | null; type?: string | null } | null
}

/** Apple Calendar on iOS/Safari; Google Calendar on Android; Google otherwise. */
export function preferredWebCalendarFallback(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): WebCalendarFallback {
  const ua = userAgent.toLowerCase()
  if (/\boutlook\b/.test(ua)) return 'outlook'
  const appleMobile = /iphone|ipad|ipod/.test(ua)
  const macSafari =
    /macintosh/.test(ua) && /safari/.test(ua) && !/chrome|crios|fxios|edg/.test(ua)
  if (appleMobile || macSafari) return 'ics'
  return 'google'
}

/** Prefer the device’s primary / default calendar app (iCloud, Google, Outlook). */
export function pickDeviceWritableCalendar<T extends WritableCalendarCandidate>(
  calendars: T[],
  platform: string,
): T | undefined {
  const writable = calendars.filter((calendar) => calendar.allowsModifications)
  if (writable.length === 0) return undefined
  const primary = writable.find((calendar) => calendar.isPrimary)
  if (primary) return primary
  const sourceOf = (calendar: T) => `${calendar.source?.name ?? ''} ${calendar.source?.type ?? ''}`
  if (platform === 'ios') {
    return writable.find((calendar) => /icloud|caldav|local/i.test(sourceOf(calendar))) ?? writable[0]
  }
  return (
    writable.find((calendar) => /google/i.test(sourceOf(calendar))) ??
    writable.find((calendar) => /outlook|exchange/i.test(sourceOf(calendar))) ??
    writable[0]
  )
}

/**
 * Prefer saving directly into the device default calendar (Zoom-style).
 * Falls back to the system event editor, then ICS / Google Calendar.
 */
export async function addMeetingToDeviceCalendar(
  meeting: Meeting,
): Promise<AddMeetingCalendarResult> {
  const schedule = resolveMeetingShareSchedule(meeting)
  const passcode = meeting.security_settings?.passcode
  const joinUrl = getMeetingShareUrl(meeting.meeting_code)
  const notes = [
    meeting.description?.trim(),
    `Meeting ID: ${meeting.meeting_code}`,
    passcode ? `Passcode: ${passcode}` : null,
    `Join: ${joinUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const startDate = new Date(schedule.startsAt)
  const endDate = new Date(schedule.endsAt)
  const timeZone = resolveDeviceIanaTimeZone()

  if (Platform.OS !== 'web') {
    try {
      const Calendar = await import('expo-calendar')
      const permission = await Calendar.requestCalendarPermissionsAsync()
      if (permission.status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
        const preferred = pickDeviceWritableCalendar(calendars, Platform.OS)

        if (preferred) {
          await Calendar.createEventAsync(preferred.id, {
            title: meeting.title,
            notes,
            location: 'SHEconomy Co-Work',
            url: joinUrl,
            startDate,
            endDate,
            timeZone,
            alarms: [{ relativeOffset: -10 }],
          })
          return 'saved'
        }
      }

      const result = await Calendar.createEventInCalendarAsync({
        title: meeting.title,
        notes,
        location: 'SHEconomy Co-Work',
        url: joinUrl,
        startDate,
        endDate,
        timeZone,
      })
      return result.action === 'canceled' ? 'cancelled' : 'opened'
    } catch {
      // Older binaries without expo-calendar — fall through.
    }
  }

  // Web / fallback: Apple Calendar via ICS on iOS/Safari, else Google/Outlook.
  const fallback = preferredWebCalendarFallback()
  if (fallback === 'ics') {
    const ics = buildMeetingShareIcs(meeting)
    const result = await shareIcsFile(ics, `sheconomy-${meeting.meeting_code}.ics`)
    if (result === 'shared') return 'shared'
  }

  try {
    const links = buildMeetingCalendarShareLinks(meeting)
    const url = fallback === 'outlook' ? links.outlook : links.google
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (opened) return 'opened'
    } else {
      await Linking.openURL(url)
      return 'opened'
    }
  } catch {
    // continue to ICS
  }

  const ics = buildMeetingShareIcs(meeting)
  const result = await shareIcsFile(ics, `sheconomy-${meeting.meeting_code}.ics`)
  return result === 'shared' ? 'shared' : 'failed'
}

export async function openMeetingCalendarProvider(
  meeting: Meeting,
  provider: 'google' | 'outlook' | 'yahoo',
): Promise<boolean> {
  const links = buildMeetingCalendarShareLinks(meeting)
  const url = links[provider]
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false
    return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
  }
  try {
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

export async function downloadMeetingCalendarIcs(meeting: Meeting): Promise<'shared' | 'failed'> {
  const ics = buildMeetingShareIcs(meeting)
  return shareIcsFile(ics, `sheconomy-${meeting.meeting_code}.ics`)
}
