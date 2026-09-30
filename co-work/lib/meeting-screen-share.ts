export type ScreenShareStartOptions = {
  /** Web: ask the browser to capture tab / system audio alongside the picture. */
  shareComputerSound?: boolean
  /** Prefer motion (video clips) over sharp detail (slides, code). */
  optimizeForVideo?: boolean
}

/** The user backed out of the system share picker; nothing to report. */
export class ScreenShareCancelledError extends Error {
  constructor() {
    super('Screen share was cancelled.')
    this.name = 'ScreenShareCancelledError'
  }
}

/**
 * Closing the share picker is not a failure (Zoom just stays put). Browsers report
 * it as AbortError or a bare NotAllowedError; an OS-level block ("denied by
 * system", macOS Screen Recording off) still needs the permission message.
 */
export function isScreenShareCancellation(cause: unknown): boolean {
  if (cause instanceof ScreenShareCancelledError) return true
  const name = cause instanceof Error ? cause.name : ''
  const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  if (name === 'AbortError' || /\b(cancell?ed|AbortError)\b/i.test(message)) return true
  return name === 'NotAllowedError' && !/system/i.test(message)
}
