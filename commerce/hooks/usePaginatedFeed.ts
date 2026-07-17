import { useCallback, useEffect, useRef, useState } from 'react'

import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import type { PaginatedResult } from '~/lib/supabase/commerce'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type PaginatedCacheSnapshot<T> = {
  items: T[]
  page: number
  hasMore: boolean
}

function mergeUnique<T extends { id: string }>(existing: T[], next: T[]): T[] {
  const seen = new Set(existing.map((item) => item.id))
  const appended = next.filter((item) => !seen.has(item.id))
  return appended.length ? [...existing, ...appended] : existing
}

type UsePaginatedFeedOptions<T> = {
  fetchPage: (page: number) => Promise<PaginatedResult<T>>
  enabled?: boolean
  cacheKey?: string
  /** Extra invalidation topics that should silently refresh this feed. */
  watchKeys?: string[]
}

export function usePaginatedFeed<T extends { id: string }>({
  fetchPage,
  enabled = true,
  cacheKey,
  watchKeys,
}: UsePaginatedFeedOptions<T>) {
  const initialSnapshot = cacheKey ? peekAppCache<PaginatedCacheSnapshot<T>>(cacheKey) : null
  const [items, setItems] = useState<T[]>(initialSnapshot?.items ?? [])
  const [page, setPage] = useState(initialSnapshot?.page ?? 0)
  const [hasMore, setHasMore] = useState(initialSnapshot?.hasMore ?? true)
  const [isLoading, setIsLoading] = useState(enabled && !initialSnapshot)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const hasItemsRef = useRef((initialSnapshot?.items?.length ?? 0) > 0)
  hasItemsRef.current = items.length > 0

  const persistFirstPage = useCallback(
    async (snapshot: PaginatedCacheSnapshot<T>) => {
      if (!cacheKey) return
      await writeAppCache(cacheKey, snapshot)
    },
    [cacheKey],
  )

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean, silent = false) => {
      if (!enabled || inFlightRef.current) return

      inFlightRef.current = true
      if (append) {
        setIsLoadingMore(true)
      } else if (silent && hasItemsRef.current) {
        // Background revalidation: keep current content, no spinners.
      } else if (hasItemsRef.current) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const result = await fetchPage(pageToLoad)

      if (result.error) {
        // Preserve cached / already-loaded content instead of wiping the list.
        setError(result.error)
        if (!append && !hasItemsRef.current) {
          setHasMore(false)
        }
      } else {
        setError(null)
        const silentMerge = !append && silent && hasItemsRef.current
        setItems((current) => {
          // Silent revalidation keeps already-loaded pages below the fresh
          // first page so scroll position and pagination are preserved.
          const nextItems = append
            ? mergeUnique(current, result.items)
            : silentMerge
              ? mergeUnique(result.items, current)
              : result.items
          if (!append && cacheKey) {
            void persistFirstPage({
              items: result.items,
              page: 0,
              hasMore: result.hasMore,
            })
          }
          return nextItems
        })
        if (!silentMerge) {
          setPage(pageToLoad)
          setHasMore(result.hasMore)
        }
      }

      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMore(false)
      inFlightRef.current = false
    },
    [cacheKey, enabled, fetchPage, persistFirstPage],
  )

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setPage(0)
      setHasMore(true)
      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMore(false)
      setError(null)
      return
    }

    let cancelled = false

    void (async () => {
      if (cacheKey) {
        const cached =
          peekAppCache<PaginatedCacheSnapshot<T>>(cacheKey) ??
          (await readAppCache<PaginatedCacheSnapshot<T>>(cacheKey))
        if (cancelled) return
        if (cached?.items?.length) {
          setItems(cached.items)
          setPage(cached.page)
          setHasMore(cached.hasMore)
          setIsLoading(false)
        }
      }

      if (!cancelled) {
        await loadPage(0, false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when key/enabled/fetcher changes
  }, [cacheKey, enabled, fetchPage])

  // Silently revalidate when related data is mutated elsewhere in the app or
  // when the user navigates back to this screen.
  useAutoRefresh([cacheKey, ...(watchKeys ?? [])], () => {
    if (!enabled || inFlightRef.current) return
    void loadPage(0, false, true)
  })

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoading || isLoadingMore || isRefreshing || inFlightRef.current) {
      return
    }
    loadPage(page + 1, true)
  }, [enabled, hasMore, isLoading, isLoadingMore, isRefreshing, loadPage, page])

  const refresh = useCallback(() => {
    if (!enabled) return
    loadPage(0, false)
  }, [enabled, loadPage])

  useOnReconnect(() => {
    if (!enabled || inFlightRef.current) return
    void loadPage(0, false, true)
  })

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const patchItem = useCallback((id: string, patch: Partial<T>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }, [])

  const showingCached = items.length > 0 && !!error

  return {
    items,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    showingCached,
    loadMore,
    refresh,
    removeItem,
    patchItem,
  }
}
