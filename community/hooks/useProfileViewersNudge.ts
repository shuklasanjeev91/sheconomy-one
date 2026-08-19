import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchRecentProfileViewers, type ProfileViewer } from '~/community/lib/profile-views'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useProfileViewersNudge(limit = 4) {
  const { user, isLoading: authLoading } = useSupabase()
  const [viewers, setViewers] = useState<ProfileViewer[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setViewers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchRecentProfileViewers(user.id, limit)
    setViewers(result.items)
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  return useMemo(
    () => ({
      viewers,
      loading: authLoading || loading,
      hasViewers: viewers.length > 0,
      refresh: reload,
    }),
    [authLoading, loading, reload, viewers],
  )
}
