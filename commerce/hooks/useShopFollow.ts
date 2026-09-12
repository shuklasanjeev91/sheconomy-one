import { useCallback, useEffect, useState } from 'react'

import {
  fetchShopFollowState,
  followShop,
  unfollowShop,
} from '~/commerce/lib/shop-follows'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useShopFollow(shopId?: string | null) {
  const { user, isLoading: authLoading } = useSupabase()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (showLoading = true) => {
    if (!shopId || !user) {
      setIsFollowing(false)
      setIsLoading(false)
      return
    }

    if (showLoading) setIsLoading(true)
    const result = await fetchShopFollowState(user.id, shopId)
    setIsFollowing(result.isFollowing)
    setError(result.error)
    setIsLoading(false)
  }, [shopId, user])

  useEffect(() => {
    if (authLoading) return
    reload()
  }, [authLoading, reload])

  const toggleFollow = useCallback(async () => {
    if (!user || !shopId) return { error: 'Sign in to follow shops' }

    setIsToggling(true)
    setError(null)

    const result = isFollowing
      ? await unfollowShop(user.id, shopId)
      : await followShop(user.id, shopId)

    if (!result.error) {
      // Keep the existing button mounted while confirming the new state.
      // Replacing it with an un-sized spinner makes compact rails visibly jump.
      setIsFollowing(!isFollowing)
      await reload(false)
    } else {
      setError(result.error)
    }

    setIsToggling(false)
    return result
  }, [isFollowing, reload, shopId, user])

  return {
    user,
    isAuthenticated: !!user,
    isFollowing,
    isLoading: authLoading || isLoading,
    isToggling,
    error,
    toggleFollow,
    reload,
  }
}
