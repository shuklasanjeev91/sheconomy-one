import { useCallback, useEffect, useRef } from 'react'

type UseInfiniteScrollOptions = {
  enabled?: boolean
  rootMargin?: string
}

/** Fires when the sentinel element enters the viewport (web). */
export function useInfiniteScroll(
  onLoadMore: () => void,
  { enabled = true, rootMargin = '240px' }: UseInfiniteScrollOptions = {},
) {
  const sentinelRef = useRef<HTMLElement | null>(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  const setSentinelRef = useCallback((node: HTMLElement | null) => {
    sentinelRef.current = node
  }, [])

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return

    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current()
        }
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, rootMargin])

  return { sentinelRef: setSentinelRef, supportsAutoLoad: typeof IntersectionObserver !== 'undefined' }
}
