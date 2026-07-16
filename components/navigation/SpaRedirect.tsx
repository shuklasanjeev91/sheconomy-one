import type { Href } from 'one'
import { usePathname } from 'one'
import { useEffect, useRef } from 'react'

import { Spinner, YStack } from '~/components/ui'
import { replaceApp } from '~/lib/platform/navigate'

type SpaRedirectProps = {
  href: Href | string
}

function normalizePath(path: string): string {
  const bare = path.split('?')[0]?.split('#')[0] ?? '/'
  const trimmed = bare.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** True when navigating to `href` would be a no-op (avoids replace loops). */
function isAlreadyAtHref(pathname: string, href: string): boolean {
  const [targetPath, targetQuery = ''] = href.split('?')
  if (normalizePath(pathname) !== normalizePath(targetPath ?? '/')) return false

  if (typeof window === 'undefined') {
    return !targetQuery
  }

  const currentQuery = window.location.search.replace(/^\?/, '')
  return currentQuery === targetQuery
}

/**
 * Soft SPA redirect via `router.replace` — never hard-reloads the shell.
 * Drop-in for One's `<Redirect href=… />` on web, iOS, and Android.
 *
 * Guards against same-path replace loops that blank the app (max update depth).
 */
export function SpaRedirect({ href }: SpaRedirectProps) {
  const pathname = usePathname()
  const target = String(href)
  const didNavigate = useRef(false)

  useEffect(() => {
    if (didNavigate.current) return
    if (isAlreadyAtHref(pathname, target)) return
    didNavigate.current = true
    replaceApp(target)
  }, [pathname, target])

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" minHeight={120} padding="$4">
      <Spinner size="small" />
    </YStack>
  )
}
