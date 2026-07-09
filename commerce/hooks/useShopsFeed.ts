import { useCallback } from 'react'

import {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  fetchShopsPage,
  type ShopSummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from './usePaginatedFeed'

export function useShopsFeed(enabled = true) {
  const fetchPage = useCallback(
    (page: number) => fetchShopsPage(page, COMMERCE_HORIZONTAL_PAGE_SIZE),
    [],
  )

  return usePaginatedFeed<ShopSummary>({ fetchPage, enabled })
}
