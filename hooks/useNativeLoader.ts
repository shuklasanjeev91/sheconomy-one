import { useEffect, useState } from 'react'

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

/** Run a route loader on native — Metro serves empty loader stubs in dev. */
export function useNativeLoader<T>(
  loader: () => Promise<T>,
  options: UseNativeLoaderOptions = {},
): LoaderResult<T> {
  const { cacheKey } = options
  const cached = cacheKey ? readNativeLoaderCache<T>(cacheKey) : undefined

  const [data, setData] = useState<T | null>(cached?.data ?? null)
  const [loading, setLoading] = useState(!cached?.data && !cached?.error)
  const [error, setError] = useState<string | null>(cached?.error ?? null)

  useEffect(() => {
    let cancelled = false

    const finish = (value: T | null, err: string | null) => {
      if (cancelled) return
      setData(value)
      setError(err)
      setLoading(false)
    }

    if (cacheKey) {
      const entry = readNativeLoaderCache<T>(cacheKey)
      if (entry?.data !== undefined) {
        finish(entry.data, entry.error ?? null)
        return
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
      prefetchNativeLoader(cacheKey, loader)
      const next = readNativeLoaderCache<T>(cacheKey)
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

    loader()
      .then((value) => finish(value, null))
      .catch((err) => finish(null, err instanceof Error ? err.message : String(err)))

    return () => {
      cancelled = true
    }
  }, [cacheKey, loader])

  return { data, loading, error }
}
