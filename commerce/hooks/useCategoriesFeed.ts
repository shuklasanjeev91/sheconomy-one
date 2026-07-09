import { useCallback } from 'react'

import {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  fetchCategoriesPage,
  type CategorySummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from './usePaginatedFeed'

export function useCategoriesFeed(enabled = true) {
  const fetchPage = useCallback(
    (page: number) => fetchCategoriesPage(page, COMMERCE_HORIZONTAL_PAGE_SIZE),
    [],
  )

  return usePaginatedFeed<CategorySummary>({ fetchPage, enabled })
}
