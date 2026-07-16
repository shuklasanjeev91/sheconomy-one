import { Icons } from '~/components/ui'

type IconType = (typeof Icons)[keyof typeof Icons]

/** Stable identifiers for each shop-settings section. */
export type SettingsSectionId =
  | 'general'
  | 'connect'
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
 * The shop-settings sidebar navigation. Sections marked `ready` are
 * implemented; the rest render a "coming soon" placeholder and are built out
 * incrementally. Shared across web + mobile so the two stay in sync.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Configure your shop identity and core preferences.',
    icon: Icons.SlidersHorizontal,
    ready: true,
  },
  {
    id: 'connect',
    label: 'Connect',
    description: 'Manage your contact details, shop address, and social platforms.',
    icon: Icons.Share2,
    ready: true,
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Manage how you receive funds, connected bank accounts, and tax documentation.',
    icon: Icons.CreditCard,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Control how you receive order updates, marketing insights, and customer messages.',
    icon: Icons.Bell,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Manage sign-in, team access, and role-based permissions for your shop.',
    icon: Icons.ShieldCheck,
  },
  {
    id: 'shipping',
    label: 'Shipping',
    description: 'Set up delivery zones, international rates, and preferred courier partners.',
    icon: Icons.Truck,
  },
  {
    id: 'returns',
    label: 'Returns',
    description: 'Define return windows, refund rules, and reverse-logistics preferences.',
    icon: Icons.Undo2,
  },
] as const

export function getSettingsSection(id: SettingsSectionId): SettingsSection {
  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? SETTINGS_SECTIONS[0]
}
