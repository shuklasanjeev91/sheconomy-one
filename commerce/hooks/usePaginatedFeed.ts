import { useCallback, useEffect, useRef, useState } from 'react'

import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { FEED_FRESH_MS, isFeedFresh, markFeedFresh } from '~/lib/cache/feed-freshness'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { scheduleIdle } from '~/lib/schedule-idle'
import type { PaginatedResult } from '~/lib/supabase/commerce'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type PaginatedCacheSnapshot<T> = {
  items: T[]
  page: number
  hasMore: boolean
}

type PrefetchBuffer<T> = {
  page: number
  result: PaginatedResult<T>
}

/** Start next-page prefetch almost immediately so scroll never waits on idle. */
const PREFETCH_IDLE_MS = 80
/** Debounce only enough to collapse FlashList fling storms. */
const LOAD_MORE_DEBOUNCE_MS = 120

export { markFeedFresh } from '~/lib/cache/feed-freshness'

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
  /** Idle-prefetch the next page after a successful load. Default true. */
  prefetchNext?: boolean
}

export function usePaginatedFeed<T extends { id: string }>({
  fetchPage,
  enabled = true,
  cacheKey,
  watchKeys,
  prefetchNext = true,
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
  const fetchGenerationRef = useRef(0)
  const hasItemsRef = useRef((initialSnapshot?.items?.length ?? 0) > 0)
  const loadMoreAtRef = useRef(0)
  const pageRef = useRef(initialSnapshot?.page ?? 0)
  const hasMoreRef = useRef(initialSnapshot?.hasMore ?? true)
  const prefetchBufferRef = useRef<PrefetchBuffer<T> | null>(null)
  const prefetchInFlightPageRef = useRef<number | null>(null)
  const prefetchPromiseRef = useRef<Promise<PrefetchBuffer<T> | null> | null>(null)
  const cancelIdlePrefetchRef = useRef<(() => void) | null>(null)
  const fetchPageRef = useRef(fetchPage)
  fetchPageRef.current = fetchPage
  hasItemsRef.current = items.length > 0
  pageRef.current = page
  hasMoreRef.current = hasMore

  const clearPrefetch = useCallback(() => {
    cancelIdlePrefetchRef.current?.()
    cancelIdlePrefetchRef.current = null
    prefetchBufferRef.current = null
    prefetchInFlightPageRef.current = null
    prefetchPromiseRef.current = null
  }, [])

  const persistFirstPage = useCallback(
    async (snapshot: PaginatedCacheSnapshot<T>) => {
      if (!cacheKey) return
      await writeAppCache(cacheKey, snapshot)
    },
    [cacheKey],
  )

  const markFetched = useCallback(() => {
    if (cacheKey) markFeedFresh(cacheKey)
  }, [cacheKey])

  const startPrefetch = useCallback(
    (afterPage: number, generation: number): Promise<PrefetchBuffer<T> | null> => {
      const nextPage = afterPage + 1
      if (prefetchBufferRef.current?.page === nextPage) {
        return Promise.resolve(prefetchBufferRef.current)
      }
      if (prefetchInFlightPageRef.current === nextPage && prefetchPromiseRef.current) {
        return prefetchPromiseRef.current
      }

      prefetchInFlightPageRef.current = nextPage
      const promise = fetchPageRef
        .current(nextPage)
        .then((result) => {
          if (generation !== fetchGenerationRef.current) return null
          if (pageRef.current !== afterPage) return null
          if (result.error) return null
          const buffered = { page: nextPage, result }
          prefetchBufferRef.current = buffered
          return buffered
        })
        .catch(() => null)
        .finally(() => {
          if (prefetchInFlightPageRef.current === nextPage) {
            prefetchInFlightPageRef.current = null
          }
          if (prefetchPromiseRef.current === promise) {
            prefetchPromiseRef.current = null
          }
        })

      prefetchPromiseRef.current = promise
      return promise
    },
    [],
  )

  const schedulePrefetch = useCallback(
    (afterPage: number, generation: number) => {
      if (!prefetchNext) return
      cancelIdlePrefetchRef.current?.()
      cancelIdlePrefetchRef.current = null

      const nextPage = afterPage + 1
      if (prefetchBufferRef.current?.page === nextPage) return
      if (prefetchInFlightPageRef.current === nextPage) return

      cancelIdlePrefetchRef.current = scheduleIdle(() => {
        if (generation !== fetchGenerationRef.current) return
        if (!hasMoreRef.current) return
        if (pageRef.current !== afterPage) return
        void startPrefetch(afterPage, generation)
      }, PREFETCH_IDLE_MS)
    },
    [prefetchNext, startPrefetch],
  )

  const applyAppendResult = useCallback(
    (pageToLoad: number, result: PaginatedResult<T>, generation: number) => {
      if (generation !== fetchGenerationRef.current) return

      if (result.error) {
        setError(result.error)
        return
      }

      setError(null)
      markFetched()
      setItems((current) => mergeUnique(current, result.items))
      setPage(pageToLoad)
      pageRef.current = pageToLoad
      setHasMore(result.hasMore)
      hasMoreRef.current = result.hasMore

      if (result.hasMore) {
        schedulePrefetch(pageToLoad, generation)
      }
    },
    [markFetched, schedulePrefetch],
  )

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean, silent = false) => {
      if (!enabled) return
      // Non-append loads always win (tab/filter change); append still respects in-flight.
      if (append && inFlightRef.current) return

      const generation = append ? fetchGenerationRef.current : ++fetchGenerationRef.current
      if (!append) {
        clearPrefetch()
      }

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

      try {
        const result = await fetchPage(pageToLoad)

        // Stale response after tab/filter change — ignore payload, but always
        // clear this request's loading flags so skeletons cannot stick forever.
        if (generation !== fetchGenerationRef.current) {
          return
        }

        if (result.error) {
          // Preserve cached / already-loaded content instead of wiping the list.
          setError(result.error)
          if (!append && !hasItemsRef.current) {
            setHasMore(false)
            hasMoreRef.current = false
          }
        } else {
          setError(null)
          markFetched()
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
            pageRef.current = pageToLoad
            setHasMore(result.hasMore)
            hasMoreRef.current = result.hasMore
            if (result.hasMore) {
              schedulePrefetch(pageToLoad, generation)
            }
          } else if (result.hasMore && pageRef.current === 0) {
            // Fresh first page while keeping scroll pages — warm page 1.
            schedulePrefetch(0, generation)
          }
        }
      } finally {
        if (generation === fetchGenerationRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
          setIsLoadingMore(false)
          inFlightRef.current = false
        }
      }
    },
    [
      cacheKey,
      clearPrefetch,
      enabled,
      fetchPage,
      markFetched,
      persistFirstPage,
      schedulePrefetch,
    ],
  )

  useEffect(() => {
    if (!enabled) {
      clearPrefetch()
      setItems([])
      setPage(0)
      pageRef.current = 0
      setHasMore(true)
      hasMoreRef.current = true
      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMore(false)
      setError(null)
      return
    }

    let cancelled = false
    // Invalidate any in-flight response from the previous key/fetcher.
    fetchGenerationRef.current += 1
    inFlightRef.current = false
    clearPrefetch()

    void (async () => {
      let hasCached = false
      if (cacheKey) {
        const cached =
          peekAppCache<PaginatedCacheSnapshot<T>>(cacheKey) ??
          (await readAppCache<PaginatedCacheSnapshot<T>>(cacheKey))
        if (cancelled) return
        if (cached?.items?.length) {
          hasCached = true
          setItems(cached.items)
          setPage(cached.page)
          pageRef.current = cached.page
          setHasMore(cached.hasMore)
          hasMoreRef.current = cached.hasMore
          setIsLoading(false)
          if (isFeedFresh(cacheKey, FEED_FRESH_MS)) {
            // Fresh enough — skip another network round-trip on tab revisit.
            if (cached.hasMore) {
              schedulePrefetch(cached.page, fetchGenerationRef.current)
            }
            return
          }
        } else {
          // Drop previous tab/filter results so we never flash the wrong media type.
          setItems([])
          setPage(0)
          pageRef.current = 0
          setHasMore(true)
          hasMoreRef.current = true
          setIsLoading(true)
        }
      } else {
        setItems([])
        setPage(0)
        pageRef.current = 0
        setHasMore(true)
        hasMoreRef.current = true
        setIsLoading(true)
      }

      if (!cancelled) {
        // Cached tabs: silent background refresh so UI stays instant.
        await loadPage(0, false, hasCached)
      }
    })()

    return () => {
      cancelled = true
      cancelIdlePrefetchRef.current?.()
      cancelIdlePrefetchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when key/enabled/fetcher changes
  }, [cacheKey, enabled, fetchPage])

  // Silently revalidate when related data is mutated elsewhere in the app.
  // Pending invalidations flush when the screen is focused again (see useAutoRefresh).
  const silentRefresh = useCallback(() => {
    if (!enabled || inFlightRef.current) return
    void loadPage(0, false, true)
  }, [enabled, loadPage])

  useAutoRefresh([cacheKey, ...(watchKeys ?? [])], silentRefresh)

  const loadMore = useCallback(() => {
    if (!enabled || !hasMoreRef.current || isLoading || isLoadingMore || isRefreshing) {
      return
    }
    const now = Date.now()
    // Debounce rapid onEndReached storms from FlashList during fling.
    if (now - loadMoreAtRef.current < LOAD_MORE_DEBOUNCE_MS) return
    loadMoreAtRef.current = now
    if (inFlightRef.current) return

    const nextPage = pageRef.current + 1
    const afterPage = pageRef.current
    const generation = fetchGenerationRef.current
    const buffered = prefetchBufferRef.current
    if (buffered?.page === nextPage && !buffered.result.error) {
      prefetchBufferRef.current = null
      applyAppendResult(nextPage, buffered.result, generation)
      return
    }

    // Cancel delayed idle prefetch and share one in-flight request for this page.
    cancelIdlePrefetchRef.current?.()
    cancelIdlePrefetchRef.current = null

    inFlightRef.current = true
    setIsLoadingMore(true)

    const work = prefetchNext
      ? startPrefetch(afterPage, generation).then((ready) => {
          if (generation !== fetchGenerationRef.current) return
          if (ready?.page === nextPage && !ready.result.error) {
            prefetchBufferRef.current = null
            applyAppendResult(nextPage, ready.result, generation)
            return
          }
          return fetchPageRef.current(nextPage).then((result) => {
            if (generation !== fetchGenerationRef.current) return
            applyAppendResult(nextPage, result, generation)
          })
        })
      : fetchPageRef.current(nextPage).then((result) => {
          if (generation !== fetchGenerationRef.current) return
          applyAppendResult(nextPage, result, generation)
        })

    void work.finally(() => {
      if (generation === fetchGenerationRef.current) {
        setIsLoadingMore(false)
        inFlightRef.current = false
      }
    })
  }, [
    applyAppendResult,
    enabled,
    isLoading,
    isLoadingMore,
    isRefreshing,
    prefetchNext,
    startPrefetch,
  ])

  const refresh = useCallback(() => {
    if (!enabled) return
    void loadPage(0, false)
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
