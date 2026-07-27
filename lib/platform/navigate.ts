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

function isNavigatorNotReadyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /navigate before mounting the Root Layout|Root Layout/i.test(message)
}

function fallbackWebReplace(target: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const path = target.startsWith('http') ? target : `${window.location.origin}${target.startsWith('/') ? target : `/${target}`}`
  window.location.replace(path)
  return true
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
    try {
      const outcome = options?.replace ? router.replace(target) : router.push(target)
      if (outcome && typeof (outcome as Promise<unknown>).then === 'function') {
        void (outcome as Promise<unknown>).catch((error: unknown) => {
          if (isNavigatorNotReadyError(error)) {
            if (!fallbackWebReplace(String(target))) {
              setTimeout(go, 50)
            }
            return
          }
          console.warn('[navigateApp] navigation failed', target, error)
          fallbackWebReplace(String(target))
        })
      }
    } catch (error) {
      if (isNavigatorNotReadyError(error)) {
        if (!fallbackWebReplace(String(target))) {
          setTimeout(go, 50)
        }
        return
      }
      console.warn('[navigateApp] navigation failed', target, error)
      fallbackWebReplace(String(target))
    }
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
