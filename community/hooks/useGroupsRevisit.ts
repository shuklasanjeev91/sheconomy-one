import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchMyGroups, type Group } from '~/community/lib/groups'
import { buildGroupsRevisitCards, type GroupsRevisitCard } from '~/community/lib/groups-revisit'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useGroupsRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setGroups([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await fetchMyGroups(user.id)
    setGroups(rows)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityGroups], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(() => buildGroupsRevisitCards(groups, limit), [groups, limit])

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

export type { GroupsRevisitCard }
