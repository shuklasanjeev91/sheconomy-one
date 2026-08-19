import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchBuyerPendingPaymentHomeCards,
  type BuyerPendingPaymentHomeCard,
} from '~/commerce/lib/buyer-pending-payment-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useBuyerPendingPaymentHome(limit = 3) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<BuyerPendingPaymentHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchBuyerPendingPaymentHomeCards(user.id, limit)
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

export type { BuyerPendingPaymentHomeCard }
