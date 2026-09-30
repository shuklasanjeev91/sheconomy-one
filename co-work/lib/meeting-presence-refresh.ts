/** Initial join overlay — never flash this on a background realtime heal. */
export const MEETING_PRESENCE_POLL_DEGRADED_MS = 4_000
export const MEETING_PRESENCE_POLL_HEALTHY_MS = 15_000
export const MEETING_PRESENCE_POLL_LARGE_MS = 12_000
export const MEETING_PRESENCE_LARGE_ROOM_THRESHOLD = 40
export const MEETING_PRESENCE_HEAL_BASE_MS = 2_000
export const MEETING_PRESENCE_HEAL_MAX_MS = 20_000

export type MeetingPresencePollMode = 'healthy' | 'degraded'

/** Backoff between automatic realtime channel heals (0-based attempt). */
export function meetingPresenceHealDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0
  const delay = MEETING_PRESENCE_HEAL_BASE_MS * 2 ** n
  return Math.min(MEETING_PRESENCE_HEAL_MAX_MS, delay)
}

export function meetingPresencePollIntervalMs(input: {
  mode: MeetingPresencePollMode
  participantCount: number
}): number {
  if (input.mode === 'degraded') return MEETING_PRESENCE_POLL_DEGRADED_MS
  if (input.participantCount >= MEETING_PRESENCE_LARGE_ROOM_THRESHOLD) {
    return MEETING_PRESENCE_POLL_LARGE_MS
  }
  return MEETING_PRESENCE_POLL_HEALTHY_MS
}

/** Full "Joining meeting…" overlay only on the first participant join. */
export function shouldShowMeetingJoiningOverlay(input: {
  heal: boolean
  hasJoined: boolean
}): boolean {
  return !input.heal && !input.hasJoined
}

/** Stacked connect() calls were aborting in-flight retries and remounting the media room. */
export function shouldSkipStackedPresenceConnect(inFlight: boolean): boolean {
  return inFlight
}

/**
 * Intermediate subscribe timeouts/errors are retried by joinMeetingChannel.
 * Only a disconnect AFTER a successful subscribe should mark realtime degraded
 * (and start auto-heal). Otherwise heal stacks on top of retries.
 */
export function shouldEmitRealtimeDisconnect(input: {
  subscribeSettled: boolean
  status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'JOINING' | string
}): boolean {
  if (input.status === 'SUBSCRIBED' || input.status === 'JOINING') return false
  if (
    input.status === 'CHANNEL_ERROR' ||
    input.status === 'TIMED_OUT' ||
    input.status === 'CLOSED'
  ) {
    return input.subscribeSettled
  }
  return false
}
