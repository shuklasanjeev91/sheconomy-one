import type { Href } from 'one'
import { useCallback } from 'react'

import { navigateApp, pushApp } from '~/lib/platform/navigate'

/**
 * Cross-platform route push (web, iOS, Android).
 * Prefer this over `useRouter().push` so same-path guards and SPA recovery stay consistent.
 */
export function usePushRoute() {
  const push = useCallback((href: Href | string) => {
    navigateApp(href)
  }, [])

  return { push, pushApp }
}
