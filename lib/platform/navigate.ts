import { startTransition } from 'react'
import type { Href } from 'one'
import { router } from 'one'
import { Platform } from 'react-native'

export type NavigateAppOptions = {
  /** Replace the current history entry instead of pushing. Prefer for tabs. */
  replace?: boolean
}

function normalizeLocation(pathWithOptionalQuery: string): string {
  const [path = '/', query = ''] = pathWithOptionalQuery.split('?')
  const trimmed = path.replace(/\/$/, '')
  const normalizedPath = trimmed === '' ? '/' : trimmed
  return query ? `${normalizedPath}?${query}` : normalizedPath
}

function isCurrentLocation(href: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const current = `${window.location.pathname}${window.location.search}`
  return normalizeLocation(current) === normalizeLocation(href)
}

/**
 * Soft client navigation for in-app paths on web, iOS, and Android.
 * Never assigns `window.location` — keeps the Vite SPA shell mounted.
 *
 * Web: startTransition keeps the chrome responsive while heavy routes paint.
 * Native: navigate immediately — deferring router.push/replace under
 * startTransition made tab/back taps feel multi-second delayed on Hermes.
 */
export function navigateApp(href: Href | string, options?: NavigateAppOptions): void {
  const target = (typeof href === 'string' ? href : String(href)) as Href
  if (isCurrentLocation(String(target))) return

  const go = () => {
    if (options?.replace) {
      router.replace(target)
      return
    }
    router.push(target)
  }

  if (Platform.OS === 'web') {
    startTransition(go)
    return
  }
  go()
}

/** Convenience alias for tab / auth redirects. */
export function replaceApp(href: Href | string): void {
  navigateApp(href, { replace: true })
}
