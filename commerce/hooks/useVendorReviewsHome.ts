import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchVendorReviewsHomeCards,
  type VendorReviewsHomeCard,
} from '~/commerce/lib/vendor-reviews-home'
import { useVendorShops } from '~/hooks/useVendorShops'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useVendorReviewsHome(limit = 5) {
  const { primaryShopId, isLoading: shopsLoading } = useVendorShops()
  const [cards, setCards] = useState<VendorReviewsHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!primaryShopId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchVendorReviewsHomeCards(primaryShopId, limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit, primaryShopId])

  useEffect(() => {
    if (shopsLoading) return
    void reload()
  }, [reload, shopsLoading])

  useAutoRefresh([INVALIDATION_TOPICS.commerceListings], () => {
    if (shopsLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading: shopsLoading || loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [cards, loading, reload, shopsLoading],
  )
}

export type { VendorReviewsHomeCard }
