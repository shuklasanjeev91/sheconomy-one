/**
 * Lightweight cross-screen refresh bus.
 *
 * Mutations (create/edit/delete post, listing, event, …) call `invalidateCache`
 * with cache-key prefixes or topic tokens. Screens/hooks that display that data
 * subscribe via `useAutoRefresh` (see useAutoRefresh.ts) and silently
 * revalidate, so users never have to reload a route to see their own changes —
 * on web and native alike.
 */

type Listener = (keys: string[]) => void

const listeners = new Set<Listener>()

/** Notify all subscribers that data behind these keys (or key prefixes) changed. */
export function invalidateCache(...keys: string[]): void {
  if (keys.length === 0) return
  for (const listener of [...listeners]) {
    try {
      listener(keys)
    } catch {
      // One bad subscriber must not break the others.
    }
  }
}

export function subscribeCacheInvalidation(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True when `target` equals an invalidated key or lives under it as a prefix. */
export function cacheKeyMatches(target: string, invalidated: string[]): boolean {
  return invalidated.some((key) => target === key || target.startsWith(`${key}:`))
}

/** Shared invalidation topics for data without a stable cache key. */
export const INVALIDATION_TOPICS = {
  communityPosts: 'community-posts',
  communityEvents: 'community-events',
  communityJobs: 'community-jobs',
  communityGroups: 'community-groups',
  communityCompanies: 'community-companies',
  communityNetwork: 'community-network',
  communityHashtagFollows: 'community-hashtag-follows',
  communityProfileViews: 'community-profile-views',
  savedPosts: 'saved-posts',
  userActivity: 'user-activity',
  commerceListings: 'commerce-listings',
  commerceShops: 'commerce-shops',
  commerceOrders: 'commerce-orders',
  commerceWishlist: 'commerce-wishlist',
} as const
