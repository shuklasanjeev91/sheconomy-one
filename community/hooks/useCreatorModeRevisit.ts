import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchCreatorModeRevisitCard,
  type CreatorModeRevisitCard,
} from '~/community/lib/creator-mode-revisit'
import { useProfile } from '~/hooks/useProfile'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useCreatorModeRevisit() {
  const { profile, isLoading: profileLoading } = useProfile()
  const [card, setCard] = useState<CreatorModeRevisitCard | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile?.id) {
      setCard(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchCreatorModeRevisitCard(profile.id, profile)
    setCard(result.card)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    if (profileLoading) return
    void reload()
  }, [profileLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityNetwork, INVALIDATION_TOPICS.communityJobs], () => {
    if (profileLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      card,
      loading: profileLoading || loading,
      hasCard: card != null,
      refresh: reload,
    }),
    [card, loading, profileLoading, reload],
  )
}

export type { CreatorModeRevisitCard }
