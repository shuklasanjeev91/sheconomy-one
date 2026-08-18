import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { importSocialProfileHints } from '~/features/auth/services/social-profile-hints'
import { normalizeAvatarSrc } from '~/components/ui/Avatar'
import {
  ensureSessionProfile,
  getSessionProfileSnapshot,
  subscribeSessionProfile,
} from '~/lib/profile/profile-store'
import type { SessionProfile } from '~/lib/profile/session-profile'
import { useSupabase } from '~/providers/SupabaseProvider'

export type Profile = SessionProfile

/** Prefer profiles.avatar_url; fall back to Google/Apple/LinkedIn identity picture. */
function withResolvedAvatar(
  profile: Profile | null,
  user: ReturnType<typeof useSupabase>['user'],
): Profile | null {
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
 * The signed-in user's `profiles` row, read from the shared profile store.
 *
 * Every caller sees the same row, so access gates cannot disagree with each
 * other (a stale copy in the nav bar used to turn taps on women-first tabs into
 * silently dropped verification requests).
 *
 * Stays loading until the profile for the *current* user id is settled (or times
 * out), which prevents account-switch races that treat gender as unknown
 * (= limited access).
 */
export function useProfile() {
  const { user, isLoading: authLoading } = useSupabase()
  const userId = user?.id ?? null

  const snapshot = useSyncExternalStore(
    subscribeSessionProfile,
    getSessionProfileSnapshot,
    getSessionProfileSnapshot,
  )

  useEffect(() => {
    if (authLoading) return
    ensureSessionProfile(userId)
  }, [authLoading, userId])

  const matchesUser = !!userId && snapshot.userId === userId
  const profile = useMemo(
    () => (matchesUser ? withResolvedAvatar(snapshot.profile, user) : null),
    [matchesUser, snapshot.profile, user],
  )

  // Only block the shell while we lack a profile for the current user.
  // Background refreshes must not remount AppAccessGate as a full-screen spinner
  // (that felt like 5–10s hangs on every tab press).
  const isLoading = authLoading || (!!userId && (!matchesUser || !snapshot.isSettled))

  // A signed-in member whose row has not come back yet is *unknown*, not
  // limited. Access gates must wait for this instead of reading the empty
  // profile as "unverified" and redirecting.
  const isProfileKnown =
    !authLoading && (!userId || (matchesUser && (!!snapshot.profile || snapshot.isServerSettled)))

  return {
    profile,
    user,
    isLoading,
    isProfileKnown,
    error: matchesUser ? snapshot.error : null,
    isAuthenticated: !!user,
    isRefreshing: matchesUser && snapshot.isFetching,
  }
}
