import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchRecentMeetingRevisitCards,
  type RecentMeetingRevisitCard,
} from '~/co-work/lib/recent-meeting-revisit'
import { useRecentMeetingCodes } from '~/co-work/lib/recent-meeting-codes'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useRecentMeetingRevisit(limit = 4) {
  const codes = useRecentMeetingCodes()
  const [cards, setCards] = useState<RecentMeetingRevisitCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!codes.length) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const next = await fetchRecentMeetingRevisitCards(codes, limit)
    setCards(next)
    setLoading(false)
  }, [codes, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.coWorkMeetings], () => {
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [cards, loading, reload],
  )
}

export type { RecentMeetingRevisitCard }
