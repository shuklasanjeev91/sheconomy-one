/** Detect Zoom-style “you’re trying to speak while muted” nudges. */

export const MEETING_SPEAKING_WHILE_MUTED_LEVEL = 0.18
export const MEETING_SPEAKING_WHILE_MUTED_HOLD_MS = 450

export function shouldShowSpeakingWhileMuted(input: {
  muted: boolean
  inputLevel: number
  /** Ignore while connecting / leaving. */
  enabled?: boolean
}): boolean {
  if (input.enabled === false) return false
  if (!input.muted) return false
  return input.inputLevel >= MEETING_SPEAKING_WHILE_MUTED_LEVEL
}
