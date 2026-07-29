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
  const fetchPage = useCallback(
    (page: number) => searchListingsPage(query, page, { pageSize, ...filters }),
    [query, filters, pageSize],
  )

  return usePaginatedFeed<ListingSummary>({
    fetchPage,
    enabled: enabled && query.trim().length > 0,
  })
}
