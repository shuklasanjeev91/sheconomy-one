import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchVendorFulfillmentHomeCards,
  type VendorFulfillmentHomeCard,
} from '~/commerce/lib/vendor-fulfillment-home'
import { useVendorShops } from '~/hooks/useVendorShops'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useVendorFulfillmentHome(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const { primaryShopId, isLoading: shopsLoading } = useVendorShops()
  const [cards, setCards] = useState<VendorFulfillmentHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id || !primaryShopId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchVendorFulfillmentHomeCards(primaryShopId, user.id, limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit, primaryShopId, user?.id])

  useEffect(() => {
    if (authLoading || shopsLoading) return
    void reload()
  }, [authLoading, reload, shopsLoading])

  useAutoRefresh([INVALIDATION_TOPICS.commerceOrders], () => {
    if (authLoading || shopsLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading: authLoading || shopsLoading || loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [authLoading, cards, loading, reload, shopsLoading],
  )
}

export type { VendorFulfillmentHomeCard }
