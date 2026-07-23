import { Platform } from 'react-native'
import { startTransition, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'one'
import type { Href } from 'one'

import { useAppLayout } from '~/hooks/useAppLayout'
import {
  getMobileBackFallback,
  shouldShowMobileBack,
} from '~/lib/navigation/mobile-back'
import { navigateApp } from '~/lib/platform/navigate'
import { communityRoutes, routes } from '~/lib/routes'

/**
 * Shared back navigation for app chrome (web, iOS, and Android).
 * History when available; otherwise a sensible section fallback.
 */
export function useAppBackNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { isDesktop } = useAppLayout()
  const showBack = shouldShowMobileBack(pathname)
  const fallbackHref = resolveBackFallback(pathname, isDesktop)
  const navigatingRef = useRef(false)

  const goBack = useCallback(() => {
    if (navigatingRef.current) return

    const fromPath = pathname
    let canGoBack = false
    try {
      canGoBack = typeof router.canGoBack === 'function' && router.canGoBack()
    } catch {
      canGoBack = false
    }

    if (canGoBack) {
      navigatingRef.current = true
      // Native: call back() immediately — startTransition deferred back() felt hung.
      const runBack = () => {
        router.back()
      }
      if (Platform.OS === 'web') {
        startTransition(runBack)
      } else {
        runBack()
      }

      // Web SPAs / Slot stacks sometimes report canGoBack but back() no-ops.
      // If the path hasn't changed shortly after, fall back to the parent route.
      if (Platform.OS === 'web') {
        window.setTimeout(() => {
          navigatingRef.current = false
          const current = window.location.pathname.replace(/\/$/, '') || '/'
          const expected = fromPath.replace(/\/$/, '') || '/'
          if (current === expected) {
            navigateApp(fallbackHref, { replace: true })
          }
        }, 120)
        return
      }

      // Native: clear the lock on the next frame so rapid taps aren't dropped,
      // but don't block the JS thread waiting for the previous heavy screen.
      requestAnimationFrame(() => {
        navigatingRef.current = false
      })
      return
    }

    navigatingRef.current = false
    navigateApp(fallbackHref, { replace: true })
  }, [fallbackHref, pathname, router])

  return {
    showBack,
    goBack,
    fallbackHref: fallbackHref as Href,
  }
}

/** @deprecated Prefer `useAppBackNavigation`. */
export const useMobileBackNavigation = useAppBackNavigation

function resolveBackFallback(pathname: string, isDesktop: boolean): Href {
  // Desktop settings hub redirects index → /settings/account, so section→hub would loop.
  // Leave Settings entirely from any settings surface on desktop.
  if (isDesktop && (pathname === '/settings' || pathname.startsWith('/settings/'))) {
    return communityRoutes.home
  }
  if (!isDesktop && pathname.startsWith('/settings/')) {
    return routes.settings
  }
  return getMobileBackFallback(pathname)
}
