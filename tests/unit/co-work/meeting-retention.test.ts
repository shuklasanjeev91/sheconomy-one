import { describe, expect, it } from 'vitest'

import {
  MEETING_LIST_RETENTION_MS,
  filterMeetingsWithinRetention,
  getMeetingAnchorAt,
  getMeetingRetentionExpiresAt,
  isMeetingPastRetention,
} from '~/co-work/lib/meetings'

describe('meeting list 24h retention', () => {
  const hour = 60 * 60 * 1000

  it('uses scheduled_at, then started_at, then created_at as the display anchor', () => {
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

  it('expires exactly 24 hours after the anchor time', () => {
    const meeting = {
      scheduled_at: '2026-08-07T10:00:00.000Z',
      started_at: null,
      created_at: '2026-08-06T09:00:00.000Z',
    }
    const expiresAt = getMeetingRetentionExpiresAt(meeting)
    expect(expiresAt?.toISOString()).toBe('2026-08-08T10:00:00.000Z')
    expect(MEETING_LIST_RETENTION_MS).toBe(24 * hour)

    const justBefore = Date.parse('2026-08-08T09:59:59.000Z')
    const atExpiry = Date.parse('2026-08-08T10:00:00.000Z')
    expect(isMeetingPastRetention(meeting, justBefore)).toBe(false)
    expect(isMeetingPastRetention(meeting, atExpiry)).toBe(true)
  })

  it('filters meetings that are past retention', () => {
    const now = Date.parse('2026-08-08T12:00:00.000Z')
    const rows = [
      {
        id: 'keep',
        scheduled_at: '2026-08-08T10:00:00.000Z',
        started_at: null,
        created_at: null,
      },
      {
        id: 'drop',
        scheduled_at: '2026-08-07T10:00:00.000Z',
        started_at: null,
        created_at: null,
      },
    ]

    expect(filterMeetingsWithinRetention(rows, now).map((row) => row.id)).toEqual(['keep'])
  })
})
