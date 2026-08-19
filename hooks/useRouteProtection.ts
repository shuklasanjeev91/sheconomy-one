import { useMemo } from 'react'
import type { Href } from 'one'
import { usePathname } from 'one'

import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import { buildSignInUrl } from '~/lib/auth/redirect'
import {
  type RouteAccessDecision,
  type RoleCheckOptions,
  resolveRoleAccess,
  resolveRouteAccess,
} from '~/lib/auth/route-protection'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

export type UseRouteProtectionResult = {
  /** Auth/profile still loading — render a spinner, do not act on the result. */
  isChecking: boolean
  /**
   * The member's row could not be read at all, so their access is *unknown*.
   * Callers must offer a retry — treating this as "unverified" is what bounced
   * verified members off the vendor console to `?gender=restricted`.
   */
  isProfileUnavailable: boolean
  /** The user may view the route. */
  isAuthorized: boolean
  /** Full decision (allow / signin / redirect / denied) for advanced handling. */
  decision: RouteAccessDecision | null
  /** Friendly message when access is not allowed. */
  errorMessage: string | null
  /** Where to send the user when not allowed (already a safe in-app href). */
  redirectPath: Href | null
  /** True when the block is "sign in first" (guest hitting a members route). */
  needsSignIn: boolean
  userRole: UserRole | null
  isVerified: boolean
  isAuthenticated: boolean
}

/**
 * Client-side route protection. Reads the signed-in user + profile and returns
 * a decision computed by the shared `resolveRouteAccess` engine (same logic the
 * `<RouteGuard>` renders — no duplication, no drift).
 *
 * - Pass `allowedRoles` to check explicit roles (with `options`).
 * - Omit `allowedRoles` to check the current route against the central config.
 *
 * This hook is **pure state** — it never calls the router itself, which avoids
 * the redirect race conditions the old imperative version was prone to. Render
 * with `<RouteGuard>` or act on the returned fields yourself.
 *
 * Access is only ever *denied* on a row the server confirmed. A cached or
 * still-loading row may grant access early but must never revoke it: an
 * unsettled profile resolves to the limited tier, and deciding on that is what
 * kept bouncing verified vendors off `/vendor` to the restricted redirect.
 */
export function useRouteProtection(
  allowedRoles?: readonly UserRole[],
  options: RoleCheckOptions = {},
): UseRouteProtectionResult {
  const pathname = usePathname()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const {
    profile,
    isLoading: profileLoading,
    isProfileConfirmed,
    isProfileUnavailable,
  } = useProfile()

  // Only wait for the profile once we know there is a signed-in user to load one
  // for. A signed-in member also waits for the server to confirm the row, unless
  // every read failed — then `isProfileUnavailable` asks instead of assuming.
  const isChecking =
    authLoading ||
    (isAuthenticated && (profileLoading || (!isProfileConfirmed && !isProfileUnavailable)))

  return useMemo(() => {
    const userRole = (profile?.role as UserRole | null) ?? null
    const isVerified = profile?.is_verified === true

    if (isChecking || (isAuthenticated && isProfileUnavailable)) {
      return {
        isChecking: !isProfileUnavailable,
        isProfileUnavailable: isAuthenticated && isProfileUnavailable,
        isAuthorized: false,
        decision: null,
        errorMessage: null,
        redirectPath: null,
        needsSignIn: false,
        userRole,
        isVerified,
        isAuthenticated,
      }
    }

    const decision: RouteAccessDecision = allowedRoles
      ? resolveRoleAccess(
          {
            pathname,
            isAuthenticated,
            role: profile?.role ?? null,
            gender: profile?.gender ?? null,
            isVerified: profile?.is_verified ?? null,
            allowedRoles,
          },
          options,
        )
      : resolveRouteAccess({
          pathname,
          isAuthenticated,
          role: profile?.role ?? null,
          gender: profile?.gender ?? null,
          isVerified: profile?.is_verified ?? null,
        })

    const redirectPath =
      decision.status === 'signin'
        ? buildSignInUrl(decision.returnTo)
        : decision.status === 'redirect' || decision.status === 'denied'
          ? decision.href
          : null

    return {
      isChecking: false,
      isProfileUnavailable: false,
      isAuthorized: decision.status === 'allow',
      decision,
      errorMessage: decision.status === 'allow' ? null : decision.message,
      redirectPath,
      needsSignIn: decision.status === 'signin',
      userRole,
      isVerified,
      isAuthenticated,
    }
  }, [
    isChecking,
    isAuthenticated,
    isProfileUnavailable,
    pathname,
    profile,
    allowedRoles,
    options,
  ])
}

// ---------------------------------------------------------------------------
// Specialised shortcuts (parity with the old hook API).
// ---------------------------------------------------------------------------

const ADMIN_ROLES = [USER_ROLES.ADMIN] as const
const VENDOR_ROLES = [USER_ROLES.ADMIN, USER_ROLES.VENDOR] as const
const MEMBER_ROLES = [USER_ROLES.ADMIN, USER_ROLES.VENDOR, USER_ROLES.USER] as const

/** Admin-only areas. */
export function useAdminProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(ADMIN_ROLES, options)
}

/** Vendor console — admins + vendors. Opening a new shop still uses `useShopCreationProtection`. */
export function useVendorProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(VENDOR_ROLES, { requireGenderVerification: false, ...options })
}

/** Any signed-in member. */
export function useUserProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(MEMBER_ROLES, options)
}

/** Guest-only surfaces (e.g. the sign-in screen). */
export function useGuestProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection([], { allowUnauthenticated: true, ...options })
}

/** Chat — signed-in, women-first. */
export function useChatProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(MEMBER_ROLES, { requireGenderVerification: true, ...options })
}

/** Seller dashboard / shop management — admins + vendors. */
export function useShopProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(VENDOR_ROLES, { requireGenderVerification: false, ...options })
}

/** Shop creation — any signed-in woman can open a shop. */
export function useShopCreationProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection([], { requireGenderVerification: true, ...options })
}

/** Checkout — signed in is enough. */
export function useCheckoutProtection(options: RoleCheckOptions = {}) {
  return useRouteProtection(MEMBER_ROLES, options)
}
