import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Icons } from '~/components/ui'
import { commerceRoutes, communityRoutes, coWorkRoutes, classRoutes } from '~/lib/routes'

export type CommunityNavIcon = ComponentType<{ size?: number; color?: string; fill?: string }>

export type CommunityNavItem = {
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
  authRequired?: boolean
}

/** Facebook-style left sidebar — single ordered list, expanded via "See more". */
export const COMMUNITY_LEFT_NAV = [
  { href: communityRoutes.home, label: 'Home', icon: Icons.Home, iconBg: '#1877f2' },
  { href: communityRoutes.network, label: 'Network', icon: Icons.Users, iconBg: '#1877f2' },
  { href: communityRoutes.groups, label: 'Groups', icon: Icons.UsersRound, iconBg: '#42b72a' },
  { href: commerceRoutes.shops, label: 'Marketplace', icon: Icons.Store, iconBg: '#42b72a' },
  { href: communityRoutes.events, label: 'Events', icon: Icons.Calendar, iconBg: '#8b5cf6' },
  { href: commerceRoutes.favorites, label: 'Saved', icon: Icons.Bookmark, iconBg: '#f02849', authRequired: true },
  { href: communityRoutes.companies, label: 'Companies', icon: Icons.Building2, iconBg: '#0a66c2' },
  { href: communityRoutes.jobs, label: 'Jobs', icon: Icons.Briefcase, iconBg: '#e67e22' },
  { href: communityRoutes.stories, label: 'Stories', icon: Icons.Film, iconBg: '#e41e3f' },
  { href: communityRoutes.eventCreate, label: 'Create event', icon: Icons.CalendarPlus, iconBg: '#8b5cf6', authRequired: true },
  { href: commerceRoutes.home, label: 'Shop home', icon: Icons.ShoppingBag, iconBg: '#f02849' },
  { href: commerceRoutes.myShops, label: 'My shops', icon: Icons.Store, iconBg: '#16a34a', authRequired: true },
  { href: classRoutes.home, label: 'Classes', icon: Icons.Radio, iconBg: '#e67e22' },
  { href: coWorkRoutes.home, label: 'Co-work', icon: Icons.Laptop, iconBg: '#64748b' },
  {
    href: communityRoutes.peopleTab('pending-received'),
    label: 'Invitations',
    icon: Icons.Mail,
    iconBg: '#f59e0b',
    authRequired: true,
  },
  {
    href: communityRoutes.peopleTab('followers'),
    label: 'Followers',
    icon: Icons.Heart,
    iconBg: '#ec4899',
    authRequired: true,
  },
  {
    href: communityRoutes.peopleTab('following'),
    label: 'Following',
    icon: Icons.UserPlus,
    iconBg: '#6366f1',
    authRequired: true,
  },
  {
    href: communityRoutes.peopleTab('suggestions'),
    label: 'Network suggestions',
    icon: Icons.Sparkles,
    iconBg: '#14b8a6',
    authRequired: true,
  },
  { href: communityRoutes.createPost, label: 'Create post', icon: Icons.PenSquare, iconBg: '#1877f2', authRequired: true },
  { href: communityRoutes.storyCreate, label: 'Add story', icon: Icons.PlusCircle, iconBg: '#e41e3f', authRequired: true },
  { href: communityRoutes.groupCreate, label: 'Create group', icon: Icons.UsersRound, iconBg: '#42b72a', authRequired: true },
  {
    href: communityRoutes.companyCreate,
    label: 'Create company',
    icon: Icons.Building2,
    iconBg: '#0a66c2',
    authRequired: true,
  },
  { href: communityRoutes.settings, label: 'Settings', icon: Icons.Settings, iconBg: '#65676b', authRequired: true },
] as const satisfies ReadonlyArray<CommunityNavItem>

export const COMMUNITY_LEFT_NAV_VISIBLE = 8

/** Quick browse links — only items not already in the left sidebar menu */
export const COMMUNITY_DISCOVER_LINKS = [
  { href: communityRoutes.jobs, label: 'Jobs', icon: Icons.Briefcase, iconBg: '#e67e22' },
  { href: classRoutes.home, label: 'Classes', icon: Icons.Radio, iconBg: '#e67e22' },
  { href: coWorkRoutes.home, label: 'Co-work', icon: Icons.Laptop, iconBg: '#64748b' },
] as const satisfies ReadonlyArray<{
  href: Href
  label: string
  icon: CommunityNavIcon
  iconBg: string
}>
