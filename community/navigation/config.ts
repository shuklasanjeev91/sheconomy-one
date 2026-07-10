import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Icons } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export type CommunityNavIcon = ComponentType<{ size?: number; color?: string; fill?: string }>

export type CommunityNavItem = {
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
  authRequired?: boolean
}

/** Left sidebar — community browse routes; create actions live in the right rail quick links. */
export const COMMUNITY_LEFT_NAV = [
  { href: communityRoutes.home, label: 'Home', icon: Icons.Home, iconBg: '#1877f2' },
  { href: communityRoutes.network, label: 'Network', icon: Icons.Users, iconBg: '#1877f2' },
  { href: communityRoutes.groups, label: 'Groups', icon: Icons.UsersRound, iconBg: '#42b72a' },
  { href: communityRoutes.events, label: 'Events', icon: Icons.Calendar, iconBg: '#8b5cf6' },
  { href: communityRoutes.companies, label: 'Pages', icon: Icons.Building2, iconBg: '#0a66c2' },
  { href: communityRoutes.jobs, label: 'Jobs', icon: Icons.Briefcase, iconBg: '#e67e22' },
  { href: communityRoutes.stories, label: 'Stories', icon: Icons.Film, iconBg: '#e41e3f' },
  { href: communityRoutes.storyCreate, label: 'Add story', icon: Icons.PlusCircle, iconBg: '#e41e3f', authRequired: true },
  {
    href: communityRoutes.companyCreate,
    label: 'Create page',
    icon: Icons.Building2,
    iconBg: '#0a66c2',
    authRequired: true,
  },
] as const satisfies ReadonlyArray<CommunityNavItem>

export const COMMUNITY_LEFT_NAV_VISIBLE = 7

/** Quick browse links — community shortcuts not in the default left sidebar list */
export const COMMUNITY_DISCOVER_LINKS = [
  { href: communityRoutes.createPost, label: 'Create post', icon: Icons.PenSquare, iconBg: '#1877f2' },
  { href: communityRoutes.groupCreate, label: 'Create group', icon: Icons.UsersRound, iconBg: '#42b72a' },
  { href: communityRoutes.eventCreate, label: 'Create event', icon: Icons.CalendarPlus, iconBg: '#8b5cf6' },
] as const satisfies ReadonlyArray<{
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
}>
