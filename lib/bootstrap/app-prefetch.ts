import { Platform } from 'react-native'

import { fetchClassesBootstrap } from '~/class/lib/classes-loader'
import { seedClassesPaginatedFromBootstrap } from '~/class/lib/classes-bootstrap-cache'
import { fetchUserChats } from '~/chat/lib/chats'
import { fetchMyMeetings } from '~/co-work/lib/meetings'
import { fetchCommunityFeedPage } from '~/community/lib/community'
import { fetchNotifications } from '~/community/lib/notifications'
import { homeLoader } from '~/commerce/lib/home-loader'
import {
  CATEGORY_RAIL_PAGE_SIZE,
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  COMMERCE_PAGE_SIZE,
  fetchListingFeedPage,
  fetchShopsBrowsePage,
} from '~/commerce/lib/commerce'
import { peekAppCache, prefetchAppCache, hydrateAppCache } from '~/lib/cache/app-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { prefetchNativeLoader, readNativeLoaderCache } from '~/lib/bootstrap/native-loader-cache'
import { CRITICAL_APP_CACHE_KEYS, warmCriticalAppCaches } from '~/lib/bootstrap/warm-app-cache'
import { fetchCategoriesPage, fetchShopsPage } from '~/lib/supabase/commerce'
import { scheduleIdle } from '~/lib/schedule-idle'

export { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'

let coreStarted = false
let deferredStarted = false

function toPageSnapshot<T>(items: T[], page: number, hasMore: boolean) {
  return { items, page, hasMore }
}

/** Critical path: home + community first paint. */
export function startCoreTabPrefetch(): void {
  if (coreStarted) return
  coreStarted = true

  // Disk → memory (and native loader seed) before network storms.
  warmCriticalAppCaches()

  prefetchNativeLoader(CACHE_KEYS.home, homeLoader)
  prefetchAppCache(CACHE_KEYS.categories, async () => {
    const result = await fetchCategoriesPage(0, CATEGORY_RAIL_PAGE_SIZE)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.community}:recent`, async () => {
    const result = await fetchCommunityFeedPage(0)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })

  // Shops + core listing feeds are seeded by homeLoader — only prefetch gaps.
  scheduleIdle(() => {
    if (deferredStarted) return
    if (!peekAppCache(CACHE_KEYS.shops)) {
      prefetchAppCache(CACHE_KEYS.shops, async () => {
        const result = await fetchShopsPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE)
        return toPageSnapshot(result.items, 0, result.hasMore)
      })
    }
    for (const kind of ['physical', 'digital', 'trending'] as const) {
      const key = CACHE_KEYS.listingFeed(kind)
      if (peekAppCache(key)) continue
      prefetchAppCache(key, async () => {
        const result = await fetchListingFeedPage(kind, 0)
        return toPageSnapshot(result.items, 0, result.hasMore)
      })
    }
    for (const kind of ['featured', 'latest'] as const) {
      const key = CACHE_KEYS.listingFeed(kind)
      if (peekAppCache(key)) continue
      prefetchAppCache(key, async () => {
        const result = await fetchListingFeedPage(kind, 0)
        return toPageSnapshot(result.items, 0, result.hasMore)
      })
    }
    startDeferredTabPrefetch()
  })
}

/** Lower priority: shops browse + class shells (after first paint / idle). */
export function startDeferredTabPrefetch(): void {
  if (deferredStarted) return
  deferredStarted = true

  prefetchAppCache(`${CACHE_KEYS.shopsBrowse}:rating_high:all`, async () => {
    const result = await fetchShopsBrowsePage(0, COMMERCE_PAGE_SIZE, { sort: 'rating_high' })
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(CACHE_KEYS.classesVideo, async () => {
    const bootstrap = await fetchClassesBootstrap('video')
    await seedClassesPaginatedFromBootstrap('video', bootstrap)
    return bootstrap
  })
  prefetchAppCache(CACHE_KEYS.classesAudio, async () => {
    const bootstrap = await fetchClassesBootstrap('audio')
    await seedClassesPaginatedFromBootstrap('audio', bootstrap)
    return bootstrap
  })
}

/** Native cold start — prefetch after disk hydrate completes. */
export function startNativeBootstrapPrefetch(): void {
  if (Platform.OS === 'web') return
  void hydrateAppCache([...CRITICAL_APP_CACHE_KEYS]).finally(() => {
    startCoreTabPrefetch()
  })
}

/** After first paint, warm remaining tab caches and user-scoped data. */
export function scheduleAppBootstrapPrefetch(userId?: string | null): () => void {
  let cancelled = false

  const cancelIdle = scheduleIdle(() => {
    if (cancelled) return
    startCoreTabPrefetch()
    startDeferredTabPrefetch()
    if (userId) {
      prefetchAppCache(CACHE_KEYS.chatList(userId), async () => {
        const { items, error } = await fetchUserChats(userId)
        return { items, error }
      })
      prefetchAppCache(CACHE_KEYS.coWorkMyMeetings(userId), () => fetchMyMeetings(userId))
      prefetchAppCache(CACHE_KEYS.notifications(userId), async () => {
        const result = await fetchNotifications(userId, 0)
        return {
          items: result.items,
          hasMore: result.hasMore,
          error: result.error ?? null,
        }
      })
    }
  })

  return () => {
    cancelled = true
    cancelIdle()
  }
}

export function readHomeLoaderCache() {
  return readNativeLoaderCache(CACHE_KEYS.home)
}
