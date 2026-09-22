import { describe, expect, it } from 'vitest'

import {
  pickDeviceWritableCalendar,
  preferredWebCalendarFallback,
} from '~/lib/calendar/device-calendar'

describe('device calendar targeting', () => {
  it('opens Apple Calendar via ICS on iPhone and Mac Safari', () => {
    expect(
      preferredWebCalendarFallback(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ics')
    expect(
      preferredWebCalendarFallback(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe('ics')
  })

  it('opens Google Calendar on Android and Chrome desktop', () => {
    expect(
      preferredWebCalendarFallback(
        'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('google')
    expect(
      preferredWebCalendarFallback(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ),
    ).toBe('google')
  })

  it('opens Outlook when the user agent is Outlook', () => {
    expect(preferredWebCalendarFallback('Mozilla/5.0 Microsoft Outlook 16.0')).toBe('outlook')
  })

  it('prefers the iCloud calendar on iOS and Google on Android', () => {
    const calendars = [
      { id: 'g', allowsModifications: true, source: { name: 'Google' } },
      { id: 'i', allowsModifications: true, source: { name: 'iCloud' } },
      { id: 'ro', allowsModifications: false, source: { name: 'Holidays' } },
    ]
    expect(pickDeviceWritableCalendar(calendars, 'ios')?.id).toBe('i')
    expect(pickDeviceWritableCalendar(calendars, 'android')?.id).toBe('g')
  })

  it('uses the primary calendar when the device marks one', () => {
    const calendars = [
      { id: 'g', allowsModifications: true, isPrimary: false, source: { name: 'Google' } },
      { id: 'p', allowsModifications: true, isPrimary: true, source: { name: 'Local' } },
    ]
    expect(pickDeviceWritableCalendar(calendars, 'android')?.id).toBe('p')
  })
})
