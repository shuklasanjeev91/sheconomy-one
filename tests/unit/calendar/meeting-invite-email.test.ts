import { describe, expect, it } from 'vitest'

import {
  buildMeetingInviteEmailHtml,
  buildMeetingInviteEmailText,
  formatMeetingIdForEmail,
} from '~/lib/calendar/meeting-invite-email'
import { formatInviteDisplayTime } from '~/lib/calendar/invite-time'

describe('meeting invitation email', () => {
  const base = {
    brandLabel: 'SHEconomy Co-Work',
    meetingTitle: 'Product Planning',
    hostName: 'Asha',
    dateLabel: '15 September 2026',
    timeLabel: '10:00 am IST',
    joinUrl: 'https://sheconomy.in/co-work/meeting/ABC123XYZ',
    meetingIdLabel: 'ABC 123 XYZ',
    passcode: 'SECRET1',
    googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
    outlookCalendarUrl: 'https://outlook.office.com/calendar/0/deeplink/compose',
  }

  it('formats meeting ids like 123 456 789', () => {
    expect(formatMeetingIdForEmail('123456789')).toBe('123 456 789')
    expect(formatMeetingIdForEmail('abc-123')).toBe('ABC 123')
  })

  it('builds the required responsive HTML sections', () => {
    const html = buildMeetingInviteEmailHtml(base)
    expect(html).toContain('SHEconomy Co-Work')
    expect(html).toContain('Product Planning')
    expect(html).toContain('You are invited to a meeting.')
    expect(html).toContain('Date')
    expect(html).toContain('15 September 2026')
    expect(html).toContain('Time')
    expect(html).toContain('10:00 am IST')
    expect(html).toContain('Join Meeting')
    expect(html).toContain('Meeting ID')
    expect(html).toContain('ABC 123 XYZ')
    expect(html).toContain('Passcode')
    expect(html).toContain('SECRET1')
    expect(html).toContain('Add to Calendar')
    expect(html).toContain('Google Calendar')
    expect(html).toContain('Outlook')
    expect(html).toContain('max-width: 600px')
    expect(html).toContain('@media only screen and (max-width: 620px)')
    expect(html).toContain('viewport')
  })

  it('omits passcode when not set and still includes join CTA', () => {
    const html = buildMeetingInviteEmailHtml({ ...base, passcode: null })
    expect(html).not.toContain('>Passcode<')
    expect(html).toContain('Join Meeting')
  })

  it('builds a plain-text body with the same fields', () => {
    const text = buildMeetingInviteEmailText(base)
    expect(text).toContain('SHEconomy Co-Work')
    expect(text).toContain('You are invited to a meeting.')
    expect(text).toContain('Date:')
    expect(text).toContain('15 September 2026')
    expect(text).toContain('Time:')
    expect(text).toContain('10:00 am IST')
    expect(text).toContain('Join Meeting:')
    expect(text).toContain('Meeting ID:')
    expect(text).toContain('Passcode:')
    expect(text).toContain('Add to Calendar:')
  })

  it('splits recipient-local date and time for the email layout', () => {
    const display = formatInviteDisplayTime({
      startsAt: '2026-09-15T04:30:00.000Z',
      inviteeTimeZone: 'Asia/Kolkata',
      locale: 'en-GB',
    })
    expect(display.dateLabel).toMatch(/15/)
    expect(display.dateLabel).toMatch(/September/)
    expect(display.dateLabel).toMatch(/2026/)
    expect(display.timeLabel).toMatch(/10:00/)
  })
})
