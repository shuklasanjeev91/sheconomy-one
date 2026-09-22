/**
 * Zoom-style stage focus helpers: host spotlight (room-wide) + local pin.
 */

export const MEETING_MAX_PINNED = 3

export function normalizePinnedIdentities(
  identities: Iterable<string>,
  max = MEETING_MAX_PINNED,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of identities) {
    const next = String(id || '').trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    out.push(next)
    if (out.length >= max) break
  }
  return out
}

export function togglePinnedIdentity(
  current: string[],
  identity: string,
  max = MEETING_MAX_PINNED,
): string[] {
  const id = String(identity || '').trim()
  if (!id) return normalizePinnedIdentities(current, max)
  if (current.includes(id)) return current.filter((row) => row !== id)
  return normalizePinnedIdentities([...current, id], max)
}

/** Effective focus identity: spotlight wins over active speaker. */
export function resolveMeetingFocusIdentity(input: {
  spotlightIdentity?: string | null
  activeSpeakerIdentity?: string | null
}): string | null {
  const spotlight = String(input.spotlightIdentity || '').trim()
  if (spotlight) return spotlight
  const speaker = String(input.activeSpeakerIdentity || '').trim()
  return speaker || null
}
