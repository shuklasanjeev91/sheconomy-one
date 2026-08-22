import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchMyMeetings } from '~/co-work/lib/meetings'
import { buildMeetingRevisitCards, type MeetingRevisitCard } from '~/co-work/lib/meeting-revisit'
import type { Meeting } from '~/co-work/lib/types'
import { getOrFetchRevisit, invalidateRevisit } from '~/community/lib/revisit-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useMeetingRevisit(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    async (force = false) => {
      if (!user?.id) {
        setMeetings([])
        setLoading(false)
        return
      }
      const key = CACHE_KEYS.coWorkMyMeetings(user.id)
      if (force) invalidateRevisit(key)
      setLoading(true)
      try {
        const rows = await getOrFetchRevisit(
          key,
          () => fetchMyMeetings(user.id),
          force ? 0 : undefined,
        )
        setMeetings(rows)
      } catch {
        setMeetings([])
      } finally {
        setLoading(false)
      }
    },
    [user?.id],
  )

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.coWorkMeetings], () => {
    if (authLoading) return
    void reload(true)
  })

  const cards = useMemo(
    () => (user?.id ? buildMeetingRevisitCards(meetings, user.id, limit) : []),
    [meetings, limit, user?.id],
  )

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

export type { MeetingRevisitCard }
