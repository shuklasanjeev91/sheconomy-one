import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key)
    }),
  },
}))

import {
  consumePendingMeetingJoin,
  meetingAutoJoinFromIncomingUrl,
  meetingAutoJoinFromPath,
  PENDING_MEETING_JOIN_MAX_AGE_MS,
  savePendingMeetingJoinFromUrl,
} from '~/co-work/lib/pending-meeting-join'

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

describe('meetingAutoJoinFromPath', () => {
  it('converts co-work meeting lobby links to the live auto-join route', () => {
    expect(meetingAutoJoinFromPath('/co-work/meeting/ABC123')?.path).toBe(
      '/co-work/meeting/ABC123/live',
    )
  })

  it('supports legacy cowork links and preserves query strings', () => {
    expect(meetingAutoJoinFromPath('/cowork/meeting/team-9?invite=1')?.path).toBe(
      '/co-work/meeting/team-9/live?invite=1',
    )
  })

  it('does not resume ended or unrelated links', () => {
    expect(meetingAutoJoinFromPath('/co-work/meeting/ABC123/ended')).toBeNull()
    expect(meetingAutoJoinFromPath('/community/network')).toBeNull()
  })
})

describe('meetingAutoJoinFromIncomingUrl', () => {
  it('extracts brand universal links into the live meeting route', () => {
    expect(
      meetingAutoJoinFromIncomingUrl('https://www.sheconomy.in/cowork/meeting/ABC123?from=sms')
        ?.path,
    ).toBe('/co-work/meeting/ABC123/live?from=sms')
  })
})

describe('pending meeting join storage', () => {
  it('saves a meeting link and consumes it once', async () => {
    await expect(
      savePendingMeetingJoinFromUrl('sheconomy://co-work/meeting/ABC123'),
    ).resolves.toBe(true)

    await expect(consumePendingMeetingJoin()).resolves.toMatchObject({
      path: '/co-work/meeting/ABC123/live',
      code: 'ABC123',
    })
    await expect(consumePendingMeetingJoin()).resolves.toBeNull()
  })

  it('drops stale pending joins', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    await savePendingMeetingJoinFromUrl('sheconomy://co-work/meeting/ABC123')

    await expect(
      consumePendingMeetingJoin(1_000_000 + PENDING_MEETING_JOIN_MAX_AGE_MS + 1),
    ).resolves.toBeNull()
  })
})
