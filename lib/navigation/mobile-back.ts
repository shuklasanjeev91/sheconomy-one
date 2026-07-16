import type { Href } from 'one'

import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  isChatPath,
  isClassPath,
  isCoWorkPath,
  isCommercePath,
  isCommunityPath,
  routes,
} from '~/lib/routes'

/** Root section landings — no back control while browsing section home. */
const MOBILE_ROOT_PATHS = new Set([
  '/',
  '/community',
  '/chat',
  '/class',
  '/class/video',
  '/class/audio',
  '/co-work',
  /** Settings hub list — drill into sections, then back here. */
  '/settings',
])

export function isMobileRootPath(pathname: string): boolean {
  if (!pathname) return true
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return MOBILE_ROOT_PATHS.has(normalized)
}

/** Whether the mobile chrome should show a back control for this route. */
export function shouldShowMobileBack(pathname: string): boolean {
  if (!pathname || pathname.startsWith('/ui-kit')) return false
  if (/\/co-work\/meeting\/[^/]+\/live/.test(pathname)) return false
  if (/\/chat\/call\//.test(pathname)) return false
  if (pathname.startsWith('/auth/')) return false
  return !isMobileRootPath(pathname)
}

/** Fallback destination when history cannot go back. */
export function getMobileBackFallback(pathname: string): Href {
  if (pathname.startsWith('/listing/') || pathname.startsWith('/shop/')) {
    return commerceRoutes.shops
  }
  if (pathname.startsWith('/category/') || pathname.startsWith('/browse/')) {
    return commerceRoutes.home
  }
  if (pathname.startsWith('/search')) {
    return commerceRoutes.home
  }
  if (pathname.startsWith('/favorites')) {
    return commerceRoutes.home
  }
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) {
    return commerceRoutes.home
  }
  if (pathname.startsWith('/vendor') || pathname.startsWith('/create-my-shop')) {
    return commerceRoutes.home
  }
  if (pathname.startsWith('/settings/')) {
    return routes.settings
  }
  if (pathname === '/settings' || pathname.startsWith('/profile') || pathname.startsWith('/notifications')) {
    return communityRoutes.home
  }
  if (pathname.startsWith('/community')) {
    if (pathname.startsWith('/community/jobs/')) return communityRoutes.jobs
    if (pathname.startsWith('/community/group/')) return communityRoutes.groups
    if (pathname.startsWith('/community/company/')) return communityRoutes.companies
    if (pathname.startsWith('/community/events/')) return communityRoutes.events
    if (pathname.startsWith('/community/stories/')) return communityRoutes.stories
    return communityRoutes.home
  }
  if (isCoWorkPath(pathname)) {
    if (pathname.includes('/meeting/')) return coWorkRoutes.meetings
    return coWorkRoutes.home
  }
  if (isClassPath(pathname)) return classRoutes.home
  if (isChatPath(pathname)) return chatRoutes.home
  if (isCommercePath(pathname)) return commerceRoutes.home
  if (isCommunityPath(pathname)) return communityRoutes.home
  return routes.home
}
