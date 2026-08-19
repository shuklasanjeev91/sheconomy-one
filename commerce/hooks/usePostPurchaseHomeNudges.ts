import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchPostPurchaseHomeNudges } from '~/commerce/lib/post-purchase-home'
import type { PostPurchaseNudgeItem } from '~/commerce/lib/post-purchase-nudges'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function usePostPurchaseHomeNudges(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<PostPurchaseNudgeItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchPostPurchaseHomeNudges(user.id, limit)
    setItems(result.items)
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
      items,
      loading: authLoading || loading,
      hasItems: items.length > 0,
      refresh: reload,
    }),
    [authLoading, items, loading, reload],
  )
}
