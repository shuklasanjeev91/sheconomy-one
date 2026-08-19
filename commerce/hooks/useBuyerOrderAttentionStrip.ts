import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchBuyerOrderAttentionItems,
  type BuyerOrderAttentionItem,
} from '~/commerce/lib/buyer-order-attention'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useBuyerOrderAttentionStrip(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<BuyerOrderAttentionItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (silent = false) => {
      if (!user?.id) {
        setItems([])
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      const result = await fetchBuyerOrderAttentionItems(user.id, limit)
      setItems(result.items)
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
      items,
      loading: authLoading || loading,
      hasItems: items.length > 0,
      refresh: () => reload(true),
    }),
    [authLoading, items, loading, reload],
  )
}

export type { BuyerOrderAttentionItem }
