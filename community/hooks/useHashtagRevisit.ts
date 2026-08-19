import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchHashtagRevisitCards,
  type HashtagRevisitCard,
} from '~/community/lib/hashtag-revisit'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useHashtagRevisit(limit = 8) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<HashtagRevisitCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchHashtagRevisitCards(user.id, limit)
    setCards(result.cards)
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

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

export type { HashtagRevisitCard }
