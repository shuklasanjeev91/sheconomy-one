import { useEffect, useRef, useState } from 'react'

import { importSocialProfileHints } from '~/features/auth/services/social-profile-hints'
import { normalizeAvatarSrc } from '~/components/ui/Avatar'
import { subscribeProfileRefresh } from '~/lib/profile/refresh'
import {
  clearCachedProfile,
  peekCachedProfile,
  readCachedProfile,
  writeCachedProfile,
} from '~/lib/profile/profile-cache'
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
  | 'member_intents'
  | 'profile_completion_percentage'
  | 'gender'
  | 'phone'
>

const PROFILE_FETCH_TIMEOUT_MS = 2_500

/** Prefer profiles.avatar_url; fall back to Google/Apple/LinkedIn identity picture. */
function withResolvedAvatar(profile: Profile | null, user: ReturnType<typeof useSupabase>['user']): Profile | null {
  if (!profile) return null
  const fromProfile = normalizeAvatarSrc(profile.avatar_url)
  if (fromProfile) {
    return profile.avatar_url === fromProfile ? profile : { ...profile, avatar_url: fromProfile }
  }
  const social = normalizeAvatarSrc(importSocialProfileHints(user).avatarUrl)
  if (!social) {
    return profile.avatar_url ? { ...profile, avatar_url: null } : profile
  }
  return { ...profile, avatar_url: social }
}

/**
 * Loads the signed-in user's `profiles` row.
 *
 * Stays loading until the profile for the *current* user id finishes (or times
 * out). Prevents account-switch races that treat gender as unknown (= male)
 * and leave access gates stuck on an empty spinner.
 */
export function useProfile() {
  const { user, isLoading: authLoading } = useSupabase()
  const userId = user?.id ?? null
  const peeked = userId ? peekCachedProfile(userId) : null
  const [profile, setProfile] = useState<Profile | null>(peeked)
  const [profileUserId, setProfileUserId] = useState<string | null>(peeked && userId ? userId : null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const fetchGen = useRef(0)

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
      void clearCachedProfile()
      return
    }

    const gen = ++fetchGen.current
    let cancelled = false
    setFetching(true)
    setError(null)
    if (profileUserId !== userId) {
      setProfile(null)
    }

    // Apply in-memory cache synchronously on refresh (e.g. right after avatar upload)
    // so tab bar / menus update before the network round-trip finishes.
    const warm = peekCachedProfile(userId)
    if (warm) {
      setProfile(withResolvedAvatar(warm, user))
      setProfileUserId(userId)
    }

    void readCachedProfile(userId).then((cached) => {
      if (cancelled || fetchGen.current !== gen || !cached) return
      setProfile(withResolvedAvatar(cached, user))
      setProfileUserId(userId)
      setFetching(true)
    })

    const timeout = setTimeout(() => {
      if (cancelled || fetchGen.current !== gen) return
      // Keep any cached profile on screen; only surface the timeout if we have nothing.
      setFetching(false)
      setProfileUserId(userId)
      setError((current) => current ?? 'Profile load timed out')
    }, PROFILE_FETCH_TIMEOUT_MS)

    void supabase
      .from('profiles')
      .select(
        'id, role, full_name, username, email, phone, avatar_url, cover_url, headline, bio, is_verified, follower_count, following_count, connections_count, location, industry, occupation, business_name, website_url, portfolio_url, interests, member_intents, profile_completion_percentage, gender, date_of_birth, marriage_anniversary',
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
          const fromDb = normalizeAvatarSrc(data?.avatar_url)
          const warmNow = peekCachedProfile(userId)
          const warmAvatar = normalizeAvatarSrc(warmNow?.avatar_url)
          const warmIsUploadedStorage =
            !!warmAvatar &&
            warmNow?.id === userId &&
            warmAvatar.includes('/storage/v1/object/public/')

          // If the DB row is still empty but we just patched a storage avatar into
          // cache, keep that photo instead of falling back to a social identity
          // picture (which would make the upload look like it "didn't stick").
          const base =
            !fromDb && warmIsUploadedStorage && data
              ? { ...data, avatar_url: warmAvatar }
              : data
          const resolved = withResolvedAvatar(base, user)
          setProfile(resolved)
          setError(null)
          // Cache the resolved row (incl. social avatar fallback) so tab bar /
          // composer keep a usable avatar_url across sessions.
          if (resolved) void writeCachedProfile(userId, resolved)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear previous identity only when userId changes; user metadata used for avatar fallback
  }, [userId, authLoading, refreshToken, user])

  // Only block the shell while we lack a profile for the current user.
  // Background refreshes must not remount AppAccessGate as a full-screen spinner
  // (that felt like 5–10s hangs on every tab press).
  const isLoading = authLoading || (!!userId && !profileMatchesUser)

  return {
    profile: profileMatchesUser ? profile : null,
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isRefreshing: fetching && profileMatchesUser,
  }
}
