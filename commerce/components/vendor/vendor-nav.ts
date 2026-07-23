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
  /** Nested rows revealed by expanding this item (e.g. Settings sections). */
  children?: VendorNavItem[]
}

/** Build a `/vendor/settings?section=<id>` link for a settings sub-item. */
function settingsHref(section: string): Href {
  return vendorRoutes.settingsSection(section)
}

/**
 * Settings sub-sections, surfaced as a dropdown under the main "Settings" item.
 * All sections below are implemented in VendorSettingsScreen.
 */
const SETTINGS_CHILDREN: VendorNavItem[] = [
  {
    id: 'settings-general',
    label: 'General',
    description: 'Shop identity, hours, categories, and currency.',
    icon: Icons.SlidersHorizontal,
    href: settingsHref('general'),
    ready: true,
  },
  {
    id: 'settings-connect',
    label: 'Connect',
    description: 'Contact details, shop address, and social platforms.',
    icon: Icons.Share2,
    href: settingsHref('connect'),
    ready: true,
  },
  {
    id: 'settings-payments',
    label: 'Payment Methods',
    description: 'Manage how you receive funds from your customers worldwide.',
    icon: Icons.CreditCard,
    href: settingsHref('payments'),
    ready: true,
  },
  {
    id: 'settings-notifications',
    label: 'Notifications',
    description: 'Order, marketing, and customer alerts.',
    icon: Icons.Bell,
    href: settingsHref('notifications'),
    ready: true,
  },
  {
    id: 'settings-security',
    label: 'Security',
    description: 'Sign-in, team access, and permissions.',
    icon: Icons.ShieldCheck,
    href: settingsHref('security'),
    ready: true,
  },
  {
    id: 'settings-shipping',
    label: 'Shipping',
    description: 'Delivery zones and courier partners.',
    icon: Icons.Truck,
    href: settingsHref('shipping'),
    ready: true,
  },
  {
    id: 'settings-returns',
    label: 'Return Policies',
    description: 'Return windows, services, and shipping rules.',
    icon: Icons.Undo2,
    href: settingsHref('returns'),
    ready: true,
  },
]

export type VendorNavGroup = {
  title: string
  items: VendorNavItem[]
}

export const VENDOR_NAV_GROUPS: VendorNavGroup[] = [
  {
    title: 'Storefront',
    items: [
      {
        id: 'myshop',
        label: 'My Shop',
        description: 'Your storefront profile, details, and health.',
        icon: Icons.Store,
        href: vendorRoutes.myShop,
        ready: true,
      },
      {
        id: 'products',
        label: 'Products',
        description: 'Manage listings and inventory.',
        icon: Icons.Package,
        href: vendorRoutes.products,
        ready: true,
      },
      {
        id: 'orders',
        label: 'Orders',
        description: 'Track and fulfil customer orders.',
        icon: Icons.ShoppingBag,
        href: vendorRoutes.orders,
        ready: true,
      },
    ],
  },
  {
    title: 'Growth',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Traffic, sales, and engagement trends.',
        icon: Icons.BarChart3,
        href: vendorRoutes.analytics,
        ready: true,
      },
      {
        id: 'delivery',
        label: 'Delivery',
        description: 'Shipping options and fulfilment.',
        icon: Icons.Truck,
        href: vendorRoutes.delivery,
        ready: true,
      },
      {
        id: 'ads',
        label: 'Ads & Promo',
        description: 'Campaigns and promotions.',
        icon: Icons.Megaphone,
        href: vendorRoutes.ads,
        ready: true,
      },
      {
        id: 'reviews',
        label: 'Reviews',
        description: 'Customer ratings and feedback.',
        icon: Icons.Star,
        href: vendorRoutes.reviews,
        ready: true,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        id: 'settings',
        label: 'Shop settings',
        description: 'Storefront config — personal account prefs live at Account settings.',
        icon: Icons.Settings,
        href: SETTINGS_CHILDREN[0].href,
        ready: true,
        children: SETTINGS_CHILDREN,
      },
    ],
  },
]

