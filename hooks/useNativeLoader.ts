import { useEffect, useRef, useState } from 'react'

import {
  prefetchNativeLoader,
  readNativeLoaderCache,
} from '~/lib/bootstrap/native-loader-cache'

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
 * If a seed (or completed) cache entry exists, paint immediately and still
 * subscribe to any in-flight upgrade promise.
 */
export function useNativeLoader<T>(
  loader: () => Promise<T>,
  options: UseNativeLoaderOptions = {},
): LoaderResult<T> {
  const { cacheKey } = options
  const cached = cacheKey ? readNativeLoaderCache<T>(cacheKey) : undefined
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const [data, setData] = useState<T | null>(cached?.data ?? null)
  const [loading, setLoading] = useState(cached?.data === undefined && !cached?.error)
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

    if (cacheKey) {
      const entry = readNativeLoaderCache<T>(cacheKey)

      if (entry?.data !== undefined) {
        finish(entry.data, entry.error ?? null)
        if (entry.promise) {
          entry.promise
            .then((value) => finish(value, null))
            .catch((err: unknown) => {
              // Keep seed/previous data; only surface error if we have nothing.
              if (cancelled) return
              setError(err instanceof Error ? err.message : String(err))
              setLoading(false)
            })
        }
        return () => {
          cancelled = true
        }
      }

      if (entry?.promise) {
        entry.promise
          .then((value) => finish(value, null))
          .catch((err: unknown) =>
            finish(null, err instanceof Error ? err.message : String(err)),
          )
        return () => {
          cancelled = true
        }
      }

      prefetchNativeLoader(cacheKey, run)
      const next = readNativeLoaderCache<T>(cacheKey)
      if (next?.data !== undefined) {
        finish(next.data, next.error ?? null)
      }
      if (next?.promise) {
        next.promise
          .then((value) => finish(value, null))
          .catch((err: unknown) =>
            finish(null, err instanceof Error ? err.message : String(err)),
          )
        return () => {
          cancelled = true
        }
      }
    }

    run()
      .then((value) => finish(value, null))
      .catch((err) => finish(null, err instanceof Error ? err.message : String(err)))

    return () => {
      cancelled = true
    }
    // Intentionally omit `loader` — identity changes every render at call sites.
  }, [cacheKey])

  return { data, loading, error }
}
