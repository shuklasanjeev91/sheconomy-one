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

function isNavigatorNotReadyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /navigate before mounting the Root Layout|Root Layout/i.test(message)
}

/**
 * Soft SPA redirect via `router.replace` — never hard-reloads the shell.
 * Drop-in for One's `<Redirect href=… />` on web, iOS, and Android.
 *
 * Guards against same-path replace loops that blank the app (max update depth).
 * Retries when the root navigator is not mounted yet (common on cold auth routes).
 */
export function SpaRedirect({ href }: SpaRedirectProps) {
  const pathname = usePathname()
  const target = String(href)
  const didNavigate = useRef(false)

  useEffect(() => {
    if (didNavigate.current) return
    if (isAlreadyAtHref(pathname, target)) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 30
    let timer: ReturnType<typeof setTimeout> | undefined

    const tryNavigate = () => {
      if (cancelled || didNavigate.current) return
      try {
        replaceApp(target)
        didNavigate.current = true
      } catch (error) {
        attempts += 1
        if (attempts >= maxAttempts || !isNavigatorNotReadyError(error)) {
          console.warn('[SpaRedirect] replace failed', target, error)
          return
        }
        timer = setTimeout(tryNavigate, 50)
      }
    }

    // Defer past the current commit so Root Layout can finish mounting.
    timer = setTimeout(tryNavigate, 0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pathname, target])

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" minHeight={120} padding="$4">
      <Spinner size="small" />
    </YStack>
  )
}
