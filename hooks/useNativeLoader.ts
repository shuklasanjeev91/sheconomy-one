import { useEffect, useState } from 'react'

type LoaderResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

/** Run a route loader on native — Metro serves empty loader stubs in dev. */
export function useNativeLoader<T>(loader: () => Promise<T>): LoaderResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loader()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loader])

  return { data, loading, error }
}
