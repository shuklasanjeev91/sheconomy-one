import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Icons } from '~/components/ui'
import { openComposer } from '~/community/lib/composer-store'
import { openNewChat } from '~/chat/lib/chat-actions-store'
import type { AccessTier, AppFeature } from '~/lib/auth/access'
import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  isCartPath,
  isChatPath,
  isChatCallsPath,
  isChatGroupsPath,
  isChatConversationPath,
  isClassPath,
  isClassAudioPath,
  isClassHomePath,
  isClassVideoPath,
  isCoWorkPath,
  isCoWorkHomePath,
  isCoWorkSchedulePath,
  isCoWorkMeetingsPath,
  isCoWorkJoinPath,
  isCoWorkLivePath,
  isCommerceHomePath,
  isCommercePath,
  isCommerceShopsPath,
  isCommunityPath,
  isManageShopPath,
  isCreateShopPath,
  isCommunityFeedPath,
  isJobsPath,
  isNotificationsPath,
  isProfilePath,
  routes,
} from '~/lib/routes'

import { type AppUiTokens, appUiLight } from '~/lib/theme/app-ui'

import {
  formatBottomTabLabel,
  limitMiddleTabsForWidth,
  type BottomTabWidthTier,
} from './mobile-tab-bar-width'

export function getAppColors(ui: AppUiTokens = appUiLight) {
  return {
    brand: ui.brand,
    blue: ui.brand,
    icon: ui.icon,
    iconActive: ui.iconActive,
    border: ui.border,
    borderSubtle: ui.borderSubtle,
    surface: ui.surface,
    surfaceMuted: ui.surfaceMuted,
    page: ui.background,
    chip: ui.chip,
    chipHover: ui.chipHover,
    text: ui.text,
    textSecondary: ui.textSecondary,
    danger: ui.danger,
    onBrand: ui.onBrand,
  } as const
}

/** @deprecated Use `getAppColors(useAppUi())` in components. */
export const APP_COLORS = getAppColors()

export type AppNavIcon = ComponentType<{
  size?: number
  color?: string
  fill?: string
}>

export type AppCenterNavItem = {
  href: Href
  label: string
  icon: AppNavIcon
  feature: AppFeature
  match: (pathname: string) => boolean
}

export type AppMobileTabItem = {
  href: Href
  label: string
  icon: AppNavIcon
  match?: (pathname: string) => boolean
  /**
   * When set, tapping the tab runs this action instead of navigating to `href`
   * (e.g. opening the post composer overlay). `href` is kept as a fallback.
   */
  onPress?: () => void
}

/** Primary section tabs in the header / top bar. */
export const APP_CENTER_NAV: AppCenterNavItem[] = [
  {
    href: commerceRoutes.home,
    label: 'Commerce',
    icon: Icons.Store,
    feature: 'commerce',
    match: (path) => isCommercePath(path),
  },
  {
    href: communityRoutes.home,
    label: 'Community',
    icon: Icons.Users,
    feature: 'community',
    match: (path) => isCommunityPath(path),
  },
  {
    href: chatRoutes.home,
    label: 'Chat',
    icon: Icons.MessageCircle,
    feature: 'chat',
    match: (path) => isChatPath(path),
  },
  {
    href: classRoutes.home,
    label: 'Classes',
    icon: Icons.Radio,
    feature: 'class',
    match: (path) => isClassPath(path),
  },
  {
    href: coWorkRoutes.home,
    label: 'Co-Work',
    icon: Icons.Video,
    feature: 'co-work',
    match: (path) => isCoWorkPath(path) && !isCoWorkLivePath(path),
  },
]

/** Bottom tabs — commerce section (Home + You added automatically). */
export type CommerceMobileTabOptions = {
  hasShops: boolean
  primaryShopId?: string | null
}

