import { Platform } from 'react-native'

import { peekAppCacheAgeMs } from '~/lib/cache/app-cache'

/** Skip network revalidation when the same feed was fetched this recently. */
export const FEED_FRESH_MS = Platform.OS === 'web' ? 45_000 : 60_000

const feedFetchedAt = new Map<string, number>()

function isFeedCacheKey(key: string): boolean {
  return key.startsWith('feed:') || key.startsWith('route:')
}

/** Mark a feed/route cache key as freshly fetched (prefetch, writeAppCache, or hook). */
export function markFeedFresh(key: string): void {
  if (!isFeedCacheKey(key)) return
  feedFetchedAt.set(key, Date.now())
}

/** True when feedFetchedAt or disk/memory cache age is within the freshness window. */
export function isFeedFresh(key: string, freshMs = FEED_FRESH_MS): boolean {
  const fetchedAt = feedFetchedAt.get(key) ?? 0
  if (fetchedAt > 0 && Date.now() - fetchedAt < freshMs) return true

  const ageMs = peekAppCacheAgeMs(key)
  if (ageMs != null && ageMs < freshMs) {
    feedFetchedAt.set(key, Date.now() - ageMs)
    return true
  }
  return false
}
