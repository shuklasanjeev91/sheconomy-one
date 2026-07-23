const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

/** Pure helper for unit tests — returns whether an envelope is still fresh. */
export function isDraftFresh(
  updatedAt: string,
  maxAgeMs = DEFAULT_TTL_MS,
  now = Date.now(),
): boolean {
  const ts = Date.parse(updatedAt)
  if (!Number.isFinite(ts)) return false
  return now - ts <= maxAgeMs
}

export { DEFAULT_TTL_MS as DRAFT_DEFAULT_TTL_MS }
