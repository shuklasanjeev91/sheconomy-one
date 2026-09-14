import { Platform } from 'react-native'

import type { Meeting } from '~/co-work/lib/types'
import { getMeetingShareUrl } from '~/lib/share'
import { buildMeetingCalendarEvent, shareIcsFile } from '~/lib/calendar/ics'

export type AddMeetingCalendarResult = 'opened' | 'shared' | 'cancelled' | 'failed'

/**
 * Opens the native calendar's pre-filled event editor. The user chooses the
 * calendar and confirms Save; web falls back to downloading an ICS file.
 */
export async function addMeetingToDeviceCalendar(
  meeting: Meeting,
): Promise<AddMeetingCalendarResult> {
  const startsAt = meeting.scheduled_at ?? meeting.started_at
  if (!startsAt) return 'failed'

  if (Platform.OS !== 'web') {
    try {
      const Calendar = await import('expo-calendar')
      const startDate = new Date(startsAt)
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
      const result = await Calendar.createEventInCalendarAsync({
        title: meeting.title,
        notes: [
          meeting.description?.trim(),
          `Meeting ID: ${meeting.meeting_code}`,
          `Join: ${getMeetingShareUrl(meeting.meeting_code)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        location: 'SHEconomy Co-work',
        url: getMeetingShareUrl(meeting.meeting_code),
        startDate,
        endDate,
        timeZone: meeting.time_zone ?? undefined,
      })

      return result.action === 'canceled' ? 'cancelled' : 'opened'
    } catch {
      // Older installed binaries do not include expo-calendar yet.
      // Fall through to the portable ICS share flow.
    }
  }

  const ics = buildMeetingCalendarEvent({
    title: meeting.title,
    description: meeting.description,
    scheduledAt: startsAt,
    meetingCode: meeting.meeting_code,
  })
  const result = await shareIcsFile(ics, `sheconomy-${meeting.meeting_code}.ics`)
  return result === 'shared' ? 'shared' : 'failed'
}
