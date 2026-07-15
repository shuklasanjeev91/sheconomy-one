import {
  isChatPath,
  isClassPath,
  isCoWorkPath,
  isCommercePath,
  isCommunityPath,
} from '~/lib/routes'

import type { SearchScope } from './types'
import { SEARCH_SCOPE_ALIASES, SEARCH_SCOPES } from './types'

/** Map the active app section to the default search scope. */
export function searchScopeFromPath(pathname: string): SearchScope {
  if (isCommunityPath(pathname)) {
    if (pathname.includes('/jobs')) return 'jobs'
    if (pathname.includes('/compan')) return 'companies'
    if (pathname.includes('/group')) return 'groups'
    if (pathname.includes('/post')) return 'posts'
    return 'people'
  }
  if (isClassPath(pathname)) return 'programs'
  if (isCoWorkPath(pathname)) {
    if (pathname.includes('/meeting')) return 'meetings'
    return 'all'
  }
  if (isChatPath(pathname)) return 'all'
  if (pathname === '/search' || pathname.startsWith('/search')) return 'all'
  if (isCommercePath(pathname)) {
    if (pathname.startsWith('/shops') || pathname.startsWith('/shop/')) return 'shops'
    if (pathname.startsWith('/category/') || pathname.startsWith('/browse/')) return 'categories'
    return 'listings'
  }
  return 'all'
}

export function parseSearchScope(value: string | string[] | null | undefined): SearchScope | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const normalized = raw.trim().toLowerCase()
  if ((SEARCH_SCOPES as readonly string[]).includes(normalized)) {
    return normalized as SearchScope
  }
  return SEARCH_SCOPE_ALIASES[normalized] ?? null
}

export function searchScopeFromRouteParams(
  params: Record<string, string | string[] | undefined | null>,
): SearchScope | null {
  return parseSearchScope(params.scope ?? null)
}

export function isSearchScope(value: string): value is SearchScope {
  return parseSearchScope(value) != null
}
