/**
 * Admin-console role slices. Used only by `/admin` screens.
 *
 * `profiles.role` (`profiles_role_check`):
 *   A admin · V vendor · U member · S seller ops · L logistics · F finance
 *
 * Members (`U`) never see this chrome. Vendors (`V`) use `/vendor`.
 */

import type { Href } from 'one'

import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

export type StaffNavId =
  | 'dashboard'
  | 'users'
  | 'shops'
  | 'sellers-ops'
  | 'payu-kyc'
  | 'products'
  | 'orders'
  | 'ops-orders'
  | 'disputes'
  | 'payments'
  | 'reconciliation'
  | 'cart'
  | 'categories'
  | 'sale-events'
  | 'sponsored-ads'
  | 'groups'
  | 'company-pages'
  | 'cms'
  | 'analytics'
  | 'settings'

export const STAFF_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.FINANCE,
  USER_ROLES.SELLER,
  USER_ROLES.LOGISTICS,
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

const STAFF_ROLE_SET = new Set<string>(STAFF_ROLES)

const STAFF_PATH_PREFIXES: ReadonlyArray<readonly [prefix: string, navId: StaffNavId]> = [
  ['/admin/company-pages', 'company-pages'],
  ['/admin/sponsored-ads', 'sponsored-ads'],
  ['/admin/sale-events', 'sale-events'],
  ['/admin/reconciliation', 'reconciliation'],
  ['/admin/sellers-ops', 'sellers-ops'],
  ['/admin/ops-orders', 'ops-orders'],
  ['/admin/disputes', 'disputes'],
  ['/admin/categories', 'categories'],
  ['/admin/analytics', 'analytics'],
  ['/admin/payments', 'payments'],
  ['/admin/payu-kyc', 'payu-kyc'],
  ['/admin/products', 'products'],
  ['/admin/settings', 'settings'],
  ['/admin/orders', 'orders'],
  ['/admin/groups', 'groups'],
  ['/admin/users', 'users'],
  ['/admin/shops', 'shops'],
  ['/admin/cart', 'cart'],
  ['/admin/cms', 'cms'],
  ['/admin', 'dashboard'],
]

const ALL_NAV_IDS: readonly StaffNavId[] = STAFF_PATH_PREFIXES.map(([, id]) => id).filter(
  (id, index, list) => list.indexOf(id) === index,
)

const ROLE_NAV: Record<UserRole, 'all' | readonly StaffNavId[]> = {
  [USER_ROLES.ADMIN]: 'all',
  [USER_ROLES.FINANCE]: [
    'dashboard',
    'orders',
    'ops-orders',
    'payments',
    'payu-kyc',
    'reconciliation',
    'disputes',
    'analytics',
  ],
  [USER_ROLES.SELLER]: [
    'dashboard',
    'shops',
    'sellers-ops',
    'payu-kyc',
    'products',
    'orders',
    'disputes',
    'sale-events',
  ],
  [USER_ROLES.LOGISTICS]: ['dashboard', 'orders', 'ops-orders', 'disputes', 'shops'],
  [USER_ROLES.VENDOR]: [],
  [USER_ROLES.USER]: [],
}

export type StaffWorkspace = {
  title: string
  subtitle: string
  homeHref: Href
  dashboardTitle: string
  dashboardDescription: string
}

const WORKSPACES: Record<StaffRole, StaffWorkspace> = {
  [USER_ROLES.ADMIN]: {
    title: 'Admin',
    subtitle: 'Platform console',
    homeHref: '/admin' as Href,
    dashboardTitle: 'Admin dashboard',
    dashboardDescription:
      'Platform command center for members, shops, catalog, orders, payments, and operations.',
  },
  [USER_ROLES.FINANCE]: {
    title: 'Finance',
    subtitle: 'Payments & revenue',
    homeHref: '/admin' as Href,
    dashboardTitle: 'Finance dashboard',
    dashboardDescription: 'Orders, payouts, refunds, and revenue — no member or catalog tools.',
  },
  [USER_ROLES.SELLER]: {
    title: 'Seller ops',
    subtitle: 'Shops & catalog',
    homeHref: '/admin' as Href,
    dashboardTitle: 'Seller dashboard',
    dashboardDescription: 'Shops, listings, and order activity for seller operations.',
  },
  [USER_ROLES.LOGISTICS]: {
    title: 'Logistics',
    subtitle: 'Orders & fulfilment',
    homeHref: '/admin' as Href,
    dashboardTitle: 'Logistics dashboard',
    dashboardDescription: 'Order flow, shop fulfilment, and delivery exceptions.',
  },
}

const DEFAULT_WORKSPACE: StaffWorkspace = {
  title: 'Console',
  subtitle: 'Staff tools',
  homeHref: '/' as Href,
  dashboardTitle: 'Dashboard',
  dashboardDescription: '',
}

/** Read `profiles.role` without going through app-wide route protection. */
export function readStaffRole(role: string | null | undefined): UserRole | null {
  if (!role) return null
  const trimmed = role.trim()
  if ((Object.values(USER_ROLES) as string[]).includes(trimmed)) return trimmed as UserRole
  return null
}

export function isStaffRole(role: UserRole | null | undefined): role is StaffRole {
  return !!role && STAFF_ROLE_SET.has(role)
}

export function canAccessStaffConsole(role: UserRole | null | undefined): boolean {
  return isStaffRole(role)
}

export function canAccessStaffNav(
  role: UserRole | null | undefined,
  navId: StaffNavId,
): boolean {
  if (!role) return false
  const allowed = ROLE_NAV[role]
  if (!allowed) return false
  if (allowed === 'all') return true
  return allowed.includes(navId)
}

export function getStaffNavIdForPath(pathname: string): StaffNavId | null {
  const normalized = pathname.replace(/\/+$/, '') || '/admin'
  for (const [prefix, navId] of STAFF_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return navId
  }
  return null
}

export function canAccessStaffPath(role: UserRole | null | undefined, pathname: string): boolean {
  if (!isStaffRole(role)) return false
  if (role === USER_ROLES.ADMIN) return true
  const navId = getStaffNavIdForPath(pathname)
  if (!navId) return false
  return canAccessStaffNav(role, navId)
}

export function getStaffWorkspace(role: UserRole | null | undefined): StaffWorkspace {
  if (!isStaffRole(role)) return DEFAULT_WORKSPACE
  return WORKSPACES[role]
}

export function getStaffRoleLabel(role: UserRole | null | undefined): string {
  if (!role) return 'Member'
  return USER_ROLE_LABELS[role] ?? 'Member'
}
