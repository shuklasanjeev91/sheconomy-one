export type MeetingActivitySignals = {
  name: string
  /** Stable tie-breaker when two people share a display name. */
  id: string
  /** Sticky "current" speaker (stays until someone else talks). */
  activeSpeaker?: boolean
  speaking?: boolean
  micOn?: boolean
  videoOn?: boolean
  /** The local viewer — leads their tier instead of sorting by name. */
  self?: boolean
}

const ACTIVITY_TIERS = ['activeSpeaker', 'speaking', 'micOn', 'videoOn'] as const

export function compareMeetingNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

/**
 * Zoom ordering: whoever is talking, then unmuted, then camera on;
 * everyone inside a tier (and everyone inactive) sorted A→Z by name, with "you" first.
 */
export function compareMeetingActivity(
  left: MeetingActivitySignals,
  right: MeetingActivitySignals,
): number {
  for (const tier of ACTIVITY_TIERS) {
    const leftOn = !!left[tier]
    const rightOn = !!right[tier]
    if (leftOn !== rightOn) return leftOn ? -1 : 1
  }
  if (!!left.self !== !!right.self) return left.self ? -1 : 1
  return compareMeetingNames(left.name, right.name) || compareMeetingNames(left.id, right.id)
}
