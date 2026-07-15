import type { Href } from 'one'

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
  return `${String(vendorRoutes.settings)}?section=${section}` as Href
}

/**
 * Settings sub-sections, surfaced as a dropdown under the main "Settings" item.
 * Only **General** is functional today; the rest render a "coming soon" stub.
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
    description: 'Sync Shopify, Instagram, or ERP tools.',
    icon: Icons.Share2,
    href: settingsHref('connect'),
  },
  {
    id: 'settings-payments',
    label: 'Payments',
    description: 'Payout accounts and tax documentation.',
    icon: Icons.CreditCard,
    href: settingsHref('payments'),
  },
  {
    id: 'settings-notifications',
    label: 'Notifications',
    description: 'Order, marketing, and customer alerts.',
    icon: Icons.Bell,
    href: settingsHref('notifications'),
  },
  {
    id: 'settings-security',
    label: 'Security',
    description: 'Sign-in, team access, and permissions.',
    icon: Icons.ShieldCheck,
    href: settingsHref('security'),
  },
  {
    id: 'settings-shipping',
    label: 'Shipping',
    description: 'Delivery zones and courier partners.',
    icon: Icons.Truck,
    href: settingsHref('shipping'),
  },
  {
    id: 'settings-returns',
    label: 'Returns',
    description: 'Return windows and refund rules.',
    icon: Icons.Undo2,
    href: settingsHref('returns'),
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
      },
      {
        id: 'delivery',
        label: 'Delivery',
        description: 'Shipping options and fulfilment.',
        icon: Icons.Truck,
        href: vendorRoutes.delivery,
      },
      {
        id: 'ads',
        label: 'Ads & Promo',
        description: 'Campaigns and promotions.',
        icon: Icons.Megaphone,
        href: vendorRoutes.ads,
      },
      {
        id: 'reviews',
        label: 'Reviews',
        description: 'Customer ratings and feedback.',
        icon: Icons.Star,
        href: vendorRoutes.reviews,
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

/** Resolve the active nav item from the current pathname (defaults to My Shop). */
export function getActiveVendorNavItem(pathname: string): VendorNavItem {
  const normalized = pathname.replace(/\/+$/, '') || '/vendor'

  if (normalized === '/vendor') return VENDOR_NAV_ITEMS[0]

  return (
    VENDOR_NAV_ITEMS.find((item) => {
      // Compare on the path only — nav hrefs may carry query strings (e.g. `?section=`).
      const href = String(item.href).split('?')[0].replace(/\/+$/, '')
      return normalized === href || normalized.startsWith(`${href}/`)
    }) ?? VENDOR_NAV_ITEMS[0]
  )
}

/** Derive a readable section title from a `/vendor/*` pathname (for placeholder pages). */
export function getVendorSectionTitle(pathname: string): string {
  return getActiveVendorNavItem(pathname).label
}
