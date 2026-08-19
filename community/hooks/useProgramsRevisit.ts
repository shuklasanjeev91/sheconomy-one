import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchEnrolledPrograms, type Program } from '~/class/lib/programs'
import { buildProgramRevisitCards, type ProgramRevisitCard } from '~/class/lib/programs-revisit'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useProgramsRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setPrograms([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { programs: rows } = await fetchEnrolledPrograms(user.id)
    setPrograms(rows)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.classEnrollments], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(() => buildProgramRevisitCards(programs, limit), [programs, limit])

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

export type { ProgramRevisitCard }
