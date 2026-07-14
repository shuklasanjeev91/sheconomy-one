import type { Href } from 'one'
import { Platform } from 'react-native'

import { appRoutes } from '~/lib/routes'
import { getSearchParam } from '~/lib/platform/url'

export const AUTH_RETURN_TO_PARAM = 'returnTo'

const BLOCKED_RETURN_PREFIXES = ['/auth'] as const

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false
  return !BLOCKED_RETURN_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function getReturnToFromLocation(): Href {
  if (Platform.OS !== 'web') return '/' as Href

  const value = getSearchParam(AUTH_RETURN_TO_PARAM)
  return (isSafeReturnPath(value) ? value : '/') as Href
}

export function buildSignInUrl(returnTo?: string | null): Href {
  const target = returnTo ?? null
  if (!isSafeReturnPath(target)) {
    return appRoutes.signIn
  }

  const params = new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: target })
  return `/auth/sign-in?${params.toString()}` as Href
}

/**
 * Current path + query + hash (web), or `fallback` off-web. Used by the route
 * protection layer to remember where a guest was headed before sign-in.
 */
export function getCurrentPathWithSearch(fallback = '/'): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) {
    return fallback
  }
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}` || fallback
}

/**
 * Turn any candidate redirect target into a safe in-app path, never pointing
 * back at the auth screens (avoids post-login redirect loops).
 */
export function normalizeReturnPath(target: string | null | undefined, fallback = '/'): string {
  return isSafeReturnPath(target ?? null) ? (target as string) : fallback
}
