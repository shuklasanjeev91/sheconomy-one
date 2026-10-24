import type { AccessTier } from '~/lib/auth/access'

import { searchProfilesForIntent } from '~/community/lib/network'
import { federatedSearch, flattenFederatedHits } from '~/lib/search/federate'
import { getAppSearchHistorySnapshot } from '~/lib/search/history'
import { communityRoutes } from '~/lib/routes'
import { searchScopeFromPath } from '~/lib/search/scope-from-path'
import {
  suggestAsksForWomen,
  suggestFocusTokens,
  suggestIntent,
  suggestScope,
} from '~/lib/search/suggest-intent'
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
  const scope = suggestScope(trimmed) ?? options.scope ?? searchScopeFromPath(options.pathname ?? '/')
  const limit = options.limit ?? 12

  if (!trimmed) {
    return {
      query: '',
      recent: getAppSearchHistorySnapshot().slice(0, 8),
      hits: [],
      blockedScopes: [],
    }
  }

  if (suggestIntent(trimmed) === 'person') {
    const rows = await searchProfilesForIntent(
      suggestFocusTokens(trimmed),
      limit,
      suggestAsksForWomen(trimmed),
      options.memberLocation ?? '',
    )
    return {
      query: trimmed,
      recent: [],
      hits: rows.map((row) => {
        const handle = row.username?.trim() || row.id
        return {
          kind: 'person' as const,
          id: row.id,
          title: row.full_name?.trim() || row.username || 'Member',
          subtitle: row.occupation || row.headline || (row.username ? `@${row.username}` : null),
          imageUrl: row.avatar_url,
          href: String(communityRoutes.userProfile(handle)),
          username: row.username,
        }
      }),
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
