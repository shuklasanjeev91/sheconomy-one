/**
 * Route-protection engine — the **single source of truth** shared by the
 * `useRouteProtection` hooks and the `<RouteGuard>` component. Given a route and
 * the current user, it returns one clear decision. No UI, no side effects.
 *
 * This mirrors the old middleware's `RouteAccessService` but is pure and
 * framework-agnostic, so both the hook and the guard reuse it (no duplication,
 * no drift between "what the hook thinks" and "what the guard renders").
 */

import type { Href } from 'one'

import { appRoutes } from '~/lib/routes'
import { hasVerifiedFemaleAccess } from '~/lib/auth/access'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'
import {
  DEFAULT_ROUTES,
  FALLBACK_HOME,
  FEATURE_FLAGS,
  getRouteAccessRule,
  requiresGenderVerification,
  requiresVerification,
} from '~/config/route-protection.config'

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Long-form → canonical code, so legacy `admin`/`vendor`/`user` rows still work. */
const LONG_ROLE_MAP: Record<string, UserRole> = {
  admin: USER_ROLES.ADMIN,
  vendor: USER_ROLES.VENDOR,
  user: USER_ROLES.USER,
}

const ROLE_CODES = new Set<string>([USER_ROLES.ADMIN, USER_ROLES.VENDOR, USER_ROLES.USER])

/** Normalise any stored role value to a canonical `A` / `V` / `U`, or `null`. */
export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null
  const trimmed = role.trim()
  if (ROLE_CODES.has(trimmed)) return trimmed as UserRole
  return LONG_ROLE_MAP[trimmed.toLowerCase()] ?? null
}

export function isAdminRole(role: UserRole | null): boolean {
  return role === USER_ROLES.ADMIN
}

/** Human-readable role names for building "requires X access" messages. */
export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'Admin'
    case USER_ROLES.VENDOR:
      return 'Vendor'
    default:
      return 'Member'
  }
}

