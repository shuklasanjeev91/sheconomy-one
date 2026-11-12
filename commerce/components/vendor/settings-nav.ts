import { Icons } from '~/components/ui'

type IconType = (typeof Icons)[keyof typeof Icons]

/** Stable identifiers for each shop-settings section. */
export type SettingsSectionId =
  | 'hub'
  | 'general'
  | 'gst'
  | 'connect'
  | 'verification'
  | 'payments'
  | 'notifications'
  | 'security'
  | 'shipping'
  | 'returns'

export type SettingsSection = {
  id: SettingsSectionId
  label: string
  description: string
  icon: IconType
  /** Whether the section is implemented (vs. a "coming soon" placeholder). */
  ready?: boolean
}

/**
 * The shop-settings section catalog. Used by the settings hub and section headers.
 * Sidebar placement lives in `vendor-nav.ts` (Money / Fulfillment / Shop setup).
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'hub',
    label: 'Shop setup',
    description: 'Jump to profile, verification, policies, and team settings.',
    icon: Icons.LayoutGrid,
    ready: true,
  },
  {
    id: 'general',
    label: 'Shop profile',
    description: 'Name, logo, hours, categories, and storefront currency.',
    icon: Icons.Store,
    ready: true,
  },
  {
    id: 'connect',
    label: 'Contact & address',
    description: 'Phone, email, shop address, and social links.',
    icon: Icons.MapPin,
    ready: true,
  },
  {
    id: 'gst',
    label: 'Verification',
    description: 'Tax & GST is collected inside Verification KYC (legacy deep link).',
    icon: Icons.BadgeCheck,
    ready: true,
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'KYC documents, Tax & GST, and bank details for payout review.',
    icon: Icons.BadgeCheck,
    ready: true,
  },
  {
    id: 'payments',
    label: 'Payouts',
    description: 'Settlement status and how you receive buyer payments.',
    icon: Icons.Banknote,
    ready: true,
  },
  {
    id: 'shipping',
    label: 'Shipping policies',
    description: 'Delivery fees, free-shipping thresholds, and zone rates.',
    icon: Icons.Truck,
    ready: true,
  },
  {
    id: 'returns',
    label: 'Return policies',
    description: 'Return windows, refund rules, and reverse logistics.',
    icon: Icons.Undo2,
    ready: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Order, stock, and marketing alerts for your shop.',
    icon: Icons.Bell,
    ready: true,
  },
  {
    id: 'security',
    label: 'Team & security',
    description: 'Sign-in, teammates, and shop permissions.',
    icon: Icons.ShieldCheck,
    ready: true,
  },
] as const

export function getSettingsSection(id: SettingsSectionId): SettingsSection {
  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? SETTINGS_SECTIONS[0]
}
