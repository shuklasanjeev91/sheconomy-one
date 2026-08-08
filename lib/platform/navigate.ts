import { startTransition } from 'react'
import type { Href } from 'one'
import { router } from 'one'
import { Platform } from 'react-native'

import { consumeHumanVerificationHref } from '~/lib/gender-verification/open-request'

export type NavigateAppOptions = {
  /**
   * @deprecated Ignored — the app standardizes on `router.push` only.
   * Kept so existing call sites compile during migration.
   */
  replace?: boolean
}

function normalizeLocation(pathWithOptionalQuery: string): string {
  const [path = '/', query = ''] = pathWithOptionalQuery.split('?')
  const trimmed = path.replace(/\/$/, '')
  const normalizedPath = trimmed === '' ? '/' : trimmed
  return query ? `${normalizedPath}?${query}` : normalizedPath
}

function currentPathname(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname.replace(/\/$/, '') || '/'
  }
  return ''
}

function isCurrentLocation(href: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const current = `${window.location.pathname}${window.location.search}`
  return normalizeLocation(current) === normalizeLocation(href)
}

function samePathOnly(href: string): boolean {
  const [path = '/'] = href.split('?')
  const normalized = path.replace(/\/$/, '') || '/'
  const current = currentPathname()
  if (!current) return false
  return current === normalized
}

function isNavigatorNotReadyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /navigate before mounting the Root Layout|Root Layout/i.test(message)
}

function fallbackWebAssign(target: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const path = target.startsWith('http')
    ? target
    : `${window.location.origin}${target.startsWith('/') ? target : `/${target}`}`
  // Last-resort recovery only when the SPA router is not mounted yet.
  window.location.assign(path)
  return true
}

function pushTarget(target: Href): void {
  const go = () => {
    // Intentionally identical on web, iOS, and Android: One/Expo `router.push`.
    try {
      const outcome = router.push(target)
      if (outcome && typeof (outcome as Promise<unknown>).then === 'function') {
        void (outcome as Promise<unknown>).catch((error: unknown) => {
          if (isNavigatorNotReadyError(error)) {
            if (!fallbackWebAssign(String(target))) {
              setTimeout(go, 50)
            }
            return
          }
          console.warn('[navigateApp] navigation failed', target, error)
          fallbackWebAssign(String(target))
        })
      }
    } catch (error) {
      if (isNavigatorNotReadyError(error)) {
        if (!fallbackWebAssign(String(target))) {
          setTimeout(go, 50)
        }
        return
      }
      console.warn('[navigateApp] navigation failed', target, error)
      fallbackWebAssign(String(target))
    }
  }

  // Only scheduling differs: web can defer paint; native must push immediately.
  if (Platform.OS === 'web') {
    startTransition(go)
    return
  }
  go()
}

/**
 * Soft in-app navigation — **always** `router.push` on web, iOS, and Android.
 *
 * Cross-platform contract:
 * - Web + native share this single entry point (do not branch on Platform for push).
 * - Never uses `router.replace`.
 * - Keeps the Vite / Expo SPA shell mounted (no hard reload for normal navigations).
 * - `?human=verify` opens Human verification immediately (even when already on `/`).
 *
 * Prefer `navigateApp` / `pushApp` / `AppLink` / `usePushRoute` over calling
 * `useRouter().push` directly so same-path guards and mount-retry stay consistent.
 */
export function navigateApp(href: Href | string, _options?: NavigateAppOptions): void {
  const rawTarget = typeof href === 'string' ? href : String(href)

  // Human verification intent — open modal even if the path would not change
  // (native often no-ops same-route query-only pushes).
  const verifyNav = consumeHumanVerificationHref(rawTarget)
  if (verifyNav) {
    const next = verifyNav.cleanedHref
    if (isCurrentLocation(next) || samePathOnly(next)) {
      return
    }
    pushTarget(next as Href)
    return
  }

  if (isCurrentLocation(rawTarget)) return
  pushTarget(rawTarget as Href)
}

/** @deprecated Use `navigateApp` / `pushApp` — also `router.push` only. */
export function replaceApp(href: Href | string): void {
  navigateApp(href)
}

/** Alias for `navigateApp` — soft `router.push`. */
export function pushApp(href: Href | string): void {
  navigateApp(href)
}
