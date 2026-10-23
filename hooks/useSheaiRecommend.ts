import { useEffect, useState } from 'react'

import {
  recommendWithSheai,
  type SheaiRecommendItem,
} from '~/lib/search/sheai'

export function useSheaiRecommend(query: string, enabled: boolean, topK = 10) {
  const [items, setItems] = useState<SheaiRecommendItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!enabled || !trimmed) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      void recommendWithSheai(trimmed, { topK, signal: controller.signal })
        .then((result) => {
          setItems(result.results)
          setLoading(false)
        })
        .catch((err: unknown) => {
          const aborted =
            controller.signal.aborted ||
            (err instanceof Error && err.name === 'AbortError')
          if (aborted) return
          setItems([])
          setError(err instanceof Error ? err.message : 'SHEai is waking up — try again in a moment.')
          setLoading(false)
        })
    }, 280)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, enabled, topK])

  return { items, loading, error }
}
