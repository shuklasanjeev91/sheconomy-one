import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchBuyerInTransitHomeCards,
  type BuyerInTransitHomeCard,
} from '~/commerce/lib/buyer-in-transit-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useBuyerInTransitHome(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<BuyerInTransitHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchBuyerInTransitHomeCards(user.id, limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceOrders], () => {
    if (authLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading: authLoading || loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [authLoading, cards, loading, reload],
  )
}

export type { BuyerInTransitHomeCard }
