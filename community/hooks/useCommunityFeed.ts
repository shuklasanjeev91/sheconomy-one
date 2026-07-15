import { useCallback } from 'react'

import {
  fetchCommunityFeedPage,
  type CommunityPost,
  type FeedContentFilter,
  type FeedSort,
} from '~/community/lib/community'

import { usePaginatedFeed } from '../../commerce/hooks/usePaginatedFeed'

export function useCommunityFeed(
  enabled = true,
  sort: FeedSort = 'recent',
  feed?: FeedContentFilter,
) {
  const fetchPage = useCallback(
    (page: number) => fetchCommunityFeedPage(page, undefined, sort, feed),
    [feed, sort],
  )

  return usePaginatedFeed<CommunityPost>({ fetchPage, enabled })
}
