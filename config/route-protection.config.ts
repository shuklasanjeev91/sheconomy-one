/**
 * Centralised route-protection configuration.
 *
 * Everything the app needs to decide **who can open which route** lives here so
 * there is **no hardcoding** in the hooks, guards, or layouts. Adjust access by
 * editing this file only.
 *
 * Migrated from the old Next.js `config/middleware.config.js`, adapted to the
 * One (React Native + web) app:
 *   - Roles use the app's canonical codes `A` / `V` / `U` (see `USER_ROLES`).
 *   - Paths use the real routes shipped in this app (`lib/routes.ts`).
 *   - Server-only concerns (rate limiting, security headers, IP tracking) are
 *     intentionally omitted — they belong to an edge runtime this app does not
 *     have. Access is enforced client-side (see `hooks/useRouteProtection.ts`
 *     and `components/auth/RouteGuard.tsx`) on top of Supabase RLS.
 *
 * Gender note: in SHEconomy `profiles.gender === true` means **female**. The
 * platform is women-first: community / chat / notifications / create-shop /
 * profile / settings require a **verified female** tier (`lib/auth/access.ts` —
 * `gender` + `is_verified`). The seller console (`/vendor`) is role-gated
 * (vendor/admin) and is not a gender-deny surface. Guests, males, and members
 * who **skip** verification keep limited access (Commerce, Classes, Co-Work, and
 * an existing shop if they already have vendor role). The verification modal
 * always offers Skip; camera/face data is optional. Unverified members are
 * redirected off women-first routes (see `AppAccessGate`) and shown
 * `GenderDeniedModal` on their last safe route.
 */

import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'
import {
  isChatPath,
  isCommunityPath,
  isNotificationsPath,
} from '~/lib/routes'

/** How a route decides access. */
export type RouteAccessLevel =
  /** Anyone, signed in or not. */
  | 'PUBLIC'
  /** Only signed-out visitors (e.g. the sign-in screen). */
  | 'GUEST_ONLY'
  /** Any signed-in member, no specific role. */
  | 'AUTH_ONLY'
  /** Signed-in members whose role is in `roles`. */
  | 'ROLE_BASED'

export type RouteAccessRule = {
  access: RouteAccessLevel
  /** Required for `ROLE_BASED`; ignored otherwise. */
  roles?: readonly UserRole[]
}

/**
 * Per-prefix access rules. **Order matters**: more specific prefixes must come
 * before broader ones so `getRouteAccessRule` matches the correct one first.
 */
export const ROUTE_ACCESS: ReadonlyArray<readonly [prefix: string, rule: RouteAccessRule]> = [
  // --- Guest-only ---
  ['/auth/sign-in', { access: 'GUEST_ONLY' }],

  // --- Public auth plumbing ---
  ['/auth/callback', { access: 'PUBLIC' }],
  ['/auth/complete-profile', { access: 'AUTH_ONLY' }],
  ['/auth/verify-gender', { access: 'AUTH_ONLY' }],
  ['/auth', { access: 'PUBLIC' }],

  // --- Admin console (admins only) ---
  ['/admin', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN] }],

  // --- Vendor console + seller tooling (admins + vendors) ---
  ['/vendor', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN, USER_ROLES.VENDOR] }],
  ['/create-listing', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN, USER_ROLES.VENDOR] }],

  // --- Any signed-in member ---
  ['/create-my-shop', { access: 'AUTH_ONLY' }],
  ['/checkout', { access: 'AUTH_ONLY' }],
  ['/orders', { access: 'AUTH_ONLY' }],
  ['/payment-methods', { access: 'AUTH_ONLY' }],
  ['/addresses', { access: 'AUTH_ONLY' }],
  ['/profile', { access: 'AUTH_ONLY' }],
  ['/settings', { access: 'AUTH_ONLY' }],
] as const

/** Policy for any route not matched above. */
export const DEFAULT_ROUTE_RULE: RouteAccessRule = { access: 'PUBLIC' }

/**
 * Where to send an authenticated user who lacks permission for the route they
 * requested — their own "home base" for their role.
 */
export const DEFAULT_ROUTES: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: '/admin',
  [USER_ROLES.VENDOR]: '/vendor',
  [USER_ROLES.USER]: '/',
}

/** Fallback home for a signed-in user whose role is missing/unknown. */
export const FALLBACK_HOME = '/'

/**
 * Routes where unverified members (`is_verified !== true`) must complete human
 * verification before using the surface. Unverified members are redirected away by
 * `AppAccessGate` and see `GenderDeniedModal` on their previous safe route.
 */
export const GENDER_RESTRICTED_ROUTES: readonly string[] = [
  '/create-my-shop',
  '/community',
  '/chat',
  '/notifications',
  '/profile',
  '/settings',
]

/**
 * Routes that require identity verification (`profiles.is_verified`). Disabled
 * by default — the app's primary gate is gender verification. Flip the feature
 * flag below and list routes here to turn it on.
 */
export const VERIFICATION_REQUIRED_ROUTES: readonly string[] = []

export const FEATURE_FLAGS = {
  /** Enforce `GENDER_RESTRICTED_ROUTES`. */
  ENABLE_GENDER_VERIFICATION: true,
  /** Enforce `VERIFICATION_REQUIRED_ROUTES` (identity/email verification). */
  ENABLE_VERIFICATION: false,
  /** Admins skip the gender/verification gates (they manage every surface). */
  ADMIN_BYPASSES_RESTRICTIONS: true,
} as const

// ---------------------------------------------------------------------------
// Pure helpers (no side effects) — safe to import anywhere.
// ---------------------------------------------------------------------------

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** The access rule that governs `pathname`, or the default policy. */
export function getRouteAccessRule(pathname: string): RouteAccessRule {
  for (const [prefix, rule] of ROUTE_ACCESS) {
    if (matchesPrefix(pathname, prefix)) return rule
  }
  return DEFAULT_ROUTE_RULE
}

/** Whether `pathname` is gender-restricted (and the gate is enabled). */
export function requiresGenderVerification(pathname: string): boolean {
  if (!FEATURE_FLAGS.ENABLE_GENDER_VERIFICATION) return false
  return (
    GENDER_RESTRICTED_ROUTES.some((route) => matchesPrefix(pathname, route)) ||
    isCommunityPath(pathname) ||
    isChatPath(pathname) ||
    isNotificationsPath(pathname)
  )
}

/** Whether `pathname` requires identity verification (and the gate is enabled). */
export function requiresVerification(pathname: string): boolean {
  if (!FEATURE_FLAGS.ENABLE_VERIFICATION) return false
  return VERIFICATION_REQUIRED_ROUTES.some((route) => matchesPrefix(pathname, route))
}
