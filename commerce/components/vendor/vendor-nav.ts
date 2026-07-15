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
}

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
        href: vendorRoutes.settings,
        ready: true,
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
      const href = String(item.href).replace(/\/+$/, '')
      return normalized === href || normalized.startsWith(`${href}/`)
    }) ?? VENDOR_NAV_ITEMS[0]
  )
}

/** Derive a readable section title from a `/vendor/*` pathname (for placeholder pages). */
export function getVendorSectionTitle(pathname: string): string {
  return getActiveVendorNavItem(pathname).label
}
