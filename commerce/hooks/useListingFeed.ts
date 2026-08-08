import { useCallback } from 'react'

import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import {
  COMMERCE_PAGE_SIZE,
  fetchListingFeedPage,
  type ListingFeedKind,
  type ListingSummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

type UseListingFeedOptions = {
  kind: ListingFeedKind
  shopId?: string
  pageSize?: number
  enabled?: boolean
  /** Prefetch page N+1 after a successful load (disable on home first-page rails). */
  prefetchNext?: boolean
}

export function useListingFeed({
  kind,
  shopId,
  pageSize = COMMERCE_PAGE_SIZE,
  enabled = true,
  prefetchNext = true,
}: UseListingFeedOptions) {
  const fetchPage = useCallback(
    (page: number) => fetchListingFeedPage(kind, page, { pageSize, shopId }),
    [kind, pageSize, shopId],
  )

  // Shop-scoped feeds are unique per shop; only share the home section keys.
  const cacheKey = shopId ? undefined : CACHE_KEYS.listingFeed(kind)

  return usePaginatedFeed<ListingSummary>({ fetchPage, enabled, cacheKey, prefetchNext })
}
