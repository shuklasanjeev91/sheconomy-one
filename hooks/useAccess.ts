import { useMemo } from 'react'

import {
  type AccessTier,
  type AppFeature,
  canAccessFeature,
  canAccessPath,
  canManageShops,
  getAccessDeniedRedirect,
  getAccessTier,
  getDefaultHomeForTier,
  getPathFeature,
  getVisibleFeatures,
  resolveFeatureNavHref,
  resolveFeatureNavIntent,
  sanitizeReturnPath,
} from '~/lib/auth/access'
import { useProfile } from '~/hooks/useProfile'

export function useAccess() {
  const { profile, isAuthenticated, isLoading, isRefreshing } = useProfile()
  const isVerified = profile?.is_verified === true

  const tier = useMemo(
    () => getAccessTier(isAuthenticated, profile?.gender, isVerified),
    [isAuthenticated, profile?.gender, isVerified],
  )

  return useMemo(
    () => ({
      tier,
      isLoading,
      isRefreshing,
      isAuthenticated,
      isVerified,
      /**
       * The profile has settled, so `tier` reflects reality. An unknown profile
       * resolves to the limited tier, so press handlers must not gate on it.
       */
      isTierKnown: !isLoading,
      /** Verified female with full women-first access. */
      isFemale: tier === 'female',
      /** Signed-in limited access (male or skipped / unverified). */
      isMale: tier === 'male',
      isGuest: tier === 'guest',
      canManageShops: canManageShops(tier),
      canAccessFeature: (feature: AppFeature) => canAccessFeature(tier, feature),
      canAccessPath: (pathname: string) => canAccessPath(tier, pathname, isVerified),
      getPathFeature,
      getDefaultHome: () => getDefaultHomeForTier(tier, isVerified),
      getDeniedRedirect: (pathname: string) =>
        getAccessDeniedRedirect(tier, pathname, isVerified),
      sanitizeReturnPath: (path: string | null | undefined) =>
        sanitizeReturnPath(path, tier, isVerified),
      resolveFeatureNavHref: (href: string, feature: AppFeature) =>
        resolveFeatureNavHref(tier, href, feature, !isLoading),
      resolveFeatureNavIntent: (href: string, feature: AppFeature) =>
        resolveFeatureNavIntent({
          href,
          feature,
          tier,
          isAuthenticated,
          isTierKnown: !isLoading,
        }),
      visibleFeatures: getVisibleFeatures(tier),
    }),
    [tier, isLoading, isRefreshing, isAuthenticated, isVerified],
  )
}

export type UseAccessResult = ReturnType<typeof useAccess>
