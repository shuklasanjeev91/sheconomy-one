import type { AccessTier } from '~/lib/auth/access'

import { federatedSearch, flattenFederatedHits } from '~/lib/search/federate'
import { getAppSearchHistorySnapshot } from '~/lib/search/history'
import { orderSuggestHits } from '~/lib/search/suggest-intent'
import type { SearchScope, SearchSuggestResult } from '~/lib/search/types'

export type SuggestOptions = {
  tier: AccessTier
  pathname?: string
  scope?: SearchScope
  limit?: number
  userId?: string | null
  latitude?: number | null
  longitude?: number | null
  memberLocation?: string | null
}

/**
 * Typeahead payload: recent terms when empty; federated top hits when typing.
 */
export async function searchSuggest(
  query: string,
  options: SuggestOptions,
): Promise<SearchSuggestResult> {
  const trimmed = query.trim()
  const perScope = 4
  const total = options.limit ?? 24

  if (!trimmed) {
    return {
      query: '',
      recent: getAppSearchHistorySnapshot().slice(0, 8),
      hits: [],
      blockedScopes: [],
    }
  }

  const result = await federatedSearch(trimmed, {
    scope: 'all',
    limitPerScope: perScope,
    tier: options.tier,
    userId: options.userId,
    latitude: options.latitude,
    longitude: options.longitude,
    memberLocation: options.memberLocation,
  })

  return {
    query: trimmed,
    recent: [],
    hits: orderSuggestHits(flattenFederatedHits(result, 'all'), trimmed).slice(0, total),
    blockedScopes: result.blockedScopes,
  }
}
