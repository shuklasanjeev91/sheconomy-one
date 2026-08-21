import { useCallback } from 'react'

import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import {
  CATEGORY_RAIL_PAGE_SIZE,
  fetchCategoriesPage,
  type CategorySummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

export function useCategoriesFeed(enabled = true) {
  const fetchPage = useCallback(
    (page: number) => fetchCategoriesPage(page, CATEGORY_RAIL_PAGE_SIZE),
    [],
  )

  return usePaginatedFeed<CategorySummary>({
    fetchPage,
    enabled,
    cacheKey: CACHE_KEYS.categories,
  })
}
