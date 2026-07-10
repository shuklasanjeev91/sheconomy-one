import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchAllShopsForBrowse, type ShopSummary } from '~/commerce/lib/commerce'
import {
  applyShopBrowseFilters,
  DEFAULT_SHOP_BROWSE_FILTERS,
  extractShopCountries,
  type ShopBrowseFilters,
} from '~/commerce/lib/shop-filters'

export function useShopsBrowse() {
  const [items, setItems] = useState<ShopSummary[]>([])
  const [filters, setFilters] = useState<ShopBrowseFilters>(DEFAULT_SHOP_BROWSE_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await fetchAllShopsForBrowse()
    if (result.error) {
      setError(result.error)
      setItems([])
    } else {
      setItems(result.items)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const countries = useMemo(() => extractShopCountries(items), [items])
  const visibleItems = useMemo(() => applyShopBrowseFilters(items, filters), [filters, items])

  return {
    items: visibleItems,
    totalCount: items.length,
    countries,
    filters,
    setFilters,
    isLoading,
    error,
    refresh: load,
  }
}