export function getCommerceMobileTabs({
  hasShops,
  primaryShopId,
}: CommerceMobileTabOptions): AppMobileTabItem[] {
  const sellerHref =
    hasShops && primaryShopId
      ? commerceRoutes.manageShop(primaryShopId)
      : commerceRoutes.createShop

  return [
    {
      href: commerceRoutes.shops,
      label: 'Shops',
      icon: Icons.Store,
      match: (path) => isCommerceShopsPath(path),
    },
    {
      href: sellerHref,
      label: hasShops ? 'Manage shop' : 'Create shop',
      icon: hasShops ? Icons.Settings : Icons.PlusCircle,
      match: (path) => (hasShops ? isManageShopPath(path) : isCreateShopPath(path)),
    },
  ]
}

/** Global utilities — cart on mobile bottom tabs (alerts stay in desktop header). */
export const APP_GLOBAL_MOBILE_TABS: AppMobileTabItem[] = [
  {
    href: routes.cart,
    label: 'Cart',
    icon: Icons.ShoppingBag,
    match: (path) => isCartPath(path),
  },
]

export type BottomTabSection = 'commerce' | 'community' | 'chat' | 'class' | 'co-work'

export function getHomeMobileTab(section: BottomTabSection): AppMobileTabItem {
  switch (section) {
    case 'community':
      return {
        href: communityRoutes.home,
        label: 'Home',
        icon: Icons.Home,
        match: (path) => isCommunityFeedPath(path),
      }
    case 'chat':
      return {
        href: chatRoutes.home,
        label: 'Home',
        icon: Icons.Home,
        match: (path) =>
          path === chatRoutes.home ||
          (isChatConversationPath(path) && !isChatGroupsPath(path) && !isChatCallsPath(path)),
      }
    case 'class':
      return {
        href: classRoutes.home,
        label: 'Home',
        icon: Icons.Home,
        match: (path) => isClassHomePath(path),
      }
    case 'co-work':
      return {
        href: coWorkRoutes.home,
        label: 'Home',
        icon: Icons.Home,
        match: (path) => isCoWorkHomePath(path),
      }
    case 'commerce':
    default:
      return {
        href: commerceRoutes.home,
        label: 'Home',
        icon: Icons.Home,
        match: (path) => isCommerceHomePath(path),
      }
  }
}

export function getVisibleCenterNav(): AppCenterNavItem[] {
  return APP_CENTER_NAV
}

export function getAuthMobileTab(tier: AccessTier): AppMobileTabItem {
  if (tier === 'guest') {
    return {
      href: routes.signIn,
      label: 'You',
      icon: Icons.User,
      match: (path) => path.startsWith('/auth/sign-in'),
    }
  }

  if (tier === 'male') {
    return {
      href: routes.verifyGender,
      label: 'You',
      icon: Icons.User,
      match: (path) => path.startsWith('/auth/verify-gender'),
    }
  }

  return {
    href: routes.profile,
    label: 'You',
    icon: Icons.User,
    // Profile, settings, and notifications are one shared account surface across tabs.
    match: (path) => isProfilePath(path) || isNotificationsPath(path),
  }
}

/** Bottom tabs — community section (Home + Cart + You added automatically). */
export const APP_COMMUNITY_MOBILE_TABS: AppMobileTabItem[] = [
  {
    href: communityRoutes.network,
    label: 'Network',
    icon: Icons.Users,
    match: (path) => path.startsWith('/community/network'),
  },
  {
    href: communityRoutes.createPost,
    label: 'Create Post',
    icon: Icons.PlusCircle,
    match: (path) => path.startsWith('/community/create'),
    onPress: () => openComposer(),
  },
  {
    href: communityRoutes.jobs,
    label: 'Jobs',
    icon: Icons.Briefcase,
    match: (path) => isJobsPath(path),
  },
]

/** Bottom tabs — chat section (Home + You added automatically). WhatsApp-style. */
export const APP_CHAT_MOBILE_TABS: AppMobileTabItem[] = [
  {
    href: chatRoutes.groups,
    label: 'Groups',
    icon: Icons.Users,
    match: (path) => isChatGroupsPath(path),
  },
  {
    href: chatRoutes.home,
    label: 'New chat',
    icon: Icons.PenSquare,
    match: () => false,
    onPress: () => openNewChat(),
  },
  {
    href: chatRoutes.calls,
    label: 'Calls',
    icon: Icons.Phone,
    match: (path) => isChatCallsPath(path),
  },
]

