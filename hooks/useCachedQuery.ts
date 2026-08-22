import { useCallback, useEffect, useRef, useState } from 'react'

import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { FEED_FRESH_MS, isFeedFresh } from '~/lib/cache/feed-freshness'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type UseCachedQueryOptions<T> = {
  cacheKey: string | null
  enabled?: boolean
  fetcher: () => Promise<T>
  /** Extra invalidation topics that should silently refresh this query. */
  watchKeys?: string[]
}

type CachedQueryResult<T> = {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  /** True when we have cached data but the latest network fetch failed. */
  showingCached: boolean
  refresh: () => Promise<void>
}

/** Stale-while-revalidate query with memory + disk cache. */
export function useCachedQuery<T>({
  cacheKey,
  enabled = true,
  fetcher,
  watchKeys,
}: UseCachedQueryOptions<T>): CachedQueryResult<T> {
  // Prefer in-memory; disk hydrate happens via warmCriticalAppCaches on boot.
  const initial = cacheKey ? peekAppCache<T>(cacheKey) : null
  const [data, setData] = useState<T | null>(initial)
  const [isLoading, setIsLoading] = useState(enabled && !initial)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGen = useRef(0)
  const hasDataRef = useRef(!!initial)

  const run = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!enabled || !cacheKey) {
        setData(null)
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        hasDataRef.current = false
        return
      }

      const gen = ++fetchGen.current
      const silent = mode === 'silent' && hasDataRef.current
      if (mode === 'initial' && !hasDataRef.current) setIsLoading(true)
      else if (!silent) setIsRefreshing(true)
      if (!silent) setError(null)

      try {
        const value = await fetcher()
        if (fetchGen.current !== gen) return
        setData(value)
        hasDataRef.current = true
        setError(null)
        await writeAppCache(cacheKey, value)
      } catch (err) {
        if (fetchGen.current !== gen) return
        // Keep cached content visible; surface a soft error only when needed.
        const message = err instanceof Error ? err.message : String(err)
        if (!silent || !hasDataRef.current) {
          setError(message)
        }
      } finally {
        if (fetchGen.current === gen) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [cacheKey, enabled, fetcher],
  )

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setData(null)
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      hasDataRef.current = false
      return
    }

    let cancelled = false
    void (async () => {
      const cached = peekAppCache<T>(cacheKey) ?? (await readAppCache<T>(cacheKey))
      if (cancelled) return
      if (cached !== null) {
        setData(cached)
        hasDataRef.current = true
        setIsLoading(false)
        if (isFeedFresh(cacheKey, FEED_FRESH_MS)) return
      }
      await run(cached === null ? 'initial' : 'refresh')
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when cache key / enabled changes
  }, [cacheKey, enabled])

  // Silently revalidate when related data changes elsewhere or the screen
  // regains focus after the user navigates back to it.
  useAutoRefresh([cacheKey, ...(watchKeys ?? [])], () => {
    if (!enabled || !cacheKey) return
    void run(hasDataRef.current ? 'silent' : 'initial')
  })

  const refresh = useCallback(async () => {
    await run(hasDataRef.current ? 'refresh' : 'initial')
  }, [run])

  useOnReconnect(() => {
    if (!enabled || !cacheKey) return
    void run(hasDataRef.current ? 'silent' : 'initial')
  })

  const showingCached = !!data && !!error

  return { data, isLoading, isRefreshing, error, showingCached, refresh }
}
