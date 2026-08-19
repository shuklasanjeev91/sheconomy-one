import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchNetworkSummary, type NetworkMember } from '~/community/lib/network'
import {
  buildNetworkSentRevisitCards,
  type NetworkSentRevisitCard,
} from '~/community/lib/network-sent-revisit'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useNetworkSentRevisit(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [members, setMembers] = useState<NetworkMember[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const summary = await fetchNetworkSummary(user.id)
    setMembers(summary.pendingSent)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityNetwork], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(() => buildNetworkSentRevisitCards(members, limit), [limit, members])

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

export type { NetworkSentRevisitCard }
