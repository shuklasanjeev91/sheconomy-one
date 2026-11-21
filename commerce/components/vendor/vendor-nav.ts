import type { Href } from 'one'
import { Platform } from 'react-native'

import { Icons } from '~/components/ui'
import { vendorRoutes } from '~/lib/routes'

type IconType = (typeof Icons)[keyof typeof Icons]

export type VendorNavItem = {
  id: string
  label: string
  description: string
  icon: IconType
  href: Href
  /** Whether the destination is a real, functional page (vs. a "coming soon" stub). */
  ready?: boolean
  /** Nested rows revealed by expanding this item (e.g. Orders sections). */
  children?: VendorNavItem[]
  /** Extra path prefixes that should highlight this row. */
  alsoActive?: readonly string[]
}

/** Build a `/vendor/settings?section=<id>` link for a settings sub-item. */
function settingsHref(section: VendorSettingsSectionId): Href {
  return vendorRoutes.settingsSection(section)
}

export type VendorNavGroup = {
  title: string
  items: VendorNavItem[]
}

export const VENDOR_NAV_GROUPS: VendorNavGroup[] = [
  {
    title: '',
    items: [
      {
        id: 'myshop',
        label: 'Dashboard',
        description: 'Tasks, open orders, and a snapshot of the shop.',
        icon: Icons.LayoutDashboard,
        href: vendorRoutes.myShop,
        ready: true,
      },
      {
        id: 'products',
        label: 'Listings',
        description: 'Create, edit, and restock what you sell.',
        icon: Icons.Tag,
        href: vendorRoutes.products,
        alsoActive: [vendorRoutes.bundles, vendorRoutes.createListing],
        ready: true,
      },
      {
        id: 'messages',
        label: 'Messages',
        description: 'Buyer questions and reviews that need a reply.',
        icon: Icons.MessageSquare,
        href: vendorRoutes.reviews,
        ready: true,
      },
      {
        id: 'orders',
        label: 'Orders & shipping',
        description: 'Ship open orders, add tracking, and handle requests.',
        icon: Icons.ShoppingBag,
        href: vendorRoutes.orders,
        alsoActive: [vendorRoutes.delivery],
        ready: true,
      },
      {
        id: 'analytics',
        label: 'Stats',
        description: 'Orders, revenue, and traffic.',
        icon: Icons.BarChart3,
        href: vendorRoutes.analytics,
        alsoActive: [vendorRoutes.customers],
        ready: true,
      },
      {
        id: 'ads',
        label: 'Marketing',
        description: 'Ads, sales, and discounts.',
        icon: Icons.Megaphone,
        href: vendorRoutes.ads,
        alsoActive: [vendorRoutes.discounts],
        ready: true,
      },
      {
        id: 'wallet',
        label: 'Finances',
        description: 'Payment account, deposits, and verification.',
        icon: Icons.Wallet,
        href: vendorRoutes.wallet,
        alsoActive: [settingsHref('payments'), settingsHref('verification')],
        ready: true,
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Shop info, policies, shipping, and team.',
        icon: Icons.Settings,
        href: vendorRoutes.settings,
        ready: true,
      },
    ],
  },
]

export const VENDOR_NAV_ITEMS: VendorNavItem[] = VENDOR_NAV_GROUPS.flatMap((group) => group.items)

// ============= SECTION-HOSTED SUB-PAGES =============
//
// A few `/vendor/*` pages render their sub-pages from a `?section=` query param
// instead of nested routes, so a single screen file owns the section switch and
// deep links behave identically on web and native. Each hosting page registers
// itself below; everything sub-nav related (URL parsing, highlighted row) is
// derived from that registry rather than hard-coded per page.

export const VENDOR_SETTINGS_SECTION_IDS = [
  'hub',
  'general',
  'gst',
  'connect',
  'verification',
  'payments',
  'notifications',
  'security',
  'shipping',
  'warehouse',
  'returns',
] as const

export type VendorSettingsSectionId = (typeof VENDOR_SETTINGS_SECTION_IDS)[number]

export const VENDOR_ORDERS_SECTION_IDS = ['inbox', 'all', 'issues', 'fulfillments'] as const

export type VendorOrdersSectionId = (typeof VENDOR_ORDERS_SECTION_IDS)[number]

