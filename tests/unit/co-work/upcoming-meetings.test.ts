import { describe, expect, it } from 'vitest'

import { isUpcomingMeeting } from '~/co-work/lib/meetings'

const NOW = Date.parse('2026-10-09T07:30:00.000Z')

const base = {
  status: 'scheduled' as const,
  scheduled_at: '2026-10-09T09:00:00.000Z',
  scheduled_end_at: null,
  started_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  is_recurring: false,
  repeat: null,
}

describe('isUpcomingMeeting', () => {
  it('keeps future scheduled meetings', () => {
    expect(isUpcomingMeeting(base, NOW)).toBe(true)
  })

  it('drops scheduled meetings from months ago', () => {
    expect(isUpcomingMeeting({ ...base, scheduled_at: '2026-02-24T09:16:00.000Z' }, NOW)).toBe(false)
  })

  it('keeps a scheduled meeting until an hour after its end', () => {
    const meeting = {
      ...base,
      scheduled_at: '2026-10-09T05:30:00.000Z',
      scheduled_end_at: '2026-10-09T06:45:00.000Z',
    }
    expect(isUpcomingMeeting(meeting, NOW)).toBe(true)
    expect(isUpcomingMeeting(meeting, Date.parse('2026-10-09T07:46:00.000Z'))).toBe(false)
  })

  it('drops instant or active meetings that were never ended', () => {
    const stale = { ...base, status: 'instant' as const, scheduled_at: '2026-02-24T09:16:00.000Z' }
    expect(isUpcomingMeeting(stale, NOW)).toBe(false)
    expect(isUpcomingMeeting({ ...stale, status: 'active' as const }, NOW)).toBe(false)
  })

  it('keeps a meeting that went live today', () => {
    const live = {
      ...base,
      status: 'active' as const,
      scheduled_at: null,
      started_at: '2026-10-09T04:00:00.000Z',
    }
    expect(isUpcomingMeeting(live, NOW)).toBe(true)
  })

  it('keeps recurring meetings and drops ended or cancelled ones', () => {
    const old = { ...base, scheduled_at: '2026-02-24T09:16:00.000Z' }
    expect(isUpcomingMeeting({ ...old, is_recurring: true, repeat: 'weekly' as const }, NOW)).toBe(true)
    expect(isUpcomingMeeting({ ...base, status: 'ended' as const }, NOW)).toBe(false)
    expect(isUpcomingMeeting({ ...base, status: 'cancelled' as const }, NOW)).toBe(false)
  })
})
