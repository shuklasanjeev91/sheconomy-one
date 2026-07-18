import type { LoaderProps } from 'one'

import {
  COMMERCE_PAGE_SIZE,
  fetchCategoryBySlug,
  fetchCategoryListingsPage,
  type CategorySummary,
  type ListingSummary,
} from '~/commerce/lib/commerce'
import {
  listingBrowseFiltersFromRouteParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { writeAppCache } from '~/lib/cache/app-cache'

export type CategoryLoaderResult = {
  category: CategorySummary | null
  listings: ListingSummary[]
  hasMore: boolean
  filters: ListingBrowseFilters
  error: string | null
}

export function categoryListingsCacheKey(categoryId: string, filters: ListingBrowseFilters) {
  return `${CACHE_KEYS.categoryListings(categoryId)}:${JSON.stringify(filters)}`
}

export async function fetchCategoryPageData(
  slug: string,
  filters: ListingBrowseFilters = {},
): Promise<CategoryLoaderResult> {
  const { data: category, error } = await fetchCategoryBySlug(slug)
  if (error) {
    return { category: null, listings: [], hasMore: false, filters, error }
  }
  if (!category) {
    return { category: null, listings: [], hasMore: false, filters, error: null }
  }

  const page = await fetchCategoryListingsPage(category.category_id, 0, COMMERCE_PAGE_SIZE, filters)
  if (!page.error) {
    void writeAppCache(categoryListingsCacheKey(category.category_id, filters), {
      items: page.items,
      page: 0,
      hasMore: page.hasMore,
    })
  }
  return {
    category,
    listings: page.items,
    hasMore: page.hasMore,
    filters,
    error: page.error,
  }
}

export async function categoryLoader({
  params,
  path,
  search,
}: LoaderProps<{ slug?: string }>): Promise<CategoryLoaderResult> {
  const slug = typeof params.slug === 'string' ? params.slug : params.slug?.[0]
  if (!slug) {
    return { category: null, listings: [], hasMore: false, filters: {}, error: 'Category not found' }
  }

  let filters: ListingBrowseFilters = {}
  const query = search ?? (typeof path === 'string' && path.includes('?') ? path.slice(path.indexOf('?') + 1) : '')
  if (query) {
    filters = listingBrowseFiltersFromRouteParams(Object.fromEntries(new URLSearchParams(query)))
  }

  return fetchCategoryPageData(slug, filters)
}
