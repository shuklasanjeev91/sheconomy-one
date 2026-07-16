import { useCallback, useEffect, useState } from 'react'

import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import {
  COMMERCE_PAGE_SIZE,
  fetchShopsBrowsePage,
  type ShopSummary,
} from '~/commerce/lib/commerce'
import {
  DEFAULT_SHOP_BROWSE_FILTERS,
  extractShopCountries,
  type ShopBrowseFilters,
} from '~/commerce/lib/shop-filters'
import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'
import { peekAppCache, writeAppCache } from '~/lib/cache/app-cache'

const COUNTRIES_CACHE_KEY = `${CACHE_KEYS.shopsBrowse}:countries`

export function useShopsBrowse() {
  const [filters, setFilters] = useState<ShopBrowseFilters>(DEFAULT_SHOP_BROWSE_FILTERS)
  const [countries, setCountries] = useState<string[]>(
    () => peekAppCache<string[]>(COUNTRIES_CACHE_KEY) ?? [],
  )

  const fetchPage = useCallback(
    (page: number) =>
      fetchShopsBrowsePage(page, COMMERCE_PAGE_SIZE, {
        sort: filters.sort,
        country: filters.country,
      }),
    [filters.country, filters.sort],
  )

  const feed = usePaginatedFeed<ShopSummary>({
    fetchPage,
    cacheKey: `${CACHE_KEYS.shopsBrowse}:${filters.sort}:${filters.country}`,
  })

  useEffect(() => {
    const fromItems = extractShopCountries(feed.items)
    if (!fromItems.length) return
    setCountries((current) => {
      const next = Array.from(new Set([...current, ...fromItems])).sort((a, b) =>
        a.localeCompare(b),
      )
      void writeAppCache(COUNTRIES_CACHE_KEY, next)
      return next
    })
  }, [feed.items])

  useEffect(() => {
    if (countries.length > 0) return
    let cancelled = false
    void fetchShopsBrowsePage(0, COMMERCE_PAGE_SIZE, { sort: 'name_asc' }).then((result) => {
      if (cancelled || result.error) return
      const next = extractShopCountries(result.items)
      if (next.length) {
        setCountries(next)
        void writeAppCache(COUNTRIES_CACHE_KEY, next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [countries.length])

  return {
    items: feed.items,
    totalCount: feed.items.length,
    hasMore: feed.hasMore,
    isLoading: feed.isLoading,
    isLoadingMore: feed.isLoadingMore,
    isRefreshing: feed.isRefreshing,
    countries,
    filters,
    setFilters,
    error: feed.error,
    loadMore: feed.loadMore,
    refresh: feed.refresh,
  }
}
