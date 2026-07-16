import { useCallback, useEffect, useRef, useState } from 'react'

import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'

type UseCachedQueryOptions<T> = {
  cacheKey: string | null
  enabled?: boolean
  fetcher: () => Promise<T>
}

type CachedQueryResult<T> = {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** Stale-while-revalidate query with memory + disk cache. */
export function useCachedQuery<T>({
  cacheKey,
  enabled = true,
  fetcher,
}: UseCachedQueryOptions<T>): CachedQueryResult<T> {
  const initial = cacheKey ? peekAppCache<T>(cacheKey) : null
  const [data, setData] = useState<T | null>(initial)
  const [isLoading, setIsLoading] = useState(enabled && !initial)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGen = useRef(0)
  const hasDataRef = useRef(!!initial)

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!enabled || !cacheKey) {
        setData(null)
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        hasDataRef.current = false
        return
      }

      const gen = ++fetchGen.current
      if (mode === 'initial' && !hasDataRef.current) setIsLoading(true)
      else setIsRefreshing(true)
      setError(null)

      try {
        const value = await fetcher()
        if (fetchGen.current !== gen) return
        setData(value)
        hasDataRef.current = true
        await writeAppCache(cacheKey, value)
      } catch (err) {
        if (fetchGen.current !== gen) return
        setError(err instanceof Error ? err.message : String(err))
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
      }
      await run(cached === null ? 'initial' : 'refresh')
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when cache key / enabled changes
  }, [cacheKey, enabled])

  const refresh = useCallback(async () => {
    await run(hasDataRef.current ? 'refresh' : 'initial')
  }, [run])

  return { data, isLoading, isRefreshing, error, refresh }
}
