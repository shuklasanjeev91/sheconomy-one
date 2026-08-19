import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildReadLaterRevisitCards,
  fetchSavedCommunityPosts,
  type ReadLaterRevisitCard,
} from '~/community/lib/saved-posts'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useReadLaterRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<ReadLaterRevisitCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchSavedCommunityPosts(user.id)
    setCards(buildReadLaterRevisitCards(result.items, limit))
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.savedPosts], () => {
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

export type { ReadLaterRevisitCard }
