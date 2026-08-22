import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildPickUpAgainCards,
  fetchSavedCommunityPosts,
  type PickUpAgainCard,
} from '~/community/lib/saved-posts'
import { getOrFetchRevisit, invalidateRevisit } from '~/community/lib/revisit-cache'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useSavedPostRevisit(limit = 8) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<PickUpAgainCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (silent = false, force = false) => {
      if (!user?.id) {
        setCards([])
        setLoading(false)
        return
      }
      const key = `revisit:saved-posts:${user.id}`
      if (force) invalidateRevisit(key)
      if (!silent) setLoading(true)
      const result = await getOrFetchRevisit(
        key,
        () => fetchSavedCommunityPosts(user.id),
        force ? 0 : undefined,
      )
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
    void reload(true, true)
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