/** Bottom tabs — classes: Video + Audio (Home covers hub / program detail). */
export const APP_CLASS_MOBILE_TABS: AppMobileTabItem[] = [
  {
    href: classRoutes.home,
    label: 'Video',
    icon: Icons.Play,
    match: (path) => isClassVideoPath(path) || isClassHomePath(path),
  },
  {
    href: classRoutes.audio,
    label: 'Audio',
    icon: Icons.Radio,
    match: (path) => isClassAudioPath(path),
  },
]

/** Bottom tabs — co-work section (Home + You added automatically). */
export const APP_COWORK_MOBILE_TABS: AppMobileTabItem[] = [
  {
    href: coWorkRoutes.schedule,
    label: 'Schedule',
    icon: Icons.Calendar,
    match: (path) => isCoWorkSchedulePath(path),
  },
  {
    href: coWorkRoutes.meetings,
    label: 'Meetings',
    icon: Icons.Video,
    match: (path) => isCoWorkMeetingsPath(path),
  },
  {
    href: coWorkRoutes.join,
    label: 'Join',
    icon: Icons.Hash,
    match: (path) => isCoWorkJoinPath(path),
  },
]

export function getMobileBottomTabSection(pathname: string): BottomTabSection | null {
  if (pathname.startsWith('/auth/') || pathname.startsWith('/ui-kit')) return null
  if (isCoWorkLivePath(pathname)) return null
  if (isChatPath(pathname)) return 'chat'
  if (isCommercePath(pathname)) return 'commerce'
  if (isCoWorkPath(pathname)) return 'co-work'
  if (isClassPath(pathname)) return 'class'
  // Shared account destinations stay on community chrome (profile/network context)
  if (
    pathname.startsWith('/community') ||
    isNotificationsPath(pathname) ||
    isProfilePath(pathname) ||
    pathname === routes.settings ||
    pathname.startsWith(`${String(routes.settings)}/`)
  ) {
    return 'community'
  }
  return 'commerce'
}

export function getMobileBottomTabMiddleTabs(
  section: BottomTabSection,
  commerceOptions?: CommerceMobileTabOptions,
  widthTier: BottomTabWidthTier = 'expanded',
): AppMobileTabItem[] {
  let tabs: AppMobileTabItem[]

  switch (section) {
    case 'chat':
      tabs = APP_CHAT_MOBILE_TABS
      break
    case 'commerce':
      tabs = getCommerceMobileTabs(commerceOptions ?? { hasShops: false })
      break
    case 'community':
      tabs = APP_COMMUNITY_MOBILE_TABS
      break
    case 'class':
      tabs = APP_CLASS_MOBILE_TABS
      break
    case 'co-work':
      tabs = APP_COWORK_MOBILE_TABS
      break
    default:
      tabs = []
  }

  return limitMiddleTabsForWidth(tabs, widthTier).map((tab) => ({
    ...tab,
    label: formatBottomTabLabel(tab.label, widthTier),
  }))
}

export function buildMobileBottomTabs(
  section: BottomTabSection,
  middleTabs: AppMobileTabItem[],
  tier: AccessTier,
  widthTier: BottomTabWidthTier = 'expanded',
): AppMobileTabItem[] {
  const globalTabs = section === 'co-work' ? [] : APP_GLOBAL_MOBILE_TABS
  const home = getHomeMobileTab(section)
  const auth = getAuthMobileTab(tier)

  return [
    { ...home, label: formatBottomTabLabel(home.label, widthTier) },
    ...middleTabs,
    ...globalTabs.map((tab) => ({
      ...tab,
      label: formatBottomTabLabel(tab.label, widthTier),
    })),
    { ...auth, label: formatBottomTabLabel(auth.label, widthTier) },
  ]
}
