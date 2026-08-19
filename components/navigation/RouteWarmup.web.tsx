import { useEffect } from 'react'

import { startCoreTabPrefetch } from '~/lib/bootstrap/app-prefetch'

function scheduleIdle(run: () => void) {
  if (typeof window === 'undefined') {
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
 * Warm primary tab data caches after first paint.
 *
 * Do NOT invent `/assets/{segment}_{ONE_CACHE_KEY}_preload.js` URLs — the current
 * Vite/rolldown build emits content-hashed chunks (e.g. `orders-DEhPK9SS.js`), so
 * those preload paths 404 on every page load and spam the console.
 */
export function RouteWarmup() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    return scheduleIdle(() => {
      startCoreTabPrefetch()
    })
  }, [])

  return null
}
