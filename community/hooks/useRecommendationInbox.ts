import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchIncomingRecommendationRequests,
  type RecommendationRequest,
} from '~/community/lib/recommendations'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useRecommendationInbox(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<RecommendationRequest[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchIncomingRecommendationRequests(user.id)
    setItems(result.items.slice(0, limit))
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityNetwork], () => {
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

export type { RecommendationRequest }
