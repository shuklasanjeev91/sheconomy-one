import { describe, expect, it } from 'vitest'

import { getMeetingAnchorAt, isMeetingJoinable, isWaitingForScheduledStart, canEnterLiveMeeting } from '~/co-work/lib/meetings'

describe('meeting display anchor', () => {
  it('uses scheduled_at, then started_at, then created_at', () => {
    expect(
      getMeetingAnchorAt({
        scheduled_at: '2026-08-07T10:00:00.000Z',
        started_at: '2026-08-07T11:00:00.000Z',
        created_at: '2026-08-06T09:00:00.000Z',
      })?.toISOString(),
    ).toBe('2026-08-07T10:00:00.000Z')

    expect(
      getMeetingAnchorAt({
        scheduled_at: null,
        started_at: '2026-08-07T11:00:00.000Z',
        created_at: '2026-08-06T09:00:00.000Z',
      })?.toISOString(),
    ).toBe('2026-08-07T11:00:00.000Z')

    expect(
      getMeetingAnchorAt({
        scheduled_at: null,
        started_at: null,
        created_at: '2026-08-06T09:00:00.000Z',
      })?.toISOString(),
    ).toBe('2026-08-06T09:00:00.000Z')
  })

  it('returns null when no timestamp is usable', () => {
    expect(getMeetingAnchorAt({ scheduled_at: null, started_at: null, created_at: null })).toBeNull()
    expect(
      getMeetingAnchorAt({ scheduled_at: 'not-a-date', started_at: null, created_at: null }),
    ).toBeNull()
  })
})

describe('meetings stay joinable until the host cancels', () => {
  it('keeps scheduled, instant and active meetings joinable', () => {
    expect(isMeetingJoinable({ status: 'scheduled' })).toBe(true)
    expect(isMeetingJoinable({ status: 'instant' })).toBe(true)
    expect(isMeetingJoinable({ status: 'active' })).toBe(true)
  })

  it('keeps an ended meeting joinable so the host can restart it', () => {
    expect(isMeetingJoinable({ status: 'ended' })).toBe(true)
  })

  it('closes a meeting only once it is cancelled', () => {
    expect(isMeetingJoinable({ status: 'cancelled' })).toBe(false)
  })
})

describe('scheduled meeting wait (Zoom-style)', () => {
  const upcoming = {
    status: 'scheduled' as const,
    scheduled_at: '2026-09-19T10:30:00.000Z',
    started_at: null,
  }
  const now = Date.parse('2026-09-19T07:00:00.000Z')

  it('holds guests until the scheduled start', () => {
    expect(isWaitingForScheduledStart(upcoming, now)).toBe(true)
    expect(canEnterLiveMeeting(upcoming, { isHost: false, now })).toBe(false)
  })

  it('lets the host start early', () => {
    expect(canEnterLiveMeeting(upcoming, { isHost: true, now })).toBe(true)
  })

  it('lets guests join after the start time', () => {
    const later = Date.parse('2026-09-19T10:31:00.000Z')
    expect(isWaitingForScheduledStart(upcoming, later)).toBe(false)
    expect(canEnterLiveMeeting(upcoming, { isHost: false, now: later })).toBe(true)
  })

  it('lets guests join once the host has started', () => {
    expect(
      isWaitingForScheduledStart(
        { ...upcoming, started_at: '2026-09-19T07:05:00.000Z' },
        now,
      ),
    ).toBe(false)
  })
})
