import { useCallback } from 'react'

import {
  COMMERCE_PAGE_SIZE,
  searchListingsPage,
  type ListingBrowseFilters,
  type ListingSummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

type UseSearchListingsOptions = {
  query: string
  filters?: ListingBrowseFilters
  pageSize?: number
  enabled?: boolean
}

export function useSearchListings({
  query,
  filters,
  pageSize = COMMERCE_PAGE_SIZE,
  enabled = true,
}: UseSearchListingsOptions) {
  // Compare by value so parent object identity churn does not restart the feed.
  const filterKey = JSON.stringify(filters ?? {})

  const fetchPage = useCallback(
    (page: number) => {
      const parsed = JSON.parse(filterKey) as ListingBrowseFilters
      return searchListingsPage(query, page, { pageSize, ...parsed })
    },
    [query, filterKey, pageSize],
  )

  return usePaginatedFeed<ListingSummary>({
    fetchPage,
    enabled: enabled && query.trim().length > 0,
  })
}
