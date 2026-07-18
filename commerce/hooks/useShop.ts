import { useCallback, useEffect, useState } from 'react'

import {
  fetchShopDetail,
  type ShopDetail,
  type ShopLoaderResult,
} from '~/commerce/lib/shop-loader'

export type { ShopAddress, ShopOwnerProfile } from '~/commerce/lib/shop-location'
export type { ShopDetail } from '~/commerce/lib/shop-loader'

export function useShop(shopRef?: string, initial?: ShopLoaderResult | null) {
  const hasInitial = Boolean(initial?.data || initial?.error)
  const [shop, setShop] = useState<ShopDetail | null>(initial?.data ?? null)
  const [isLoading, setIsLoading] = useState(!hasInitial && Boolean(shopRef))
  const [error, setError] = useState<string | null>(initial?.error ?? null)

  const load = useCallback(async () => {
    if (!shopRef) {
      setShop(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await fetchShopDetail(shopRef)
    setShop(result.data)
    setError(result.error)
    setIsLoading(false)
  }, [shopRef])

  useEffect(() => {
    if (initial?.data || initial?.error) {
      setShop(initial.data)
      setError(initial.error)
      setIsLoading(false)
      return
    }

    let cancelled = false
    void load().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [load, initial?.data, initial?.error])

  return { shop, isLoading, error, refresh: load }
}
