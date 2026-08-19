import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchVendorIssuesHomeCards,
  type VendorIssuesHomeCard,
} from '~/commerce/lib/vendor-issues-home'
import { useVendorShops } from '~/hooks/useVendorShops'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useVendorIssuesHome(limit = 5) {
  const { isLoading: authLoading } = useSupabase()
  const { primaryShopId, isLoading: shopsLoading } = useVendorShops()
  const [cards, setCards] = useState<VendorIssuesHomeCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!primaryShopId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchVendorIssuesHomeCards(primaryShopId, limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit, primaryShopId])

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

export type { VendorIssuesHomeCard }
