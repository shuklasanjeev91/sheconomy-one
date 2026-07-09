import { useCallback, useEffect, useRef, useState } from 'react'

import type { PaginatedResult } from '~/lib/supabase/commerce'

function mergeUnique<T extends { id: string }>(existing: T[], next: T[]): T[] {
  const seen = new Set(existing.map((item) => item.id))
  const appended = next.filter((item) => !seen.has(item.id))
  return appended.length ? [...existing, ...appended] : existing
}

type UsePaginatedFeedOptions<T> = {
  fetchPage: (page: number) => Promise<PaginatedResult<T>>
  enabled?: boolean
}

export function usePaginatedFeed<T extends { id: string }>({
  fetchPage,
  enabled = true,
}: UsePaginatedFeedOptions<T>) {
  const [items, setItems] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!enabled || inFlightRef.current) return

      inFlightRef.current = true
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)

      const result = await fetchPage(pageToLoad)

      if (result.error) {
        setError(result.error)
        if (!append) setItems([])
        setHasMore(false)
      } else {
        setError(null)
        setItems((current) => (append ? mergeUnique(current, result.items) : result.items))
        setPage(pageToLoad)
        setHasMore(result.hasMore)
      }

      setIsLoading(false)
      setIsLoadingMore(false)
      inFlightRef.current = false
    },
    [enabled, fetchPage],
  )

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setPage(0)
      setHasMore(true)
      setIsLoading(false)
      setIsLoadingMore(false)
      setError(null)
      return
    }

    loadPage(0, false)
  }, [enabled, loadPage])

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || isLoading || isLoadingMore || inFlightRef.current) return
    loadPage(page + 1, true)
  }, [enabled, hasMore, isLoading, isLoadingMore, loadPage, page])

  const refresh = useCallback(() => {
    if (!enabled) return
    loadPage(0, false)
  }, [enabled, loadPage])

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  }
}
