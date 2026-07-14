import { useEffect, useState } from 'react'

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

export function useProfile() {
  const { user, isLoading: authLoading } = useSupabase()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => subscribeProfileRefresh(() => setRefreshToken((value) => value + 1)), [])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setProfile(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    supabase
      .from('profiles')
      .select(
        'id, role, full_name, username, email, avatar_url, cover_url, headline, bio, is_verified, follower_count, following_count, connections_count, location, industry, occupation, business_name, website_url, portfolio_url, interests, profile_completion_percentage, gender',
      )
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (cancelled) return

        if (profileError) {
          setError(profileError.message)
          setProfile(null)
        } else {
          setProfile(data)
        }

        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading, refreshToken])

  return {
    profile,
    user,
    isLoading: authLoading || isLoading,
    error,
    isAuthenticated: !!user,
  }
}
