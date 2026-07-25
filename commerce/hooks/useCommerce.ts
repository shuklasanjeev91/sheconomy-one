import { useCallback } from 'react'

import {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  COMMERCE_PAGE_SIZE,
  fetchListingFeedPage,
  fetchShopsPage,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'
import type { ListingSummary, ShopSummary } from '~/lib/supabase/commerce'

export function useCommerce() {
  const fetchShopsPageFn = useCallback(
    (page: number) => fetchShopsPage(page, COMMERCE_HORIZONTAL_PAGE_SIZE),
    [],
  )
  const fetchListingsPageFn = useCallback(
    (page: number) => fetchListingFeedPage('latest', page, { pageSize: COMMERCE_PAGE_SIZE }),
    [],
  )

  const shopsFeed = usePaginatedFeed<ShopSummary>({ fetchPage: fetchShopsPageFn })
  const listingsFeed = usePaginatedFeed<ListingSummary>({ fetchPage: fetchListingsPageFn })

  return {
    shops: shopsFeed.items,
    listings: listingsFeed.items,
    isLoading: shopsFeed.isLoading || listingsFeed.isLoading,
    isLoadingMore: shopsFeed.isLoadingMore || listingsFeed.isLoadingMore,
    hasMore: shopsFeed.hasMore || listingsFeed.hasMore,
    error: shopsFeed.error ?? listingsFeed.error,
    loadMoreShops: shopsFeed.loadMore,
    loadMoreListings: listingsFeed.loadMore,
    refresh: () => {
      shopsFeed.refresh()
      listingsFeed.refresh()
    },
  }
}
