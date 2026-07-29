import type { AccessTier } from '~/lib/auth/access'

import { federatedSearch, flattenFederatedHits } from '~/lib/search/federate'
import { getAppSearchHistorySnapshot } from '~/lib/search/history'
import { searchScopeFromPath } from '~/lib/search/scope-from-path'
import type { SearchScope, SearchSuggestResult } from '~/lib/search/types'

export type SuggestOptions = {
  tier: AccessTier
  pathname?: string
  scope?: SearchScope
  limit?: number
  userId?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * Typeahead payload: recent terms when empty; federated top hits when typing.
 */
export async function searchSuggest(
  query: string,
  options: SuggestOptions,
): Promise<SearchSuggestResult> {
  const trimmed = query.trim()
  const scope = options.scope ?? searchScopeFromPath(options.pathname ?? '/')
  const limit = options.limit ?? 12

  if (!trimmed) {
    return {
      query: '',
      recent: getAppSearchHistorySnapshot().slice(0, 8),
      hits: [],
      blockedScopes: [],
    }
  }

  const result = await federatedSearch(trimmed, {
    scope,
    limitPerScope: limit,
    tier: options.tier,
    userId: options.userId,
    latitude: options.latitude,
    longitude: options.longitude,
  })

  return {
    query: trimmed,
    recent: [],
    hits: flattenFederatedHits(result, scope).slice(0, limit * 3),
    blockedScopes: result.blockedScopes,
  }
}
