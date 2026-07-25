import { useCallback } from 'react'

import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import {
  fetchCommunityFeedPage,
  type CommunityPost,
  type FeedContentFilter,
  type FeedSort,
} from '~/community/lib/community'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

function communityCacheKey(sort: FeedSort, feed?: FeedContentFilter) {
  return feed ? `${CACHE_KEYS.community}:${sort}:${feed}` : `${CACHE_KEYS.community}:${sort}`
}

export function useCommunityFeed(
  enabled = true,
  sort: FeedSort = 'recent',
  feed?: FeedContentFilter,
) {
  const fetchPage = useCallback(
    (page: number) => fetchCommunityFeedPage(page, undefined, sort, feed),
    [feed, sort],
  )

  return usePaginatedFeed<CommunityPost>({
    fetchPage,
    enabled,
    cacheKey: communityCacheKey(sort, feed),
  })
}
