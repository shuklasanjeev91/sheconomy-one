import { useCallback, useEffect, useState } from 'react'

import {
  fetchHashtagFollowState,
  followHashtag,
  unfollowHashtag,
} from '~/community/lib/hashtag-follows'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useHashtagFollow(hashtag?: string | null) {
  const { user, isLoading: authLoading } = useSupabase()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    if (!user || !hashtag) {
      setIsFollowing(false)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const state = await fetchHashtagFollowState(user.id, hashtag)
    setIsFollowing(state.isFollowing)
    setIsLoading(false)
  }, [hashtag, user])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  const toggleFollow = useCallback(async () => {
    if (!user || !hashtag) return { error: 'Sign in to follow hashtags' }
    setIsToggling(true)
    const result = isFollowing
      ? await unfollowHashtag(user.id, hashtag)
      : await followHashtag(user.id, hashtag)
    setIsToggling(false)
    if (!result.error) setIsFollowing(!isFollowing)
    return result
  }, [hashtag, isFollowing, user])

  return {
    isAuthenticated: !!user,
    isFollowing,
    isLoading: authLoading || isLoading,
    isToggling,
    toggleFollow,
  }
}
