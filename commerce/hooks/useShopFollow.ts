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

  const reload = useCallback(async () => {
    if (!shopId || !user) {
      setIsFollowing(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
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

    setIsToggling(false)

    if (!result.error) {
      setIsFollowing((value) => !value)
    } else {
      setError(result.error)
    }

    return result
  }, [isFollowing, shopId, user])

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
