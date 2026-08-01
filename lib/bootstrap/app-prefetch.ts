import { Platform } from 'react-native'

import { fetchClassesBootstrap } from '~/class/lib/classes-loader'
import {
  fetchPublishedProgramsPage,
  PROGRAM_PAGE_SIZE,
} from '~/class/lib/programs'
import { fetchUserChats } from '~/chat/lib/chats'
import { fetchCommunityFeedPage } from '~/community/lib/community'
import { fetchNotifications } from '~/community/lib/notifications'
import { homeLoader } from '~/commerce/lib/home-loader'
import {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  COMMERCE_PAGE_SIZE,
  fetchListingFeedPage,
  fetchShopsBrowsePage,
} from '~/commerce/lib/commerce'
import { prefetchAppCache } from '~/lib/cache/app-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { prefetchNativeLoader, readNativeLoaderCache } from '~/lib/bootstrap/native-loader-cache'
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

  prefetchNativeLoader(CACHE_KEYS.home, homeLoader)
  prefetchAppCache(CACHE_KEYS.categories, async () => {
    const result = await fetchCategoriesPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.community}:recent`, async () => {
    const result = await fetchCommunityFeedPage(0)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })

  // Shops + listing feeds after home/community — less contention on cold start.
  scheduleIdle(() => {
    if (deferredStarted) return
    prefetchAppCache(CACHE_KEYS.shops, async () => {
      const result = await fetchShopsPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE)
      return toPageSnapshot(result.items, 0, result.hasMore)
    })
    for (const kind of ['physical', 'digital', 'trending'] as const) {
      prefetchAppCache(CACHE_KEYS.listingFeed(kind), async () => {
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
  prefetchAppCache(CACHE_KEYS.classesVideo, () => fetchClassesBootstrap('video'))
  prefetchAppCache(CACHE_KEYS.classesAudio, () => fetchClassesBootstrap('audio'))
  prefetchAppCache(`${CACHE_KEYS.classesVideo}:all:all`, async () => {
    const result = await fetchPublishedProgramsPage(0, PROGRAM_PAGE_SIZE, { mediaType: 'video' })
    return toPageSnapshot(result.programs, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.classesAudio}:all:all`, async () => {
    const result = await fetchPublishedProgramsPage(0, PROGRAM_PAGE_SIZE, { mediaType: 'audio' })
    return toPageSnapshot(result.programs, 0, result.hasMore)
  })
}

/** Native cold start — begin fetching after a short delay so home paint wins. */
export function startNativeBootstrapPrefetch(): void {
  if (Platform.OS === 'web') return
  // Avoid flooding the network during the first frames of a cold start.
  setTimeout(() => {
    startCoreTabPrefetch()
  }, 1200)
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
