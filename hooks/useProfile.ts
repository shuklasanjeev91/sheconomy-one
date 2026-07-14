import { useEffect, useRef, useState } from 'react'

import { subscribeProfileRefresh } from '~/lib/profile/refresh'
import { supabase } from '~/lib/supabase'
import type { Tables } from '~/lib/supabase'
import { useSupabase } from '~/providers/SupabaseProvider'

export type Profile = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'role'
  | 'full_name'
  | 'username'
  | 'email'
  | 'avatar_url'
  | 'cover_url'
  | 'headline'
  | 'bio'
  | 'is_verified'
  | 'follower_count'
  | 'following_count'
  | 'connections_count'
  | 'location'
  | 'industry'
  | 'occupation'
  | 'business_name'
  | 'website_url'
  | 'portfolio_url'
  | 'interests'
  | 'profile_completion_percentage'
  | 'gender'
>

const PROFILE_FETCH_TIMEOUT_MS = 12_000

/**
 * Loads the signed-in user's `profiles` row.
 *
 * Stays loading until the profile for the *current* user id finishes (or times
 * out). Prevents account-switch races that treat gender as unknown (= male)
 * and leave access gates stuck on an empty spinner.
 */
export function useProfile() {
  const { user, isLoading: authLoading } = useSupabase()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const fetchGen = useRef(0)

  const userId = user?.id ?? null
  const profileMatchesUser = !!userId && profileUserId === userId

  useEffect(() => subscribeProfileRefresh(() => setRefreshToken((value) => value + 1)), [])

  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      fetchGen.current += 1
      setProfile(null)
      setProfileUserId(null)
      setError(null)
      setFetching(false)
      return
    }

    const gen = ++fetchGen.current
    let cancelled = false
    setFetching(true)
    setError(null)
    if (profileUserId !== userId) {
      setProfile(null)
    }

    const timeout = setTimeout(() => {
      if (cancelled || fetchGen.current !== gen) return
      setError('Profile load timed out')
      setProfile(null)
      setProfileUserId(userId)
      setFetching(false)
    }, PROFILE_FETCH_TIMEOUT_MS)

    void supabase
      .from('profiles')
      .select(
        'id, role, full_name, username, email, avatar_url, cover_url, headline, bio, is_verified, follower_count, following_count, connections_count, location, industry, occupation, business_name, website_url, portfolio_url, interests, profile_completion_percentage, gender',
      )
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (cancelled || fetchGen.current !== gen) return
        clearTimeout(timeout)

        if (profileError) {
          setError(profileError.message)
          setProfile(null)
        } else {
          setProfile(data)
          setError(null)
        }
        setProfileUserId(userId)
        setFetching(false)
      })
      .catch((err: unknown) => {
        if (cancelled || fetchGen.current !== gen) return
        clearTimeout(timeout)
        setError(err instanceof Error ? err.message : 'Could not load profile')
        setProfile(null)
        setProfileUserId(userId)
        setFetching(false)
      })

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear previous identity only when userId changes
  }, [userId, authLoading, refreshToken])

  const isLoading = authLoading || (!!userId && (fetching || !profileMatchesUser))

  return {
    profile: profileMatchesUser ? profile : null,
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
  }
}
