import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchExpiringOfferHomeCards,
  type ExpiringOfferHomeCard,
} from '~/commerce/lib/expiring-offers-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useExpiringOffersHome(limit = 3) {
  const [cards, setCards] = useState<ExpiringOfferHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await fetchExpiringOfferHomeCards(limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceListings], () => {
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [cards, loading, reload],
  )
}

export type { ExpiringOfferHomeCard }
