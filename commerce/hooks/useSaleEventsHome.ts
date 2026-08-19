import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchBuyerSaleEventHomeCards,
  type BuyerSaleEventHomeCard,
} from '~/commerce/lib/sale-events-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useSaleEventsHome(limit = 3) {
  const [cards, setCards] = useState<BuyerSaleEventHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await fetchBuyerSaleEventHomeCards(limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceSaleEvents], () => {
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

export type { BuyerSaleEventHomeCard }
