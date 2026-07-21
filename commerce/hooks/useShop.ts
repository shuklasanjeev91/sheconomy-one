import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchShopDetail,
  type ShopDetail,
  type ShopLoaderResult,
} from '~/commerce/lib/shop-loader'

export type { ShopAddress, ShopOwnerProfile } from '~/commerce/lib/shop-location'
export type { ShopDetail } from '~/commerce/lib/shop-loader'

type UseShopOptions = {
  /**
   * Parent route loader is still in flight — wait instead of starting a second
   * fetch (avoids double network + spinner thrash on native shop routes).
   */
  awaitingInitial?: boolean
}

export function useShop(
  shopRef?: string,
  initial?: ShopLoaderResult | null,
  options: UseShopOptions = {},
) {
  const { awaitingInitial = false } = options
  const hasInitial = Boolean(initial?.data || initial?.error)
  const [shop, setShop] = useState<ShopDetail | null>(initial?.data ?? null)
  const [isLoading, setIsLoading] = useState(!hasInitial && Boolean(shopRef))
  const [error, setError] = useState<string | null>(initial?.error ?? null)
  const requestGen = useRef(0)

  const load = useCallback(async () => {
    if (!shopRef) {
      setShop(null)
      setIsLoading(false)
      setError(null)
      return
    }

    const gen = ++requestGen.current
    setIsLoading(true)
    setError(null)
    const result = await fetchShopDetail(shopRef)
    if (requestGen.current !== gen) return
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

    if (awaitingInitial) {
      setIsLoading(true)
      return
    }

    let cancelled = false
    void load().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
      requestGen.current += 1
    }
  }, [load, initial?.data, initial?.error, awaitingInitial])

  return { shop, isLoading, error, refresh: load }
}
