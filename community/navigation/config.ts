import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Icons } from '~/components/ui'
import { brandColors, sheconomyLight } from '~/config/brand-colors'
import { communityRoutes } from '~/lib/routes'

export type CommunityNavIcon = ComponentType<{ size?: number; color?: string; fill?: string }>

export type CommunityNavItem = {
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
  authRequired?: boolean
}

/** On-brand icon backgrounds — mild per-item distinction within the SHEconomy palette. */
const nav = {
  primary: brandColors.primary,
  dark: brandColors.primaryDark,
  light: brandColors.primaryLight,
  coral: brandColors.coral,
  rose: sheconomyLight.sheconomy7,
  muted: sheconomyLight.sheconomy8,
  soft: sheconomyLight.sheconomy6,
} as const

/** Left sidebar — community browse routes; create actions live in the right rail quick links. */
export const COMMUNITY_LEFT_NAV = [
  { href: communityRoutes.home, label: 'Home', icon: Icons.Home, iconBg: nav.primary },
  { href: communityRoutes.network, label: 'Network', icon: Icons.Users, iconBg: nav.light },
  { href: communityRoutes.saved, label: 'Saved', icon: Icons.Bookmark, iconBg: nav.dark, authRequired: true },
  { href: communityRoutes.analytics, label: 'Analytics', icon: Icons.BarChart3, iconBg: nav.muted, authRequired: true },
  { href: communityRoutes.ads, label: 'Ads Manager', icon: Icons.Megaphone, iconBg: nav.primary, authRequired: true },
  { href: communityRoutes.groups, label: 'Groups', icon: Icons.UsersRound, iconBg: nav.coral },
  { href: communityRoutes.events, label: 'Events', icon: Icons.Calendar, iconBg: nav.rose },
  { href: communityRoutes.companies, label: 'Pages', icon: Icons.Building2, iconBg: nav.primary },
  { href: communityRoutes.jobs, label: 'Jobs', icon: Icons.Briefcase, iconBg: nav.coral },
  { href: communityRoutes.stories, label: 'Stories', icon: Icons.Film, iconBg: nav.light },
  { href: communityRoutes.storyCreate, label: 'Add story', icon: Icons.PlusCircle, iconBg: nav.primary, authRequired: true },
  {
    href: communityRoutes.companyCreate,
    label: 'Create page',
    icon: Icons.Building2,
    iconBg: nav.dark,
    authRequired: true,
  },
] as const satisfies ReadonlyArray<CommunityNavItem>

export const COMMUNITY_LEFT_NAV_VISIBLE = 7

/** Quick browse links — community shortcuts not in the default left sidebar list */
export const COMMUNITY_DISCOVER_LINKS = [
  { href: communityRoutes.createPost, label: 'Create post', icon: Icons.PenSquare, iconBg: nav.primary },
  { href: communityRoutes.groupCreate, label: 'Create group', icon: Icons.UsersRound, iconBg: nav.coral },
  { href: communityRoutes.eventCreate, label: 'Create event', icon: Icons.CalendarPlus, iconBg: nav.rose },
] as const satisfies ReadonlyArray<{
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
}>
