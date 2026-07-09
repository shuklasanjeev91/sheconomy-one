import { useCallback } from 'react'

import {
  fetchCommunityFeedPage,
  type CommunityPost,
  type FeedSort,
} from '~/community/lib/community'

import { usePaginatedFeed } from '../../commerce/hooks/usePaginatedFeed'

export function useCommunityFeed(enabled = true, sort: FeedSort = 'recent') {
  const fetchPage = useCallback(
    (page: number) => fetchCommunityFeedPage(page, undefined, sort),
    [sort],
  )

  return usePaginatedFeed<CommunityPost>({ fetchPage, enabled })
}
