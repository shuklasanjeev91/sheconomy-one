import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildSavedNotesRevisitCards,
  fetchSavedCommunityPosts,
  type SavedNotesRevisitCard,
} from '~/community/lib/saved-posts'
import { getOrFetchRevisit, invalidateRevisit } from '~/community/lib/revisit-cache'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

const savedPostsRevisitKey = (userId: string) => `revisit:saved-posts:${userId}`

export function useSavedNotesRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<SavedNotesRevisitCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (force = false) => {
      if (!user?.id) {
        setCards([])
        setLoading(false)
        return
      }
      const key = savedPostsRevisitKey(user.id)
      if (force) invalidateRevisit(key)
      setLoading(true)
      const result = await getOrFetchRevisit(
        key,
        () => fetchSavedCommunityPosts(user.id),
        force ? 0 : undefined,
      )
      setCards(buildSavedNotesRevisitCards(result.items, limit))
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

export type { SavedNotesRevisitCard }