export const VENDOR_NAV_ITEMS: VendorNavItem[] = VENDOR_NAV_GROUPS.flatMap((group) => group.items)

export const VENDOR_SETTINGS_SECTION_IDS = [
  'general',
  'connect',
  'payments',
  'notifications',
  'security',
  'shipping',
  'returns',
] as const

export type VendorSettingsSectionId = (typeof VENDOR_SETTINGS_SECTION_IDS)[number]

export function normalizeSettingsSectionParam(
  raw: string | string[] | undefined | null,
): VendorSettingsSectionId {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase()
  if (value && VENDOR_SETTINGS_SECTION_IDS.includes(value as VendorSettingsSectionId)) {
    return value as VendorSettingsSectionId
  }
  return 'general'
}

/** Parse `?section=` from the browser location (web fallback when router params lag). */
export function readSettingsSectionFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('section')
  } catch {
    return null
  }
}

export function getVendorSettingsActiveSubId(section: VendorSettingsSectionId): string {
  return `settings-${section}`
}

/** Strip query/hash segments so pathname comparisons stay stable on web. */
export function normalizeVendorPathname(pathname: string): string {
  const pathOnly = pathname.split('?')[0]?.split('#')[0] ?? pathname
  return pathOnly.replace(/\/+$/, '') || '/vendor'
}

export function readSettingsSectionFromPathname(pathname: string): string | null {
  const queryStart = pathname.indexOf('?')
  if (queryStart === -1) return null
  const query = pathname.slice(queryStart + 1).split('#')[0]
  try {
    return new URLSearchParams(query).get('section')
  } catch {
    return null
  }
}

/** Resolve highlighted settings sub-nav id from pathname + section param / URL. */
export function resolveVendorSettingsActiveSubId(
  pathname: string,
  rawSection?: string | string[] | null,
): string | undefined {
  const normalizedPath = normalizeVendorPathname(pathname)
  if (normalizedPath !== '/vendor/settings') return undefined

  const fromPathname = readSettingsSectionFromPathname(pathname)
  const fromLocation =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('section')
      : null
  const paramValue = Array.isArray(rawSection) ? rawSection[0] : rawSection

  const section = normalizeSettingsSectionParam(
    fromPathname ?? fromLocation ?? paramValue ?? 'general',
  )

  return getVendorSettingsActiveSubId(section)
}

export function parseSettingsSectionFromHref(href: Href | string): VendorSettingsSectionId | null {
  const match = String(href).match(/[?&]section=([^&]+)/)
  if (!match?.[1]) return null
  return normalizeSettingsSectionParam(decodeURIComponent(match[1]))
}

export function isVendorSettingsChildActive(
  child: VendorNavItem,
  activeSubId?: string,
): boolean {
  if (activeSubId && child.id === activeSubId) return true
  if (!activeSubId) return false
  const activeSection = activeSubId.replace(/^settings-/, '')
  const childSection = parseSettingsSectionFromHref(child.href)
  return childSection != null && childSection === activeSection
}

/** Resolve the active nav item from the current pathname (defaults to My Shop). */
export function getActiveVendorNavItem(pathname: string): VendorNavItem {
  const normalized = normalizeVendorPathname(pathname)

  if (normalized === '/vendor') return VENDOR_NAV_ITEMS[0]

  return (
    VENDOR_NAV_ITEMS.find((item) => {
      // Compare on the path only — nav hrefs may carry query strings (e.g. `?section=`).
      const href = normalizeVendorPathname(String(item.href).split('?')[0])
      return normalized === href || normalized.startsWith(`${href}/`)
    }) ?? VENDOR_NAV_ITEMS[0]
  )
}

/** Derive a readable section title from a `/vendor/*` pathname (for placeholder pages). */
export function getVendorSectionTitle(pathname: string): string {
  return getActiveVendorNavItem(pathname).label
}
