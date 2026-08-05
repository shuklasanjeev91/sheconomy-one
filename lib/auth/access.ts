import type { Href } from 'one'

import { buildSignInUrl, isSafeReturnPath } from '~/lib/auth/redirect'
import { buildVerificationDeniedRedirect } from '~/lib/gender-verification/denied-redirect'
import { requiresGenderVerification } from '~/config/route-protection.config'
import {
  appRoutes,
  commerceRoutes,
  communityRoutes,
  isChatPath,
  isClassPath,
  isCoWorkPath,
  isCommercePath,
  isCommunityPath,
  isCreateShopPath,
  isNotificationsPath,
  isVendorPath,
} from '~/lib/routes'

/** Guest, authenticated male, or authenticated female (full access). */
export type AccessTier = 'guest' | 'male' | 'female'

export type AppFeature = 'commerce' | 'class' | 'co-work' | 'community' | 'chat' | 'account'

/** In SHEconomy, `profiles.gender === true` means female. */
export function isFemaleProfile(gender: boolean | null | undefined): boolean {
  return gender === true
}

/** Female member who completed human verification (`gender` + liveness). */
export function hasVerifiedFemaleAccess(
  gender: boolean | null | undefined,
  isVerified: boolean | null | undefined,
): boolean {
  return isFemaleProfile(gender) && isVerified === true
}

export function getAccessTier(
  isAuthenticated: boolean,
  gender: boolean | null | undefined,
): AccessTier {
  if (!isAuthenticated) return 'guest'
  return isFemaleProfile(gender) ? 'female' : 'male'
}

const TIER_FEATURES: Record<AccessTier, ReadonlySet<AppFeature>> = {
  guest: new Set(['commerce']),
  male: new Set(['commerce', 'class', 'co-work']),
  female: new Set(['commerce', 'class', 'co-work', 'community', 'chat', 'account']),
}

/** Any signed-in member can open a shop and manage listings. */
export function canManageShops(tier: AccessTier): boolean {
  return tier !== 'guest'
}

export function canAccessFeature(tier: AccessTier, feature: AppFeature): boolean {
  return TIER_FEATURES[tier].has(feature)
}

/** `/profile/:username` and sub-routes — public member profiles (professional). */
export function isPublicProfilePath(pathname: string): boolean {
  if (!pathname.startsWith(`${appRoutes.profile}/`)) return false
  const segment = pathname.slice(`${appRoutes.profile}/`.length).split('/')[0]
  return Boolean(segment)
}

function isAccountPath(pathname: string) {
  if (isPublicProfilePath(pathname)) return false

  return (
    pathname === appRoutes.profile ||
    pathname.startsWith(`${appRoutes.profile}/`) ||
    pathname === appRoutes.settings ||
    pathname.startsWith(`${appRoutes.settings}/`)
  )
}

function isHelpPath(pathname: string) {
  return pathname === appRoutes.help || pathname.startsWith(`${appRoutes.help}/`)
}

export function getPathFeature(pathname: string): AppFeature | 'auth' | 'public' {
  if (pathname.startsWith('/auth/')) return 'auth'
  if (pathname === '/ui-kit' || pathname.startsWith('/ui-kit/')) return 'public'
  if (pathname === '/sellerlanding' || pathname.startsWith('/sellerlanding/')) return 'public'
  if (isHelpPath(pathname)) return 'public'
  if (isPublicProfilePath(pathname)) return 'public'
  if (isClassPath(pathname)) return 'class'
  if (isCoWorkPath(pathname)) return 'co-work'
  if (isChatPath(pathname)) return 'chat'
  if (isCommunityPath(pathname) || isNotificationsPath(pathname)) return 'community'
  if (isAccountPath(pathname)) return 'account'
  if (isCommercePath(pathname)) return 'commerce'
  return 'commerce'
}

export function canAccessPath(
  tier: AccessTier,
  pathname: string,
  isVerified?: boolean | null,
): boolean {
  if ((isCreateShopPath(pathname) || isVendorPath(pathname)) && !canManageShops(tier)) return false

  const area = getPathFeature(pathname)
  if (area === 'auth' || area === 'public') return true

  if (requiresGenderVerification(pathname)) {
    if (tier === 'guest') return false
    if (tier === 'male') return false
    return isVerified === true
  }

  return canAccessFeature(tier, area)
}

export function getDefaultHomeForTier(tier: AccessTier, isVerified?: boolean | null): Href {
  if (tier === 'female' && isVerified === true) return communityRoutes.home
  return commerceRoutes.home
}

export function sanitizeReturnPath(
  path: string | null | undefined,
  tier: AccessTier,
  isVerified?: boolean | null,
): string {
  if (!isSafeReturnPath(path ?? null)) {
    return getDefaultHomeForTier(tier, isVerified)
  }

  if (canAccessPath(tier, path!, isVerified)) {
    return path!
  }

  return getDefaultHomeForTier(tier, isVerified)
}

export function getAccessDeniedRedirect(
  tier: AccessTier,
  pathname: string,
  isVerified?: boolean | null,
): Href {
  const feature = getPathFeature(pathname)

  if (
    tier === 'female' &&
    isVerified !== true &&
    requiresGenderVerification(pathname)
  ) {
    return buildVerificationDeniedRedirect() as Href
  }

  if (isCreateShopPath(pathname) || isVendorPath(pathname)) {
    if (tier === 'guest') return buildSignInUrl(pathname)
  }

  if (
    tier === 'male' &&
    (feature === 'community' || feature === 'chat' || feature === 'account')
  ) {
    return appRoutes.verifyGender
  }

  if (
    tier === 'guest' &&
    (feature === 'account' ||
      feature === 'chat' ||
      feature === 'community' ||
      feature === 'class' ||
      feature === 'co-work')
  ) {
    return buildSignInUrl(pathname)
  }

  return getDefaultHomeForTier(tier, isVerified)
}

/** Guest hit a route that requires sign-in — show auth inside the app shell. */
export function getGuestSignInReturnTo(tier: AccessTier, pathname: string): string | null {
  if (tier !== 'guest' || canAccessPath(tier, pathname)) return null

  if (isCreateShopPath(pathname) || isVendorPath(pathname)) return pathname

  const feature = getPathFeature(pathname)
  if (
    feature === 'account' ||
    feature === 'chat' ||
    feature === 'community' ||
    feature === 'class' ||
    feature === 'co-work'
  ) {
    return pathname
  }

  return null
}

export function getVisibleFeatures(tier: AccessTier): AppFeature[] {
  return Array.from(TIER_FEATURES[tier])
}

/** Header nav target — feature route, or sign-in / verify-gender gate when blocked. */
export function resolveFeatureNavHref(tier: AccessTier, href: string, feature: AppFeature): Href {
  if (canAccessFeature(tier, feature)) return href as Href
  if (tier === 'guest') return href as Href
  return appRoutes.verifyGender
}
