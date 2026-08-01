import { useEffect, useRef, useState } from 'react'

import {
  prefetchNativeLoader,
  readNativeLoaderCache,
  seedNativeLoaderCache,
} from '~/lib/bootstrap/native-loader-cache'
import { peekAppCache, readAppCache } from '~/lib/cache/app-cache'

type LoaderResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

type UseNativeLoaderOptions = {
  /** Stable cache key — enables prefetch + instant replay on revisit. */
  cacheKey?: string
}

/**
 * Run a route loader on native — Metro serves empty loader stubs in dev.
 * Loader identity must not retrigger fetches (call sites often pass inline lambdas).
 *
 * Paint order: in-memory native loader → last-session disk cache → network.
 */
export function useNativeLoader<T>(
  loader: () => Promise<T>,
  options: UseNativeLoaderOptions = {},
): LoaderResult<T> {
  const { cacheKey } = options
  const cached = cacheKey ? readNativeLoaderCache<T>(cacheKey) : undefined
  const diskPeek = !cached?.data && cacheKey ? peekAppCache<T>(cacheKey) : null
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const [data, setData] = useState<T | null>(cached?.data ?? diskPeek ?? null)
  const [loading, setLoading] = useState(
    cached?.data === undefined && diskPeek == null && !cached?.error,
  )
  const [error, setError] = useState<string | null>(cached?.error ?? null)

  useEffect(() => {
    let cancelled = false

    const finish = (value: T | null, err: string | null) => {
      if (cancelled) return
      setData(value)
      setError(err)
      setLoading(false)
    }

    const run = () => loaderRef.current()

    const attachPromise = (promise?: Promise<T>) => {
      if (!promise) return
      promise
        .then((value) => finish(value, null))
        .catch((err: unknown) => {
          if (cancelled) return
          // Keep seed/previous data; only blank when we have nothing.
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        })
    }

    void (async () => {
      if (!cacheKey) {
        run()
          .then((value) => finish(value, null))
          .catch((err) => finish(null, err instanceof Error ? err.message : String(err)))
        return
      }

      let entry = readNativeLoaderCache<T>(cacheKey)

      if (entry?.data === undefined) {
        const fromDisk = peekAppCache<T>(cacheKey) ?? (await readAppCache<T>(cacheKey))
        if (cancelled) return
        if (fromDisk != null) {
          seedNativeLoaderCache(cacheKey, fromDisk)
          finish(fromDisk, null)
          entry = readNativeLoaderCache<T>(cacheKey)
        }
      }

      if (entry?.data !== undefined) {
        finish(entry.data, entry.error ?? null)
        if (entry.promise) {
          attachPromise(entry.promise)
        } else {
          prefetchNativeLoader(cacheKey, run)
          attachPromise(readNativeLoaderCache<T>(cacheKey)?.promise)
        }
        return
      }

      if (entry?.promise) {
        attachPromise(entry.promise)
        return
      }

      prefetchNativeLoader(cacheKey, run)
      const next = readNativeLoaderCache<T>(cacheKey)
      if (next?.data !== undefined) {
        finish(next.data, next.error ?? null)
      }
      attachPromise(next?.promise)
    })()

    return () => {
      cancelled = true
    }
    // Intentionally omit `loader` — identity changes every render at call sites.
  }, [cacheKey])

  return { data, loading, error }
}
