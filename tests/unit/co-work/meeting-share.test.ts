import { describe, expect, it } from 'vitest'

import {
  buildMeetingCalendarShareLinks,
  buildMeetingInvitationText,
  buildMeetingSharePayload,
  resolveMeetingShareSchedule,
} from '~/co-work/lib/meeting-share'
import type { Meeting } from '~/co-work/lib/types'
import { buildShareTargetUrl } from '~/lib/share/actions'

const meeting: Meeting = {
  id: 'meeting-1',
  title: 'Founder planning session',
  description: 'Review the launch plan and next steps.',
  meeting_code: 'VACLLMWGO',
  host_id: 'host-1',
  status: 'scheduled',
  scheduled_at: '2026-09-14T10:30:00.000Z',
  scheduled_end_at: '2026-09-14T11:30:00.000Z',
  started_at: null,
  ended_at: null,
  time_zone: 'Asia/Kolkata',
  max_participants: 20,
  room_id: 'room-1',
  security_settings: { passcode: '482910' },
  meeting_options: null,
  created_at: '2026-09-12T05:00:00.000Z',
  host: {
    full_name: 'Sanjeev Shukla',
    username: 'sanjeev',
    avatar_url: null,
  },
}

describe('meeting sharing', () => {
  it('includes Zoom-style details and passcode without raw calendar URLs', () => {
    const payload = buildMeetingSharePayload(meeting)
    const whatsappMessage = decodeURIComponent(
      buildShareTargetUrl('whatsapp', payload).split('?text=')[1] ?? '',
    )

    expect(whatsappMessage).toContain('Founder planning session')
    expect(whatsappMessage).toContain('Review the launch plan and next steps.')
    expect(whatsappMessage).toContain('Date:')
    expect(whatsappMessage).toContain('Time:')
    expect(whatsappMessage).toContain('Host: Sanjeev Shukla')
    expect(whatsappMessage).toContain('Meeting ID: VAC LLM WGO')
    expect(whatsappMessage).toContain('Passcode: 482910')
    expect(whatsappMessage).toContain('Add to Calendar from the meeting page')
    expect(whatsappMessage).not.toContain('Google Calendar:')
    expect(whatsappMessage).not.toContain('calendar.google.com')
    expect(whatsappMessage).not.toContain('outlook.office.com')
    expect(whatsappMessage).toContain('https://www.sheconomy.in/co-work/meeting/VACLLMWGO')
  })

  it('builds Google and Outlook calendar deeplinks', () => {
    const links = buildMeetingCalendarShareLinks(meeting)
    expect(links.google).toContain('calendar.google.com')
    expect(links.outlook).toContain('outlook.office.com')
    expect(links.yahoo).toContain('calendar.yahoo.com')
    expect(links.event.title).toBe('Founder planning session')
  })

  it('infers a one-hour window for live meetings without a schedule', () => {
    const live: Meeting = {
      ...meeting,
      scheduled_at: null,
      scheduled_end_at: null,
      started_at: null,
      status: 'live',
    }
    const schedule = resolveMeetingShareSchedule(live, new Date('2026-09-16T12:00:00.000Z'))
    expect(schedule.inferred).toBe(true)
    expect(schedule.startsAt).toBe('2026-09-16T12:00:00.000Z')
    expect(schedule.endsAt).toBe('2026-09-16T13:00:00.000Z')
  })

  it('copies a full invitation block with join URL for paste into any chat', () => {
    const text = buildMeetingInvitationText(meeting)
    expect(text).toContain('SHEconomy Co-Work Meeting Invitation')
    expect(text).toContain('Join SHEconomy Co-Work Meeting')
    expect(text).toContain('https://www.sheconomy.in/co-work/meeting/VACLLMWGO')
    expect(text).toContain('Passcode: 482910')
    expect(text).not.toContain('calendar.google.com')
  })
})
