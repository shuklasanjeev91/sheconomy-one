import { useCallback, useEffect, useState } from 'react'

import {
  fetchSellerListings,
  type SellerListingRow,
} from '~/commerce/lib/seller-dashboard'
import type { Database } from '~/lib/supabase'

type ListingStatus = Database['public']['Enums']['listing_status_enum'] | 'all'

export function useSellerListings(
  shopId: string | null | undefined,
  options?: { status?: ListingStatus; search?: string; enabled?: boolean },
) {
  const enabled = options?.enabled !== false
  const status = options?.status ?? 'all'
  const search = options?.search ?? ''

  const [items, setItems] = useState<SellerListingRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!shopId || !enabled) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const rows = await fetchSellerListings(shopId, { status, search })
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load listings.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, search, shopId, status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { items, isLoading, error, refresh }
}
