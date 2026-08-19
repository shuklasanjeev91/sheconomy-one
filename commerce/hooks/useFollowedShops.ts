import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchFollowedShopIds,
  fetchFollowedShops,
  subscribeToShopFollowChanges,
  type FollowedShopSummary,
} from '~/commerce/lib/shop-follows'
import { useSupabase } from '~/providers/SupabaseProvider'

type FollowedShopsState = {
  ids: string[]
  items: FollowedShopSummary[]
  error: string | null
}

const emptyState: FollowedShopsState = {
  ids: [],
  items: [],
  error: null,
}

export function useFollowedShops(limit = 12) {
  const { user, isLoading: authLoading } = useSupabase()
  const [state, setState] = useState<FollowedShopsState>(emptyState)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) {
      setState(emptyState)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const [idsResult, shopsResult] = await Promise.all([
      fetchFollowedShopIds(user.id),
      fetchFollowedShops(user.id, limit),
    ])

    setState({
      ids: idsResult.ids,
      items: shopsResult.items,
      error: idsResult.error ?? shopsResult.error,
    })
    setIsLoading(false)
  }, [limit, user])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useEffect(() => subscribeToShopFollowChanges(() => void reload()), [reload])

  const idSet = useMemo(() => new Set(state.ids), [state.ids])

  return {
    isAuthenticated: !!user,
    isLoading: authLoading || isLoading,
    error: state.error,
    ids: state.ids,
    idSet,
    items: state.items,
    refresh: reload,
  }
}
