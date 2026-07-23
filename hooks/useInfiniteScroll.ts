import { useCallback, useEffect, useRef } from 'react'
import { Dimensions, Platform, type View } from 'react-native'

import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'

type UseInfiniteScrollOptions = {
  enabled?: boolean
  /** Distance before the sentinel enters view that triggers load (px). */
  rootMargin?: string | number
}

type SentinelNode = (View & { measureInWindow?: View['measureInWindow'] }) | HTMLElement | null

function parseMarginPx(rootMargin: string | number): number {
  if (typeof rootMargin === 'number') return rootMargin
  const match = rootMargin.match(/(-?\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 240
}

/**
 * Fires when the sentinel approaches the viewport.
 * Web: IntersectionObserver when available, plus scrollY fallback.
 * Native: AppBarScrollContext scrollY + measureInWindow.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  { enabled = true, rootMargin = '240px' }: UseInfiniteScrollOptions = {},
) {
  const sentinelRef = useRef<SentinelNode>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  const { scrollY } = useAppBarScroll()
  const marginPx = parseMarginPx(rootMargin)
  const inFlight = useRef(false)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  const setSentinelRef = useCallback((node: SentinelNode) => {
    sentinelRef.current = node
  }, [])

  const trigger = useCallback(() => {
    if (!enabled || inFlight.current) return
    inFlight.current = true
    onLoadMoreRef.current()
    // Allow another trigger after the parent flips isLoadingMore / hasMore.
    requestAnimationFrame(() => {
      inFlight.current = false
    })
  }, [enabled])

  const checkNativeVisibility = useCallback(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node) return

    if (Platform.OS === 'web' && typeof (node as HTMLElement).getBoundingClientRect === 'function') {
      const rect = (node as HTMLElement).getBoundingClientRect()
      if (rect.top <= window.innerHeight + marginPx) trigger()
      return
    }

    const view = node as View & { measureInWindow?: View['measureInWindow'] }
    if (typeof view.measureInWindow !== 'function') return

    view.measureInWindow((_x, y, _w, h) => {
      const windowHeight = Dimensions.get('window').height
      if (y <= windowHeight + marginPx && y + (h || 1) >= -marginPx) {
        trigger()
      }
    })
  }, [enabled, marginPx, trigger])

  // Web IntersectionObserver (document / viewport).
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return
    if (typeof IntersectionObserver === 'undefined') return

    const node = sentinelRef.current
    if (!node || !(node instanceof Element)) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trigger()
        }
      },
      { rootMargin: typeof rootMargin === 'number' ? `${rootMargin}px` : rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, rootMargin, scrollY, trigger])

  // Native (+ web ScrollView): scroll position drives visibility checks.
  useEffect(() => {
    if (!enabled) return
    checkNativeVisibility()
  }, [enabled, scrollY, checkNativeVisibility])

  useEffect(() => {
    if (!enabled) return
    const id = requestAnimationFrame(() => checkNativeVisibility())
    return () => cancelAnimationFrame(id)
  }, [enabled, checkNativeVisibility])

  return {
    sentinelRef: setSentinelRef,
    supportsAutoLoad: true,
  }
}
