import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchOpenToServicesRevisitCard,
  type OpenToServicesRevisitCard,
} from '~/community/lib/open-to-services-revisit'
import { useProfile } from '~/hooks/useProfile'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useOpenToServicesRevisit() {
  const { profile, isLoading: profileLoading } = useProfile()
  const [card, setCard] = useState<OpenToServicesRevisitCard | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile?.id) {
      setCard(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchOpenToServicesRevisitCard(profile.id, profile)
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

export type { OpenToServicesRevisitCard }
