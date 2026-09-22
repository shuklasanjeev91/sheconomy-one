/** Silent LiveKit remounts before escalating to the full-page reconnect UI. */
export const MEETING_MEDIA_AUTO_RETRY_LIMIT = 3

/** Ignore disconnect events while a silent remount is wiring up. */
export const MEETING_MEDIA_REMOUNT_GUARD_MS = 2_000

/**
 * How many silent remounts remain before showing "Unable to reconnect".
 * attempt is 0-based (0 = first disconnect after a successful connect).
 */
export function shouldSilentRemountMedia(attempt: number, limit = MEETING_MEDIA_AUTO_RETRY_LIMIT): boolean {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0
  return n < Math.max(1, Math.floor(limit))
}

/** Backoff between LiveKit token fetch attempts (0-based). */
export function meetingLiveKitCredentialRetryDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0
  return Math.min(4_000, 400 * 2 ** n)
}

export const MEETING_LIVEKIT_CREDENTIAL_MAX_ATTEMPTS = 3
