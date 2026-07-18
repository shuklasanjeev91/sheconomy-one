import { useCallback, useEffect, useMemo, useState } from 'react'

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
import { getFollowedShops } from '~/lib/shop/shop.service'
import { useSupabase } from '~/providers/SupabaseProvider'

const COUNTRIES_CACHE_KEY = `${CACHE_KEYS.shopsBrowse}:countries`

export function useShopsBrowse() {
  const { user } = useSupabase()
  const [filters, setFilters] = useState<ShopBrowseFilters>(DEFAULT_SHOP_BROWSE_FILTERS)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [countries, setCountries] = useState<string[]>(
    () => peekAppCache<string[]>(COUNTRIES_CACHE_KEY) ?? [],
  )

  useEffect(() => {
    if (!user?.id || !filters.followingOnly) return
    let cancelled = false
    void getFollowedShops(user.id).then((result) => {
      if (cancelled) return
      setFollowedIds(new Set((result.data ?? []).map((shop) => shop.id)))
    })
    return () => {
      cancelled = true
    }
  }, [filters.followingOnly, user?.id])

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

  const items = useMemo(() => {
    if (!filters.followingOnly) return feed.items
    return feed.items.filter((shop) => followedIds.has(shop.id))
  }, [feed.items, filters.followingOnly, followedIds])

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
    items,
    totalCount: items.length,
    hasMore: filters.followingOnly ? false : feed.hasMore,
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
