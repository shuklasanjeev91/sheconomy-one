import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchBuyerReturnHomeCards,
  type BuyerReturnHomeCard,
} from '~/commerce/lib/buyer-return-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useBuyerReturnHomeStrip(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<BuyerReturnHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (silent = false) => {
      if (!user?.id) {
        setCards([])
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      const result = await fetchBuyerReturnHomeCards(user.id, limit)
      setCards(result.cards)
      setLoading(false)
    },
    [limit, user?.id],
  )

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceOrders], () => {
    if (authLoading) return
    void reload(true)
  })

  return useMemo(
    () => ({
      cards,
      loading: authLoading || loading,
      hasCards: cards.length > 0,
      refresh: () => reload(true),
    }),
    [authLoading, cards, loading, reload],
  )
}

export type { BuyerReturnHomeCard }