type VendorSectionRoute = {
  /** Logical owner for section sub-ids (`settings-*`, `orders-*`). */
  navItemId: string
  /** Normalized pathname of the hosting page. */
  path: string
  sectionIds: readonly string[]
  defaultSection: string
}

const VENDOR_SECTION_ROUTES: VendorSectionRoute[] = [
  {
    navItemId: 'orders',
    path: '/vendor/orders',
    sectionIds: VENDOR_ORDERS_SECTION_IDS,
    defaultSection: 'inbox',
  },
  {
    navItemId: 'settings',
    path: '/vendor/settings',
    sectionIds: VENDOR_SETTINGS_SECTION_IDS,
    defaultSection: 'hub',
  },
]

/** Strip query/hash segments so pathname comparisons stay stable on web. */
export function normalizeVendorPathname(pathname: string): string {
  const pathOnly = pathname.split('?')[0]?.split('#')[0] ?? pathname
  return pathOnly.replace(/\/+$/, '') || '/vendor'
}

/** The section-hosting page a pathname belongs to, if any. */
function findVendorSectionRoute(pathname: string): VendorSectionRoute | null {
  const normalized = normalizeVendorPathname(pathname)
  return VENDOR_SECTION_ROUTES.find((route) => route.path === normalized) ?? null
}

/** The nav item id that owns the `?section=` param on this pathname. */
export function getVendorSectionNavItemId(pathname: string): string | null {
  return findVendorSectionRoute(pathname)?.navItemId ?? null
}

function normalizeSectionFor(
  route: VendorSectionRoute,
  raw: string | string[] | undefined | null,
): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase()
  return value && route.sectionIds.includes(value) ? value : route.defaultSection
}

export function normalizeSettingsSectionParam(
  raw: string | string[] | undefined | null,
): VendorSettingsSectionId {
  const route = VENDOR_SECTION_ROUTES.find((entry) => entry.navItemId === 'settings')!
  return normalizeSectionFor(route, raw) as VendorSettingsSectionId
}

export function normalizeOrdersSectionParam(
  raw: string | string[] | undefined | null,
): VendorOrdersSectionId {
  const route = VENDOR_SECTION_ROUTES.find((entry) => entry.navItemId === 'orders')!
  return normalizeSectionFor(route, raw) as VendorOrdersSectionId
}

/** Sub-nav id for a section row (e.g. `orders-issues`, `settings-payments`). */
export function getVendorSectionSubId(navItemId: string, section: string): string {
  return `${navItemId}-${section}`
}

/** Read `?section=` out of a full path that still carries its query string. */
export function readSectionFromPathname(pathname: string): string | null {
  const queryStart = pathname.indexOf('?')
  if (queryStart === -1) return null
  const query = pathname.slice(queryStart + 1).split('#')[0]
  try {
    return new URLSearchParams(query).get('section')
  } catch {
    return null
  }
}

/** Parse `?section=` from the browser location (web fallback when router params lag). */
export function readSectionFromLocation(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('section')
  } catch {
    return null
  }
}

/**
 * Resolve which section-hosted sub-page the current URL points at.
 *
 * Reads the section from the pathname first, then the browser location, then
 * the router param — on web the router's params can lag a `history.pushState`,
 * so the URL is the more reliable source.
 */
export function resolveVendorSection(
  pathname: string,
  rawSection?: string | string[] | null,
): { navItemId: string; section: string } | null {
  const route = findVendorSectionRoute(pathname)
  if (!route) return null

  const paramValue = Array.isArray(rawSection) ? rawSection[0] : rawSection
  const section = normalizeSectionFor(
    route,
    readSectionFromPathname(pathname) ?? readSectionFromLocation() ?? paramValue,
  )

  return { navItemId: route.navItemId, section }
}

/** Resolve the highlighted sub-nav id from the pathname + section param / URL. */
export function resolveVendorActiveSubId(
  pathname: string,
  rawSection?: string | string[] | null,
): string | undefined {
  const resolved = resolveVendorSection(pathname, rawSection)
  if (!resolved) return undefined
  return getVendorSectionSubId(resolved.navItemId, resolved.section)
}

