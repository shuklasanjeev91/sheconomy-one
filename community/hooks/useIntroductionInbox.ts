import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchIntroductionInbox,
  type IntroductionRequest,
} from '~/community/lib/introductions'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useIntroductionInbox(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<IntroductionRequest[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchIntroductionInbox(user.id)
    setItems(result.items.slice(0, limit))
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.communityNetwork], () => {
    if (authLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      items,
      loading: authLoading || loading,
      hasItems: items.length > 0,
      refresh: reload,
    }),
    [authLoading, items, loading, reload],
  )
}
