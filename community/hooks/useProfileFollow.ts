import { useCallback, useEffect, useState } from 'react'

import {
  followProfile,
  fetchProfileFollowState,
  unfollowProfile,
} from '~/community/lib/profile-follows'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useProfileFollow(targetUserId?: string | null) {
  const { user, isLoading: authLoading } = useSupabase()
  const [isFollowing, setIsFollowing] = useState(false)
  const [followId, setFollowId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setIsFollowing(false)
      setFollowId(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const state = await fetchProfileFollowState(user.id, targetUserId)
    setIsFollowing(state.isFollowing)
    setFollowId(state.followId)
    setIsLoading(false)
  }, [targetUserId, user])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId) return { error: 'Sign in to follow' }
    if (user.id === targetUserId) return { error: 'Cannot follow yourself' }

    setIsToggling(true)
    const result = isFollowing
      ? await unfollowProfile(user.id, targetUserId)
      : await followProfile(user.id, targetUserId)
    setIsToggling(false)

    if (!result.error) {
      setIsFollowing(!isFollowing)
      if (isFollowing) {
        setFollowId(null)
      } else {
        const state = await fetchProfileFollowState(user.id, targetUserId)
        setFollowId(state.followId)
      }
    }

    return result
  }, [isFollowing, targetUserId, user])

  return {
    user,
    isAuthenticated: !!user,
    isSelf: !!user && !!targetUserId && user.id === targetUserId,
    isFollowing,
    followId,
    isLoading: authLoading || isLoading,
    isToggling,
    toggleFollow,
    reload: load,
  }
}
