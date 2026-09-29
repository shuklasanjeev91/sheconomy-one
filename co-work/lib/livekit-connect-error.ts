/**
 * LiveKit room connect failures → user-facing copy.
 *
 * `LiveKitRoom` also reports mic/camera publish failures through `onError`;
 * only `ConnectionError`s mean the room itself is unusable.
 */

/** livekit-client `ConnectionErrorReason.Cancelled` — unmount / leave, not a failure. */
const CONNECTION_REASON_CANCELLED = 3

type ConnectionErrorLike = Error & {
  reason?: number
  status?: number
  context?: { status?: number } | unknown
}

export const LIVEKIT_USAGE_LIMIT_MESSAGE =
  'Video meetings are temporarily unavailable because the meeting service has reached its usage limit. Please try again later.'
export const LIVEKIT_ACCESS_EXPIRED_MESSAGE =
  'Your access to this meeting room expired. Tap Try again to rejoin.'
export const LIVEKIT_UNREACHABLE_MESSAGE =
  'Could not connect to the video service. Check your connection and tap Try again.'

export function isLiveKitRoomConnectError(cause: unknown): cause is ConnectionErrorLike {
  if (!(cause instanceof Error)) return false
  if (cause.name !== 'ConnectionError' && !/no livekit url provided/i.test(cause.message)) {
    return false
  }
  return (cause as ConnectionErrorLike).reason !== CONNECTION_REASON_CANCELLED
}

function statusFromError(cause: ConnectionErrorLike): number | null {
  if (typeof cause.status === 'number') return cause.status
  const context = cause.context as { status?: unknown } | undefined
  return typeof context?.status === 'number' ? context.status : null
}

export function liveKitConnectErrorMessage(input: {
  status?: number | null
  detail?: string | null
}): string {
  const detail = input.detail ?? ''
  if (input.status === 429 || /usage exceeded|quota|limit exceeded/i.test(detail)) {
    return LIVEKIT_USAGE_LIMIT_MESSAGE
  }
  if (input.status === 401 || input.status === 403) {
    return LIVEKIT_ACCESS_EXPIRED_MESSAGE
  }
  return LIVEKIT_UNREACHABLE_MESSAGE
}

/**
 * The websocket upgrade hides the HTTP reason, so ask LiveKit's validate
 * endpoint (the same probe livekit-client uses) when the error has no status.
 */
export async function describeLiveKitConnectError(
  cause: ConnectionErrorLike,
  credentials: { serverUrl: string; token: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const status = statusFromError(cause)
  if (status != null) {
    return liveKitConnectErrorMessage({ status, detail: cause.message })
  }
  try {
    const url = new URL(credentials.serverUrl)
    url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:'
    url.pathname = `${url.pathname.replace(/\/$/, '')}/rtc/validate`
    url.searchParams.set('access_token', credentials.token)
    const response = await fetchImpl(url.toString())
    const detail = await response.text().catch(() => '')
    return liveKitConnectErrorMessage({ status: response.status, detail })
  } catch {
    return liveKitConnectErrorMessage({ detail: cause.message })
  }
}
