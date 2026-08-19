import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchMyCompanies, type CompanyPage } from '~/community/lib/companies'
import { buildCompaniesRevisitCards, type CompaniesRevisitCard } from '~/community/lib/companies-revisit'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useCompaniesRevisit(limit = 6) {
  const { user, isLoading: authLoading } = useSupabase()
  const [companies, setCompanies] = useState<CompanyPage[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCompanies([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await fetchMyCompanies(user.id)
    setCompanies(rows)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityCompanies], () => {
    if (authLoading) return
    void reload()
  })

  const cards = useMemo(() => buildCompaniesRevisitCards(companies, limit), [companies, limit])

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

export type { CompaniesRevisitCard }
