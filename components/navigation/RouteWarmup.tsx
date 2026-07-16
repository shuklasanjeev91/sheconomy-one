import { useEffect } from 'react'
import { Platform } from 'react-native'

import { startCoreTabPrefetch } from '~/lib/bootstrap/app-prefetch'

const WARM_ROUTE_SEGMENTS = [
  '',
  'community',
  'chat',
  'class',
  'co-work',
  'shops',
  'search',
  'cart',
  'settings',
  'profile',
] as const

function cacheKey(): string {
  return (
    (typeof process !== 'undefined' && process.env.ONE_CACHE_KEY?.trim()) ||
    '202607151'
  )
}

function preloadHref(segment: string): string {
  const key = cacheKey()
  return segment ? `/assets/${segment}_${key}_preload.js` : `/assets/_${key}_preload.js`
}

function scheduleIdle(run: () => void) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => {}
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(run, { timeout: 2500 })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(run, 500)
  return () => window.clearTimeout(id)
}

/**
 * Warm primary SPA preload bundles after first paint so the next tab/link
 * press hits a hot module cache instead of a 100+ file waterfall.
 */
export function RouteWarmup() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    return scheduleIdle(() => {
      startCoreTabPrefetch()
      for (const segment of WARM_ROUTE_SEGMENTS) {
        const href = preloadHref(segment)
        if (!document.querySelector(`link[data-sheconomy-warmup="${href}"]`)) {
          const link = document.createElement('link')
          link.rel = 'modulepreload'
          link.href = href
          link.setAttribute('data-sheconomy-warmup', href)
          document.head.appendChild(link)
        }
        void import(/* @vite-ignore */ href).catch(() => {})
      }
    })
  }, [])

  return null
}
