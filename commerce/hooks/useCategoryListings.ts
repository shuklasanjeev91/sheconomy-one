import { useCallback } from 'react'

import {
  categoryListingsCacheKey,
} from '~/commerce/lib/category-loader'
import {
  COMMERCE_PAGE_SIZE,
  fetchCategoryListingsPage,
  type ListingBrowseFilters,
  type ListingSummary,
} from '~/lib/supabase/commerce'

import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'

type UseCategoryListingsOptions = {
  categoryId?: string
  filters?: ListingBrowseFilters
  pageSize?: number
  enabled?: boolean
}

export function useCategoryListings({
  categoryId,
  filters = {},
  pageSize = COMMERCE_PAGE_SIZE,
  enabled = true,
}: UseCategoryListingsOptions) {
  const fetchPage = useCallback(
    (page: number) => {
      if (!categoryId) {
        return Promise.resolve({
          items: [] as ListingSummary[],
          page,
          pageSize,
          hasMore: false,
          error: 'Category not found',
        })
      }
      return fetchCategoryListingsPage(categoryId, page, pageSize, filters)
    },
    [categoryId, filters, pageSize],
  )

  const cacheKey = categoryId ? categoryListingsCacheKey(categoryId, filters) : undefined

  return usePaginatedFeed<ListingSummary>({
    fetchPage,
    enabled: enabled && !!categoryId,
    cacheKey,
  })
}
