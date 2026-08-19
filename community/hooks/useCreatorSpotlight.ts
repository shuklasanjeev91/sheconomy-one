import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchCreatorSpotlight,
  type CreatorSpotlightCard,
} from '~/community/lib/creator-spotlight'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useCreatorSpotlight(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<CreatorSpotlightCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (silent = false) => {
      if (!user?.id) {
        setCards([])
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      const result = await fetchCreatorSpotlight(user.id, limit)
      setCards(result.cards)
      setLoading(false)
    },
    [limit, user?.id],
  )

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityNetwork], () => {
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

export type { CreatorSpotlightCard }
