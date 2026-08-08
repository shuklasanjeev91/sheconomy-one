import type { Href } from 'one'
import { usePathname } from 'one'
import { useEffect, useRef } from 'react'

import { Spinner, YStack } from '~/components/ui'
import { consumeHumanVerificationHref } from '~/lib/gender-verification/open-request'
import { navigateApp } from '~/lib/platform/navigate'

type SpaRedirectProps = {
  href: Href | string
}

function normalizePath(path: string): string {
  const bare = path.split('?')[0]?.split('#')[0] ?? '/'
  const trimmed = bare.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** True when navigating to `href` would be a no-op (avoids push loops). */
function isAlreadyAtHref(pathname: string, href: string): boolean {
  const [targetPath, targetQuery = ''] = href.split('?')
  if (normalizePath(pathname) !== normalizePath(targetPath ?? '/')) return false

  if (typeof window === 'undefined') {
    // Native: query-only diffs still count as navigation.
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
 * Soft SPA redirect via `router.push` — never hard-reloads the shell.
 * Human verification redirects open the modal even when already on the safe path.
 */
export function SpaRedirect({ href }: SpaRedirectProps) {
  const pathname = usePathname()
  const rawTarget = String(href)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    // Open Human verification before any same-path early return.
    const verifyNav = consumeHumanVerificationHref(rawTarget)
    const target = verifyNav?.cleanedHref ?? rawTarget

    if (isAlreadyAtHref(pathname, target)) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 30
    let timer: ReturnType<typeof setTimeout> | undefined

    const tryNavigate = () => {
      if (cancelled) return
      try {
        // Pass cleaned target so navigateApp does not re-fire verify open.
        navigateApp(target)
      } catch (error) {
        attempts += 1
        if (attempts >= maxAttempts || !isNavigatorNotReadyError(error)) {
          console.warn('[SpaRedirect] push failed', target, error)
          if (typeof window !== 'undefined') {
            window.location.assign(
              target.startsWith('http')
                ? target
                : `${window.location.origin}${target.startsWith('/') ? target : `/${target}`}`,
            )
          }
          return
        }
        timer = setTimeout(tryNavigate, 50)
      }
    }

    timer = setTimeout(tryNavigate, 0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pathname, rawTarget])

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" minHeight={120} padding="$4">
      <Spinner size="small" />
    </YStack>
  )
}
