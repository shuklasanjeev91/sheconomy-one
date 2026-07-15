import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Icons } from '~/components/ui'
import { appRoutes } from '~/lib/routes'

export type SettingsSectionId =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'commerce'
  | 'community'
  | 'chat'
  | 'class'
  | 'co-work'
  | 'shop'
  | 'privacy'
  | 'about'

export type SettingsNavItem = {
  id: SettingsSectionId
  label: string
  description: string
  href: Href
  icon: ComponentType<{ size?: number; color?: string }>
  /** Hide unless seller / shop manager. */
  sellerOnly?: boolean
  group: 'account' | 'products' | 'more'
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'Sign out and profile',
    href: appRoutes.settingsSection('account'),
    icon: Icons.User,
    group: 'account',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme for every tab',
    href: appRoutes.settingsSection('appearance'),
    icon: Icons.Palette,
    group: 'account',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Device push master switch',
    href: appRoutes.settingsSection('notifications'),
    icon: Icons.Bell,
    group: 'account',
  },
  {
    id: 'commerce',
    label: 'Marketplace',
    description: 'Orders, cart, and buyer alerts',
    href: appRoutes.settingsSection('commerce'),
    icon: Icons.Store,
    group: 'products',
  },
  {
    id: 'community',
    label: 'Community',
    description: 'Feed, network, and digests',
    href: appRoutes.settingsSection('community'),
    icon: Icons.Users,
    group: 'products',
  },
  {
    id: 'chat',
    label: 'Chat',
    description: 'Messages and call alerts',
    href: appRoutes.settingsSection('chat'),
    icon: Icons.MessageCircle,
    group: 'products',
  },
  {
    id: 'class',
    label: 'Classes',
    description: 'Lessons and enrollments',
    href: appRoutes.settingsSection('class'),
    icon: Icons.GraduationCap,
    group: 'products',
  },
  {
    id: 'co-work',
    label: 'Co-Work',
    description: 'Meetings and reminders',
    href: appRoutes.settingsSection('co-work'),
    icon: Icons.Video,
    group: 'products',
  },
  {
    id: 'shop',
    label: 'Manage shop',
    description: 'Seller order and stock alerts',
    href: appRoutes.settingsSection('shop'),
    icon: Icons.ShoppingBag,
    sellerOnly: true,
    group: 'products',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'Visibility and unlock',
    href: appRoutes.settingsSection('privacy'),
    icon: Icons.Shield,
    group: 'more',
  },
  {
    id: 'about',
    label: 'About',
    description: 'Help, AI, and version',
    href: appRoutes.settingsSection('about'),
    icon: Icons.Info,
    group: 'more',
  },
]

export function settingsSectionFromPath(pathname: string): SettingsSectionId | null {
  const match = pathname.match(/^\/settings\/([^/]+)/)
  if (!match) return pathname === '/settings' || pathname === '/settings/' ? null : null
  const id = match[1] as SettingsSectionId
  return SETTINGS_NAV.some((item) => item.id === id) ? id : null
}

export function filterSettingsNav(showShop: boolean): SettingsNavItem[] {
  return SETTINGS_NAV.filter((item) => (item.sellerOnly ? showShop : true))
}