/** The sub-nav id a nav child's href resolves to, if it targets a section page. */
function subIdFromHref(href: Href | string): string | null {
  const raw = String(href)
  const route = findVendorSectionRoute(raw)
  if (!route) return null
  const match = raw.match(/[?&]section=([^&]+)/)
  const section = normalizeSectionFor(
    route,
    match?.[1] ? decodeURIComponent(match[1]) : null,
  )
  return getVendorSectionSubId(route.navItemId, section)
}

export function isVendorNavChildActive(child: VendorNavItem, activeSubId?: string): boolean {
  if (!activeSubId) return false
  if (child.id === activeSubId) return true
  return subIdFromHref(child.href) === activeSubId
}

/** Highlight a nested row whose href is its own page, not a `?section=` link. */
export function isVendorChildPathActive(
  child: VendorNavItem,
  pathname: string,
  activeSubId?: string,
): boolean {
  if (isVendorNavChildActive(child, activeSubId)) return true
  const raw = String(child.href)
  if (raw.includes('section=')) return false
  const normalized = normalizeVendorPathname(pathname)
  const path = normalizeVendorPathname(raw.split('?')[0] ?? raw)
  return normalized === path || normalized.startsWith(`${path}/`)
}

/** Whether a leaf (or parent) nav row should highlight for the current URL. */
export function isVendorNavItemActive(
  item: VendorNavItem,
  activeId: string,
  activeSubId?: string,
  pathname?: string,
): boolean {
  if (item.children?.length) {
    const groupActive =
      item.id === activeId ||
      (pathname ? item.id === getVendorSectionNavItemId(pathname) : false)
    const hasActiveChild = Boolean(
      activeSubId && item.children.some((child) => isVendorNavChildActive(child, activeSubId)),
    )
    return groupActive && !hasActiveChild
  }

  if (item.id === activeId) return true
  if (activeSubId && isVendorNavChildActive(item, activeSubId)) return true
  return false
}

/** Resolve the active nav item from the current pathname (defaults to My Shop). */
export function getActiveVendorNavItem(pathname: string): VendorNavItem {
  const normalized = normalizeVendorPathname(pathname)

  if (normalized === '/vendor') return VENDOR_NAV_ITEMS[0]

  const sectionResolved = resolveVendorSection(pathname)
  if (sectionResolved) {
    const subId = getVendorSectionSubId(sectionResolved.navItemId, sectionResolved.section)
    const bySub = VENDOR_NAV_ITEMS.find(
      (item) =>
        item.id === subId ||
        item.children?.some((child) => child.id === subId || isVendorNavChildActive(child, subId)),
    )
    if (bySub) {
      if (bySub.children?.some((child) => child.id === subId || isVendorNavChildActive(child, subId))) {
        return bySub
      }
      return bySub
    }
  }

  return bestVendorNavItem(pathname) ?? VENDOR_NAV_ITEMS[0]
}

/** Prefer a `?section=` link over a bare path when both match the URL. */
function hrefMatchScore(href: Href | string, pathname: string): number {
  const raw = String(href)
  const normalized = normalizeVendorPathname(pathname)
  const path = normalizeVendorPathname(raw.split('?')[0] ?? raw)
  const pathMatch = normalized === path || (path.length > 1 && normalized.startsWith(`${path}/`))
  if (!pathMatch) return 0
  const wanted = raw.match(/[?&]section=([^&]+)/)?.[1]
  if (!wanted) return 1
  const current = readSectionFromPathname(pathname) ?? readSectionFromLocation()
  return current === decodeURIComponent(wanted) ? 3 : 0
}

function bestVendorNavItem(pathname: string): VendorNavItem | null {
  let best: VendorNavItem | null = null
  let bestScore = 0
  for (const item of VENDOR_NAV_ITEMS) {
    const hrefs = [item.href, ...(item.alsoActive ?? [])]
    for (const href of hrefs) {
      const score = hrefMatchScore(href, pathname)
      if (score > bestScore) {
        best = item
        bestScore = score
      }
    }
    for (const child of item.children ?? []) {
      const score = hrefMatchScore(child.href, pathname)
      if (score > bestScore) {
        best = item
        bestScore = score
      }
    }
  }
  return best
}

/** Derive a readable section title from a `/vendor/*` pathname (for placeholder pages). */
export function getVendorSectionTitle(pathname: string): string {
  return getActiveVendorNavItem(pathname).label
}
