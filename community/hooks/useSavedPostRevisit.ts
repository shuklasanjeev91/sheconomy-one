import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildPickUpAgainCards,
  fetchSavedCommunityPosts,
  type PickUpAgainCard,
} from '~/community/lib/saved-posts'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useSavedPostRevisit(limit = 8) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<PickUpAgainCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (silent = false) => {
      if (!user?.id) {
        setCards([])
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      const result = await fetchSavedCommunityPosts(user.id)
      setCards(buildPickUpAgainCards(result.items, limit))
      setLoading(false)
    },
    [limit, user?.id],
  )

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.savedPosts], () => {
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
