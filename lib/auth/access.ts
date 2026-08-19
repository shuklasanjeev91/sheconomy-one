import type { Href } from 'one'

import { buildSignInUrl, isSafeReturnPath } from '~/lib/auth/redirect'
import {
  buildHumanVerificationOpenRedirect,
  buildVerificationDeniedRedirect,
  isHumanVerificationIntentPath,
} from '~/lib/gender-verification/denied-redirect'
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

/**
 * Guest / limited (male or skipped verification) / verified female (full access).
 * Skipping or failing human verification keeps the member on the limited tier.
 */
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

/**
 * Resolve the product access tier.
 * Only verified females get the full women-first surface (community, chat, account).
 * Guests, males, and members who skip verification share limited access.
 */
export function getAccessTier(
  isAuthenticated: boolean,
  gender: boolean | null | undefined,
  isVerified?: boolean | null,
): AccessTier {
  if (!isAuthenticated) return 'guest'
  return hasVerifiedFemaleAccess(gender, isVerified) ? 'female' : 'male'
}

const TIER_FEATURES: Record<AccessTier, ReadonlySet<AppFeature>> = {
  guest: new Set(['commerce', 'class', 'co-work']),
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
  _isVerified?: boolean | null,
): boolean {
  if ((isCreateShopPath(pathname) || isVendorPath(pathname)) && !canManageShops(tier)) return false

  const area = getPathFeature(pathname)
  if (area === 'auth' || area === 'public') return true

  // Women-first surfaces require the verified-female tier (skip keeps limited access).
  // `/vendor` is not in that set — role is enforced by `RequireVendorRole`.
  if (requiresGenderVerification(pathname)) {
    return tier === 'female'
  }

  // Create shop is path-reachable for signed-in members only after Human verification.
  if (isCreateShopPath(pathname) && tier === 'male') return false

  return canAccessFeature(tier, area)
}

export function getDefaultHomeForTier(tier: AccessTier, _isVerified?: boolean | null): Href {
  if (tier === 'female') return communityRoutes.home
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

  // After auth, preserve Community / Chat / Create store intent → Human verification.
  // Create store is path-allowed for limited members but still requires verification.
  if (tier === 'male' && isHumanVerificationIntentPath(path!)) {
    if (!canAccessPath(tier, path!, isVerified) || isCreateShopPath(path!)) {
      return buildHumanVerificationOpenRedirect({ returnTo: path! })
    }
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

  if (isCreateShopPath(pathname) || isVendorPath(pathname)) {
    if (tier === 'guest') return buildSignInUrl(pathname)
  }

  // Existing seller console is role-gated (`RequireVendorRole`), not a women-first
  // deny surface. Mapping it to `?gender=restricted` bounced vendors off My Shop.
  if (isVendorPath(pathname)) {
    return getDefaultHomeForTier(tier, isVerified)
  }

  if (tier === 'male') {
    if (isHumanVerificationIntentPath(pathname) || feature === 'community' || feature === 'chat') {
      return buildHumanVerificationOpenRedirect({ returnTo: pathname }) as Href
    }

    if (feature === 'account' || requiresGenderVerification(pathname)) {
      return buildVerificationDeniedRedirect() as Href
    }
  }

  if (
    tier === 'guest' &&
    (feature === 'account' || feature === 'chat' || feature === 'community')
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
  if (feature === 'account' || feature === 'chat' || feature === 'community') {
    return pathname
  }

  return null
}

export function getVisibleFeatures(tier: AccessTier): AppFeature[] {
  return Array.from(TIER_FEATURES[tier])
}

/**
 * Header nav target — feature route, sign-in (guest), or Human verification open
 * (limited member on Community / Chat). Account stays on the denied modal path.
 *
 * `isTierKnown` guards against acting on an unsettled profile: an unknown tier
 * resolves to `male`, so without it a verified member whose row has not loaded
 * yet would be sent to verification instead of where she tapped.
 *
 * It is deliberately required — a default of `true` let callers bake
 * `?gender=restricted` into a link while the profile was still in flight.
 */
export function resolveFeatureNavHref(
  tier: AccessTier,
  href: string,
  feature: AppFeature,
  isTierKnown: boolean,
): Href {
  if (!isTierKnown) return href as Href
  if (canAccessFeature(tier, feature)) return href as Href
  if (tier === 'guest') return buildSignInUrl(href)
  if (feature === 'community' || feature === 'chat') {
    return buildHumanVerificationOpenRedirect({ returnTo: href }) as Href
  }
  return buildVerificationDeniedRedirect() as Href
}

/** What a nav / tab press should actually do. */
export type FeatureNavIntent =
  | { kind: 'navigate'; href: string }
  | { kind: 'sign-in'; href: string }
  | { kind: 'verify'; returnTo: string }

/**
 * The one place that decides what pressing a feature tab does.
 *
 * While the profile is still unsettled (`isTierKnown === false`) the press
 * navigates and lets `AppAccessGate` rule on the destination once the row
 * arrives — it renders a spinner and then either paints or redirects. Deciding
 * here from an unknown tier is what used to turn a verified member's tap into a
 * verification request that nothing acted on.
 */
export function resolveFeatureNavIntent(input: {
  href: string
  feature: AppFeature
  tier: AccessTier
  isAuthenticated: boolean
  isTierKnown: boolean
}): FeatureNavIntent {
  const { href, feature, tier, isAuthenticated, isTierKnown } = input

  if (!isTierKnown) return { kind: 'navigate', href }
  if (canAccessFeature(tier, feature)) return { kind: 'navigate', href }

  // Community / Chat — Human verification only when signed in.
  if (feature === 'community' || feature === 'chat') {
    return isAuthenticated ? { kind: 'verify', returnTo: href } : { kind: 'sign-in', href }
  }

  if (tier === 'guest') return { kind: 'sign-in', href }
  return { kind: 'navigate', href }
}
