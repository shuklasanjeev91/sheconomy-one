import { describe, expect, it } from 'vitest'

import { buildCalendarLinks, buildIcsEvent, buildMeetingCalendarEvent } from '~/lib/calendar/ics'
import {
  formatInviteDisplayTime,
  resolveInviteDisplayTimeZone,
} from '~/lib/calendar/invite-time'
import {
  assertUtcIso,
  formatMeetingInstantForViewer,
  formatZonedDateTime,
  getZonedWallTime,
  isValidIanaTimeZone,
  normalizeIanaTimeZone,
  rebaseUtcIsoWallClock,
  zonedWallTimeToUtcIso,
} from '~/lib/calendar/timezone'

describe('meeting scheduling timezone helpers', () => {
  it('accepts IANA zones and rejects abbreviations and invalid values', () => {
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidIanaTimeZone('America/New_York')).toBe(true)
    expect(isValidIanaTimeZone('Etc/UTC')).toBe(true)
    expect(isValidIanaTimeZone('UTC')).toBe(true) // normalized to Etc/UTC
    expect(normalizeIanaTimeZone('UTC')).toBe('Etc/UTC')
    expect(isValidIanaTimeZone('IST')).toBe(false)
    expect(isValidIanaTimeZone('Mars/Olympus')).toBe(false)
  })

  it('normalizes instants to canonical UTC ISO and formats in the selected zone', () => {
    expect(assertUtcIso('2026-09-15T10:00:00+05:30')).toBe('2026-09-15T04:30:00.000Z')
    expect(formatZonedDateTime('2026-09-15T04:30:00Z', 'Asia/Kolkata', 'en-IN')).toContain('10:00')
  })

  it('converts wall clock in host timezone to one UTC instant', () => {
    const utc = zonedWallTimeToUtcIso(
      { year: 2026, month: 9, day: 15, hour: 10, minute: 0 },
      'Asia/Kolkata',
    )
    expect(utc).toBe('2026-09-15T04:30:00.000Z')

    const eastern = getZonedWallTime(utc, 'America/New_York')
    expect(eastern).toMatchObject({
      year: 2026,
      month: 9,
      day: 15,
      hour: 0,
      minute: 30,
    })

    expect(
      formatMeetingInstantForViewer(utc, {
        timeZone: 'Asia/Kolkata',
        locale: 'en-IN',
        withTimeZoneName: true,
      }),
    ).toMatch(/10:00/)

    expect(
      formatMeetingInstantForViewer(utc, {
        timeZone: 'America/New_York',
        locale: 'en-US',
        withTimeZoneName: true,
      }),
    ).toMatch(/12:30/)
  })

  it('keeps the wall clock when rebasing between timezones', () => {
    const istInstant = zonedWallTimeToUtcIso(
      { year: 2026, month: 9, day: 15, hour: 10, minute: 0 },
      'Asia/Kolkata',
    )
    const easternInstant = rebaseUtcIsoWallClock(
      istInstant,
      'Asia/Kolkata',
      'America/New_York',
    )
    expect(easternInstant).toBe('2026-09-15T14:00:00.000Z')
    expect(getZonedWallTime(easternInstant, 'America/New_York')).toMatchObject({
      hour: 10,
      minute: 0,
    })
  })
})

describe('invite email recipient timezone', () => {
  const utcInstant = '2026-09-15T04:30:00.000Z'

  it('never treats the host timezone as the recipient timezone', () => {
    expect(resolveInviteDisplayTimeZone({}).timeZone).toBe('Etc/UTC')
    expect(resolveInviteDisplayTimeZone({}).source).toBe('utc')

    const display = formatInviteDisplayTime({
      startsAt: utcInstant,
      hostTimeZone: 'Asia/Kolkata',
      profileTimeZone: 'America/New_York',
      locale: 'en-US',
    })
    expect(display.timeZone).toBe('America/New_York')
    expect(display.source).toBe('profile')
    expect(display.whenLabel).toMatch(/12:30/)
    expect(display.hostZoneHint).toContain('Asia/Kolkata')
  })

  it('prefers an explicit invitee timezone over profile', () => {
    const display = formatInviteDisplayTime({
      startsAt: utcInstant,
      inviteeTimeZone: 'Europe/London',
      profileTimeZone: 'America/New_York',
      hostTimeZone: 'Asia/Kolkata',
      locale: 'en-GB',
    })
    expect(display.timeZone).toBe('Europe/London')
    expect(display.source).toBe('invitee')
  })
})

describe('calendar ICS fallback', () => {
  it('uses explicit UTC start/end, attendees, escaping, and folded lines', () => {
    const ics = buildIcsEvent({
      title: 'Planning, review',
      description: `Agenda; details ${'long '.repeat(30)}`,
      startsAt: '2026-09-15T04:30:00Z',
      endsAt: '2026-09-15T05:45:00Z',
      attendees: ['guest@example.com'],
      url: 'https://sheconomy.in/co-work/meeting/ABC123',
    })
    expect(ics).toContain('DTSTART:20260915T043000Z')
    expect(ics).toContain('DTEND:20260915T054500Z')
    expect(ics).toContain('SUMMARY:Planning\\, review')
    expect(ics).toContain('ATTENDEE;RSVP=TRUE:mailto:guest@example.com')
    expect(ics).toContain('\r\n ')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('includes join link, meeting id, and passcode in meeting ICS', () => {
    const ics = buildMeetingCalendarEvent({
      title: 'Team sync',
      description: 'Agenda',
      scheduledAt: '2026-09-15T04:30:00Z',
      scheduledEndAt: '2026-09-15T05:30:00Z',
      meetingCode: 'ABCD1234',
      passcode: 'secret',
      attendeeEmails: ['guest@example.com'],
    })
    expect(ics).toContain('DTSTART:20260915T043000Z')
    expect(ics).toContain('Meeting code: ABCD1234')
    expect(ics).toContain('Passcode: secret')
    expect(ics).toContain('Join:')
  })

  it('creates provider fallback links with the explicit range', () => {
    const links = buildCalendarLinks({
      title: 'Co-Work',
      startsAt: '2026-09-15T04:30:00Z',
      endsAt: '2026-09-15T05:30:00Z',
    })
    expect(links.google).toContain('calendar.google.com')
    expect(links.google).toContain('20260915T043000Z')
    expect(links.outlook).toContain('outlook.office.com')
  })

  it('rejects an end before the start', () => {
    expect(() =>
      buildIcsEvent({
        title: 'Invalid',
        startsAt: '2026-09-15T05:30:00Z',
        endsAt: '2026-09-15T04:30:00Z',
      }),
    ).toThrow(/end time after/)
  })
})
