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
  if (!isSafeReturnPath(returnTo ?? null)) {
    return appRoutes.signIn
  }

  const params = new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: returnTo })
  return `/auth/sign-in?${params.toString()}` as Href
}
