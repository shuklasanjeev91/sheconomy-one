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
  fetchShopsBrowsePage,
} from '~/commerce/lib/commerce'
import { prefetchAppCache } from '~/lib/cache/app-cache'
import { prefetchNativeLoader, readNativeLoaderCache } from '~/lib/bootstrap/native-loader-cache'
import { fetchCategoriesPage, fetchShopsPage } from '~/lib/supabase/commerce'

export const CACHE_KEYS = {
  home: 'route:home',
  categories: 'feed:categories',
  shops: 'feed:shops',
  community: 'feed:community',
  shopsBrowse: 'route:shops-browse',
  classesVideo: 'route:classes:video',
  classesAudio: 'route:classes:audio',
  chatList: (userId: string) => `chat:list:${userId}`,
  notifications: (userId: string) => `route:notifications:${userId}`,
} as const

let coreStarted = false

function scheduleIdle(run: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const w = window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
        if (typeof w.requestIdleCallback === 'function') {
          w.requestIdleCallback(run, { timeout: 2500 })
          return
        }
      }
      setTimeout(run, 300)
    })
    return
  }
  setTimeout(run, 300)
}

function toPageSnapshot<T>(items: T[], page: number, hasMore: boolean) {
  return { items, page, hasMore }
}

/** Warm in-memory + disk caches for primary tabs (first page only). */
export function startCoreTabPrefetch(): void {
  if (coreStarted) return
  coreStarted = true

  prefetchNativeLoader(CACHE_KEYS.home, homeLoader)
  prefetchAppCache(CACHE_KEYS.categories, async () => {
    const result = await fetchCategoriesPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(CACHE_KEYS.shops, async () => {
    const result = await fetchShopsPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.community}:recent`, async () => {
    const result = await fetchCommunityFeedPage(0)
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.shopsBrowse}:rating_high:all`, async () => {
    const result = await fetchShopsBrowsePage(0, COMMERCE_PAGE_SIZE, { sort: 'rating_high' })
    return toPageSnapshot(result.items, 0, result.hasMore)
  })
  // Featured + categories meta for class shell; list itself uses paginated keys below.
  prefetchAppCache(CACHE_KEYS.classesVideo, () => fetchClassesBootstrap('video'))
  prefetchAppCache(CACHE_KEYS.classesAudio, () => fetchClassesBootstrap('audio'))
  prefetchAppCache(`${CACHE_KEYS.classesVideo}:all:all:default`, async () => {
    const result = await fetchPublishedProgramsPage(0, PROGRAM_PAGE_SIZE, { mediaType: 'video' })
    return toPageSnapshot(result.programs, 0, result.hasMore)
  })
  prefetchAppCache(`${CACHE_KEYS.classesAudio}:all:all:default`, async () => {
    const result = await fetchPublishedProgramsPage(0, PROGRAM_PAGE_SIZE, { mediaType: 'audio' })
    return toPageSnapshot(result.programs, 0, result.hasMore)
  })
}

/** Native cold start — begin fetching before React mounts. */
export function startNativeBootstrapPrefetch(): void {
  if (Platform.OS === 'web') return
  startCoreTabPrefetch()
}

/** After first paint, warm remaining tab caches and user-scoped data. */
export function scheduleAppBootstrapPrefetch(userId?: string | null): () => void {
  let cancelled = false

  scheduleIdle(() => {
    if (cancelled) return
    startCoreTabPrefetch()
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
  }
}

export function readHomeLoaderCache() {
  return readNativeLoaderCache(CACHE_KEYS.home)
}
