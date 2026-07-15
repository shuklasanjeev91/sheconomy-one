import { useCallback, useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'
import type { View } from 'react-native'

type UseInViewOptions = {
  /** Fraction of the element that must be visible (0–1). Default 0.55 ≈ LinkedIn feed. */
  threshold?: number
  /** Disable observation (keeps previous value). */
  enabled?: boolean
}

/**
 * Reports when a view is sufficiently visible in the viewport.
 * Web: IntersectionObserver. Native: measureInWindow polling (ScrollView / rails safe).
 */
export function useInView({ threshold = 0.55, enabled = true }: UseInViewOptions = {}) {
  const [node, setNode] = useState<View | Element | null>(null)
  const [inView, setInView] = useState(false)

  const ref = useCallback((next: View | Element | null) => {
    setNode(next)
  }, [])

  useEffect(() => {
    if (!enabled || !node) {
      setInView(false)
      return
    }

    if (Platform.OS === 'web') {
      const el = node as unknown as Element
      if (!el || typeof IntersectionObserver === 'undefined') return

      const observer = new IntersectionObserver(
        ([entry]) => {
          setInView(Boolean(entry?.isIntersecting && (entry.intersectionRatio ?? 0) >= threshold * 0.9))
        },
        { threshold: [0, 0.25, 0.5, 0.55, 0.75, 1] },
      )
      observer.observe(el)
      return () => observer.disconnect()
    }

    let cancelled = false
    const tick = () => {
      const view = node as View
      if (!view || typeof view.measureInWindow !== 'function') return
      view.measureInWindow((x, y, width, height) => {
        if (cancelled) return
        if (!width || !height) {
          setInView(false)
          return
        }
        const { width: vw, height: vh } = Dimensions.get('window')
        const visibleW = Math.max(0, Math.min(x + width, vw) - Math.max(x, 0))
        const visibleH = Math.max(0, Math.min(y + height, vh) - Math.max(y, 0))
        const ratio = (visibleW * visibleH) / (width * height)
        setInView(ratio >= threshold)
      })
    }

    tick()
    const id = setInterval(tick, 220)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, node, threshold])

  return { ref, inView }
}
