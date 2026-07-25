import { useCallback } from 'react'

import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  fetchShopsPage,
  type ShopSummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

export function useShopsFeed(enabled = true) {
  const fetchPage = useCallback(
    (page: number) => fetchShopsPage(page, COMMERCE_HORIZONTAL_PAGE_SIZE),
    [],
  )

  return usePaginatedFeed<ShopSummary>({
    fetchPage,
    enabled,
    cacheKey: CACHE_KEYS.shops,
  })
}
