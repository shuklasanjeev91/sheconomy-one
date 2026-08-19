import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchSavedJobs, type JobListing } from '~/community/lib/jobs'
import { buildJobRevisitCards, type JobRevisitCard } from '~/community/lib/job-revisit'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useJobRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setJobs([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchSavedJobs(user.id)
    setJobs(result.items)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityJobs], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(() => buildJobRevisitCards(jobs, limit), [jobs, limit])

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

export type { JobRevisitCard }
