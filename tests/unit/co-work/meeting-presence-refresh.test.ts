import { describe, expect, it } from 'vitest'

import {
  MEETING_PRESENCE_HEAL_BASE_MS,
  MEETING_PRESENCE_HEAL_MAX_MS,
  MEETING_PRESENCE_POLL_DEGRADED_MS,
  MEETING_PRESENCE_POLL_HEALTHY_MS,
  MEETING_PRESENCE_POLL_LARGE_MS,
  meetingPresenceHealDelayMs,
  meetingPresencePollIntervalMs,
  shouldEmitRealtimeDisconnect,
  shouldShowMeetingJoiningOverlay,
  shouldSkipStackedPresenceConnect,
} from '~/co-work/lib/meeting-presence-refresh'

describe('meeting presence refresh', () => {
  it('backs off auto-heal instead of retrying every few seconds', () => {
    expect(meetingPresenceHealDelayMs(0)).toBe(MEETING_PRESENCE_HEAL_BASE_MS)
    expect(meetingPresenceHealDelayMs(1)).toBe(MEETING_PRESENCE_HEAL_BASE_MS * 2)
    expect(meetingPresenceHealDelayMs(2)).toBe(MEETING_PRESENCE_HEAL_BASE_MS * 4)
    expect(meetingPresenceHealDelayMs(10)).toBe(MEETING_PRESENCE_HEAL_MAX_MS)
    expect(meetingPresenceHealDelayMs(-1)).toBe(MEETING_PRESENCE_HEAL_BASE_MS)
  })

  it('polls slowly while realtime is healthy and faster only when degraded', () => {
    expect(meetingPresencePollIntervalMs({ mode: 'degraded', participantCount: 2 })).toBe(
      MEETING_PRESENCE_POLL_DEGRADED_MS,
    )
    expect(meetingPresencePollIntervalMs({ mode: 'healthy', participantCount: 2 })).toBe(
      MEETING_PRESENCE_POLL_HEALTHY_MS,
    )
    expect(meetingPresencePollIntervalMs({ mode: 'healthy', participantCount: 80 })).toBe(
      MEETING_PRESENCE_POLL_LARGE_MS,
    )
  })

  it('keeps the joining overlay off for background heals after the first join', () => {
    expect(shouldShowMeetingJoiningOverlay({ heal: false, hasJoined: false })).toBe(true)
    expect(shouldShowMeetingJoiningOverlay({ heal: true, hasJoined: true })).toBe(false)
    expect(shouldShowMeetingJoiningOverlay({ heal: false, hasJoined: true })).toBe(false)
  })

  it('refuses stacked connect() while a join is already in flight', () => {
    expect(shouldSkipStackedPresenceConnect(true)).toBe(true)
    expect(shouldSkipStackedPresenceConnect(false)).toBe(false)
  })

  it('does not mark realtime disconnected until a successful subscribe later drops', () => {
    expect(
      shouldEmitRealtimeDisconnect({ subscribeSettled: false, status: 'TIMED_OUT' }),
    ).toBe(false)
    expect(
      shouldEmitRealtimeDisconnect({ subscribeSettled: false, status: 'CHANNEL_ERROR' }),
    ).toBe(false)
    expect(
      shouldEmitRealtimeDisconnect({ subscribeSettled: true, status: 'CLOSED' }),
    ).toBe(true)
    expect(
      shouldEmitRealtimeDisconnect({ subscribeSettled: true, status: 'SUBSCRIBED' }),
    ).toBe(false)
  })
})
