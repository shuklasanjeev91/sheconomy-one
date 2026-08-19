import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchPendingReviewHomeCards,
  type PendingReviewHomeCard,
} from '~/commerce/lib/pending-reviews-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function usePendingReviewsHome(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<PendingReviewHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchPendingReviewHomeCards(user.id, limit)
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

export type { PendingReviewHomeCard }
