import { useCallback, useEffect, useState } from 'react'

import {
  fetchShopFollowState,
  followShop,
  unfollowShop,
} from '~/commerce/lib/shop-follows'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useShopFollow(shopId?: string | null) {
  const { user, isLoading: authLoading } = useSupabase()
  const userId = user?.id ?? null
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    async (showLoading = true) => {
      if (!shopId || !userId) {
        setIsFollowing(false)
        setIsLoading(false)
        return
      }

      if (showLoading) setIsLoading(true)
      const result = await fetchShopFollowState(userId, shopId)
      setIsFollowing(result.isFollowing)
      setError(result.error)
      setIsLoading(false)
    },
    [shopId, userId],
  )

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    void (async () => {
      if (!shopId || !userId) {
        if (!cancelled) {
          setIsFollowing(false)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      const result = await fetchShopFollowState(userId, shopId)
      if (cancelled) return
      setIsFollowing(result.isFollowing)
      setError(result.error)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, shopId, userId])

  const toggleFollow = useCallback(async () => {
    if (!userId || !shopId) return { error: 'Sign in to follow shops' }

    setIsToggling(true)
    setError(null)

    const result = isFollowing
      ? await unfollowShop(userId, shopId)
      : await followShop(userId, shopId)

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
  }, [isFollowing, reload, shopId, userId])

  return {
    user,
    isAuthenticated: !!userId,
    isFollowing,
    isLoading: authLoading || isLoading,
    isToggling,
    error,
    toggleFollow,
    reload,
  }
}