export function getRoleNames(roles: readonly UserRole[]): string {
  const names = roles.map(getRoleLabel)
  if (names.length <= 1) return names[0] ?? 'authorised'
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

/** The home base for a role — where a denied user is sent back to. */
export function getDefaultRouteForRole(role: UserRole | null): Href {
  if (!role) return FALLBACK_HOME as Href
  return (DEFAULT_ROUTES[role] ?? FALLBACK_HOME) as Href
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type RouteDenyReason =
  | 'guest_only'
  | 'auth_required'
  | 'gender_required'
  | 'verification_required'
  | 'insufficient_role'
  | 'incomplete_profile'

export type RouteAccessDecision =
  /** User may view the route. */
  | { status: 'allow' }
  /** Guest hit a members-only route — show inline sign-in, return here after. */
  | { status: 'signin'; returnTo: string; reason: RouteDenyReason; message: string }
  /** Send the user elsewhere silently (gender/verification gate, guest-only). */
  | { status: 'redirect'; href: Href; reason: RouteDenyReason; message: string }
  /** Signed in but not allowed — show a clear "access denied" screen. */
  | { status: 'denied'; href: Href; reason: RouteDenyReason; message: string }

/** Central UX copy for denied access (kept out of components). */
export const ACCESS_MESSAGES: Record<RouteDenyReason, string> = {
  guest_only: 'You are already signed in.',
  auth_required: 'Please sign in to continue.',
  gender_required:
    'SHEconomy seller tools are for women. Complete gender verification to continue.',
  verification_required: 'Please complete verification to access this area.',
  insufficient_role: "You don't have permission to access this area.",
  incomplete_profile: 'Finish setting up your profile to continue.',
}

export type ResolveRouteAccessInput = {
  pathname: string
  isAuthenticated: boolean
  role: string | null | undefined
  gender: boolean | null | undefined
  isVerified?: boolean | null
}

/**
 * The one function that decides access. Callers handle loading state before
 * calling this (there is no "still loading" decision here).
 */
export function resolveRouteAccess(input: ResolveRouteAccessInput): RouteAccessDecision {
  const { pathname, isAuthenticated, gender, isVerified } = input
  const rule = getRouteAccessRule(pathname)
  const role = normalizeRole(input.role)

  if (rule.access === 'PUBLIC') {
    return { status: 'allow' }
  }

  if (rule.access === 'GUEST_ONLY') {
    if (isAuthenticated) {
      return {
        status: 'redirect',
        href: getDefaultRouteForRole(role),
        reason: 'guest_only',
        message: ACCESS_MESSAGES.guest_only,
      }
    }
    return { status: 'allow' }
  }

  // AUTH_ONLY + ROLE_BASED both require a signed-in user.
  if (!isAuthenticated) {
    return {
      status: 'signin',
      returnTo: pathname,
      reason: 'auth_required',
      message: ACCESS_MESSAGES.auth_required,
    }
  }

  const adminBypass = isAdminRole(role) && FEATURE_FLAGS.ADMIN_BYPASSES_RESTRICTIONS

  if (
    !adminBypass &&
    requiresGenderVerification(pathname) &&
    !hasVerifiedFemaleAccess(gender, isVerified)
  ) {
    return {
      status: 'redirect',
      href: appRoutes.verifyGender,
      reason: 'gender_required',
      message: ACCESS_MESSAGES.gender_required,
    }
  }

  if (!adminBypass && requiresVerification(pathname) && !isVerified) {
    return {
      status: 'redirect',
      href: appRoutes.verifyGender,
      reason: 'verification_required',
      message: ACCESS_MESSAGES.verification_required,
    }
  }

  if (rule.access === 'ROLE_BASED' && rule.roles && rule.roles.length > 0) {
    if (!role) {
      return {
        status: 'denied',
        href: FALLBACK_HOME as Href,
        reason: 'incomplete_profile',
        message: ACCESS_MESSAGES.incomplete_profile,
      }
    }
    if (!rule.roles.includes(role)) {
      return {
        status: 'denied',
        href: getDefaultRouteForRole(role),
        reason: 'insufficient_role',
        message: `${ACCESS_MESSAGES.insufficient_role} This area requires ${getRoleNames(
          rule.roles,
        )} access.`,
      }
    }
  }

  return { status: 'allow' }
}

/**
 * Explicit-roles variant used by the hooks (`useAdminProtection`, etc.) when the
 * caller knows exactly which roles are allowed rather than deriving them from the
 * route table. `options` mirror the old `useRouteProtection` API.
 */
export type RoleCheckOptions = {
  requireGenderVerification?: boolean
  requireVerification?: boolean
  allowUnauthenticated?: boolean
}

export function resolveRoleAccess(
  input: ResolveRouteAccessInput & { allowedRoles: readonly UserRole[] },
  options: RoleCheckOptions = {},
): RouteAccessDecision {
  const { pathname, isAuthenticated, gender, isVerified, allowedRoles } = input
  const role = normalizeRole(input.role)

  if (options.allowUnauthenticated) {
    if (isAuthenticated) {
      return {
        status: 'redirect',
        href: getDefaultRouteForRole(role),
        reason: 'guest_only',
        message: ACCESS_MESSAGES.guest_only,
      }
    }
    return { status: 'allow' }
  }

  if (!isAuthenticated) {
    return {
      status: 'signin',
      returnTo: pathname,
      reason: 'auth_required',
      message: ACCESS_MESSAGES.auth_required,
    }
  }

  const adminBypass = isAdminRole(role) && FEATURE_FLAGS.ADMIN_BYPASSES_RESTRICTIONS

  if (
    !adminBypass &&
    options.requireGenderVerification &&
    !hasVerifiedFemaleAccess(gender, isVerified)
  ) {
    return {
      status: 'redirect',
      href: appRoutes.verifyGender,
      reason: 'gender_required',
      message: ACCESS_MESSAGES.gender_required,
    }
  }

  if (!adminBypass && options.requireVerification && !isVerified) {
    return {
      status: 'redirect',
      href: appRoutes.verifyGender,
      reason: 'verification_required',
      message: ACCESS_MESSAGES.verification_required,
    }
  }

  if (allowedRoles.length > 0) {
    if (!role) {
      return {
        status: 'denied',
        href: FALLBACK_HOME as Href,
        reason: 'incomplete_profile',
        message: ACCESS_MESSAGES.incomplete_profile,
      }
    }
    if (!allowedRoles.includes(role)) {
      return {
        status: 'denied',
        href: getDefaultRouteForRole(role),
        reason: 'insufficient_role',
        message: `${ACCESS_MESSAGES.insufficient_role} This area requires ${getRoleNames(
          allowedRoles,
        )} access.`,
      }
    }
  }

  return { status: 'allow' }
}
