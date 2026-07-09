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
  sanitizeReturnPath,
} from '~/lib/auth/access'
import { useProfile } from '~/hooks/useProfile'

export function useAccess() {
  const { profile, isAuthenticated, isLoading } = useProfile()

  const tier = useMemo(
    () => getAccessTier(isAuthenticated, profile?.gender),
    [isAuthenticated, profile?.gender],
  )

  return useMemo(
    () => ({
      tier,
      isLoading,
      isAuthenticated,
      isFemale: tier === 'female',
      isMale: tier === 'male',
      isGuest: tier === 'guest',
      canManageShops: canManageShops(tier),
      canAccessFeature: (feature: AppFeature) => canAccessFeature(tier, feature),
      canAccessPath: (pathname: string) => canAccessPath(tier, pathname),
      getPathFeature,
      getDefaultHome: () => getDefaultHomeForTier(tier),
      getDeniedRedirect: (pathname: string) => getAccessDeniedRedirect(tier, pathname),
      sanitizeReturnPath: (path: string | null | undefined) => sanitizeReturnPath(path, tier),
      resolveFeatureNavHref: (href: string, feature: AppFeature) =>
        resolveFeatureNavHref(tier, href, feature),
      visibleFeatures: getVisibleFeatures(tier),
    }),
    [tier, isLoading, isAuthenticated],
  )
}

export type UseAccessResult = ReturnType<typeof useAccess>
