import type { Href } from 'one'
import { router } from 'one'

export type NavigateAppOptions = {
  /** Replace the current history entry instead of pushing. Prefer for tabs. */
  replace?: boolean
}

/**
 * Soft client navigation for in-app paths on web, iOS, and Android.
 * Never assigns `window.location` — keeps the Vite SPA shell mounted.
 */
export function navigateApp(href: Href | string, options?: NavigateAppOptions): void {
  const target = (typeof href === 'string' ? href : String(href)) as Href
  if (options?.replace) {
    router.replace(target)
    return
  }
  router.push(target)
}

/** Convenience alias for tab / auth redirects. */
export function replaceApp(href: Href | string): void {
  navigateApp(href, { replace: true })
}
