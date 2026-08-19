import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildMeetingInviteRevisitCards,
  fetchPendingMeetingInvites,
  type MeetingInviteRevisitCard,
} from '~/co-work/lib/meeting-invites-revisit'
import type { Meeting } from '~/co-work/lib/types'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useMeetingInvitesRevisit(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setMeetings([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const rows = await fetchPendingMeetingInvites(user.id, user.email)
      setMeetings(rows)
    } catch {
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }, [user?.email, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.coWorkMeetings], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(
    () =>
      user?.id
        ? buildMeetingInviteRevisitCards(meetings, user.id, user.email, limit)
        : [],
    [limit, meetings, user?.email, user?.id],
  )

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

export type { MeetingInviteRevisitCard }
