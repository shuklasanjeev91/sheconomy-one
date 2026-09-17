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
        const writable = calendars.filter((calendar) => calendar.allowsModifications)
        const preferred =
          writable.find((calendar) => calendar.isPrimary) ||
          writable.find((calendar) => /icloud|google|outlook|exchange|local/i.test(calendar.source?.name || '')) ||
          writable[0]

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

  // Web / fallback: open Google Calendar template (most common default), then ICS.
  try {
    const { google } = buildMeetingCalendarShareLinks(meeting)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const opened = window.open(google, '_blank', 'noopener,noreferrer')
      if (opened) return 'opened'
    } else {
      await Linking.openURL(google)
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
