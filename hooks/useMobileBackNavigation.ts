import { Platform } from 'react-native'
import { useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'one'
import type { Href } from 'one'

import {
  getMobileBackFallback,
  shouldShowMobileBack,
} from '~/lib/navigation/mobile-back'

/** Mobile/tablet back navigation — history when available, section fallback otherwise. */
export function useMobileBackNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const showBack = shouldShowMobileBack(pathname)
  const fallbackHref = getMobileBackFallback(pathname)
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
      router.back()

      // Web SPAs / Slot stacks sometimes report canGoBack but back() no-ops.
      // If the path hasn't changed shortly after, fall back to the parent route.
      if (Platform.OS === 'web') {
        window.setTimeout(() => {
          navigatingRef.current = false
          const current = window.location.pathname.replace(/\/$/, '') || '/'
          const expected = fromPath.replace(/\/$/, '') || '/'
          if (current === expected) {
            router.replace(fallbackHref)
          }
        }, 120)
        return
      }

      navigatingRef.current = false
      return
    }

    navigatingRef.current = false
    router.replace(fallbackHref)
  }, [fallbackHref, pathname, router])

  return {
    showBack,
    goBack,
    fallbackHref: fallbackHref as Href,
  }
}
