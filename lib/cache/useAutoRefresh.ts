import { useEffect, useRef } from 'react'
import { useFocusEffect } from 'one'

import { cacheKeyMatches, subscribeCacheInvalidation } from '~/lib/cache/invalidation'

type WatchKeys = string | Array<string | null | undefined> | null | undefined

function normalizeKeys(watch: WatchKeys): string[] {
  if (!watch) return []
  const list = Array.isArray(watch) ? watch : [watch]
  return list.filter((key): key is string => !!key)
}

/**
 * Silently re-runs `refresh` when:
 * 1. a matching cache key is invalidated by a mutation anywhere in the app, or
 * 2. an invalidation arrived while this screen was blurred (flush on focus).
 *
 * Important: do NOT refresh on every useFocusEffect re-subscribe. One's
 * navigation object identity can change across re-renders; refreshing then
 * caused setState loops and hook crashes (e.g. Class Audio tab).
 */
export function useAutoRefresh(watch: WatchKeys, refresh: () => void): void {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const keysRef = useRef<string[]>([])
  keysRef.current = normalizeKeys(watch)

  // Outside a navigator focus events never fire, so default to "focused".
  const focusedRef = useRef(true)
  const pendingRef = useRef(false)

  useEffect(() => {
    return subscribeCacheInvalidation((invalidated) => {
      if (keysRef.current.length === 0) return
      if (!keysRef.current.some((key) => cacheKeyMatches(key, invalidated))) return
      if (focusedRef.current) {
        refreshRef.current()
      } else {
        // Refresh once the user navigates back to this screen.
        pendingRef.current = true
      }
    })
  }, [])

  useFocusEffect(() => {
    focusedRef.current = true
    // Only flush a queued invalidation — never refresh on effect re-attach.
    if (pendingRef.current) {
      pendingRef.current = false
      refreshRef.current()
    }
    return () => {
      focusedRef.current = false
    }
  }, [])
}
