import { Platform } from 'react-native'

import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { seedNativeLoaderCache } from '~/lib/bootstrap/native-loader-cache'
import { hydrateAppCache, hydrateAppCacheSync, peekAppCache } from '~/lib/cache/app-cache'

/** Keys that make cold start feel instant when restored from disk. */
export const CRITICAL_APP_CACHE_KEYS = [
  CACHE_KEYS.home,
  CACHE_KEYS.categories,
  CACHE_KEYS.shops,
  CACHE_KEYS.listingFeed('physical'),
  CACHE_KEYS.listingFeed('digital'),
  CACHE_KEYS.listingFeed('trending'),
  `${CACHE_KEYS.community}:recent`,
] as const

let warmed = false

/**
 * Hydrate memory cache from disk and seed native route loaders.
 * Safe to call multiple times; runs once per JS runtime.
 */
export function warmCriticalAppCaches(): void {
  if (warmed) return
  warmed = true

  if (Platform.OS === 'web') {
    hydrateAppCacheSync([...CRITICAL_APP_CACHE_KEYS])
    return
  }

  void hydrateAppCache([...CRITICAL_APP_CACHE_KEYS]).then(() => {
    const home = peekAppCache(CACHE_KEYS.home)
    if (home != null) {
      seedNativeLoaderCache(CACHE_KEYS.home, home)
    }
  })
}
