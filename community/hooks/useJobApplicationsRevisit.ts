import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildJobApplicationRevisitCards,
  type JobApplicationRevisitCard,
} from '~/community/lib/job-applications-revisit'
import { fetchMyJobApplications } from '~/community/lib/jobs'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useJobApplicationsRevisit(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<JobApplicationRevisitCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchMyJobApplications(user.id)
    setCards(buildJobApplicationRevisitCards(result.items, limit))
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityJobs], () => {
    if (authLoading) return
    void reload()
  })

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

export type { JobApplicationRevisitCard }
