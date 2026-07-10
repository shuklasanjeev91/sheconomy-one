import { useCallback, useEffect, useState } from 'react'

import {
  fetchShopDashboard,
  type ShopDashboardData,
} from '~/commerce/lib/seller-dashboard'

export function useShopDashboard(shopId: string | null | undefined, enabled = true) {
  const [data, setData] = useState<ShopDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!shopId || !enabled) {
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const next = await fetchShopDashboard(shopId)
      setData(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shop dashboard.')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, shopId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, isLoading, error, refresh }
}
