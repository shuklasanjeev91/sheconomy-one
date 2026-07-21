import { usePathname } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import type { Href } from 'one'
import { useMemo, useState } from 'react'

import { CommunityIdentityCard } from '~/community/components/CommunityIdentityCard'
import {
  COMMUNITY_LEFT_NAV,
  COMMUNITY_LEFT_NAV_VISIBLE,
  type CommunityNavItem,
} from '~/community/navigation/config'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { StickyRail } from '~/components/layout'
import { Icons, Separator, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { communityRoutes, routes } from '~/lib/routes'

type CommunitySidebarPin = 'document' | 'viewport'

export function CommunityLeftSidebar({ pin = 'document' }: { pin?: CommunitySidebarPin }) {
  const { isDesktop } = useAppLayout()
  const pathname = usePathname()
  const { isAuthenticated } = useProfile()
  const communityUi = useCommunityUi()
  const [expanded, setExpanded] = useState(false)

  const navItems = useMemo(
    () => COMMUNITY_LEFT_NAV.filter((item) => !item.authRequired || isAuthenticated),
    [isAuthenticated],
  )

  const visibleItems = expanded ? navItems : navItems.slice(0, COMMUNITY_LEFT_NAV_VISIBLE)
  const canExpand = navItems.length > COMMUNITY_LEFT_NAV_VISIBLE

  if (!isDesktop) {
    return null
  }

  return (
    <StickyRail
      width={COMMUNITY_LAYOUT.leftSidebarWidth}
      gap="$1"
      scrollable={pin === 'document'}
      pin={pin}
    >
      <CommunityIdentityCard />
      {isAuthenticated ? (
        <YStack gap={2}>
          <SidebarNavItem
            item={{
              href: routes.profile,
              label: 'Profile',
              icon: Icons.User,
              iconBg: communityUi.brand,
            }}
            active={pathname === routes.profile || pathname.startsWith(`${String(routes.profile)}/`)}
          />
          <SidebarNavItem
            item={{
              href: routes.notifications,
              label: 'Notifications',
              icon: Icons.Bell,
              iconBg: '#e7357a',
            }}
            active={
              pathname === routes.notifications ||
              pathname.startsWith(`${String(routes.notifications)}/`)
            }
          />
          <SidebarNavItem
            item={{
              href: routes.settings,
              label: 'Settings',
              icon: Icons.Settings,
              iconBg: '#64748b',
            }}
            active={pathname === routes.settings || pathname.startsWith(`${String(routes.settings)}/`)}
          />
          <Separator borderColor={communityUi.divider} marginVertical="$1.5" />
        </YStack>
      ) : null}
      <YStack gap={2}>
        {visibleItems.map((item) => (
          <SidebarNavItem
            key={String(item.href)}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}

        {canExpand ? (
          <SeeMoreToggle
            expanded={expanded}
            onPress={() => setExpanded((value) => !value)}
          />
        ) : null}
      </YStack>
    </StickyRail>
  )
}

function SeeMoreToggle({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const communityUi = useCommunityUi()
  const Icon = expanded ? Icons.ChevronUp : Icons.ChevronDown

  return (
    <XStack
      gap={12}
      alignItems="center"
      paddingVertical={8}
      paddingHorizontal={8}
      borderRadius={8}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.divider }}
      onPress={onPress}
    >
      <XStack
        width={36}
        height={36}
        borderRadius={999}
        backgroundColor={communityUi.divider}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={20} color={communityUi.textMuted} />
      </XStack>
      <Text fontSize={15} fontWeight="500" color={communityUi.text}>
        {expanded ? 'See less' : 'See more'}
      </Text>
    </XStack>
  )
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== communityRoutes.home && pathname.startsWith(String(href)))
}

function SidebarNavItem({ item, active }: { item: CommunityNavItem; active: boolean }) {
  const communityUi = useCommunityUi()
  const Icon = item.icon

  return (
    <AppLink href={item.href as Href} asChild>
      <XStack
        gap={12}
        alignItems="center"
        paddingVertical={8}
        paddingHorizontal={8}
        borderRadius={8}
        cursor="pointer"
        backgroundColor={active ? communityUi.divider : 'transparent'}
        hoverStyle={{ backgroundColor: communityUi.divider }}
      >
        <XStack
          width={36}
          height={36}
          borderRadius={999}
          backgroundColor={item.iconBg}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={18} color="white" />
        </XStack>
        <Text
          fontSize={15}
          fontWeight={active ? '600' : '500'}
          color={communityUi.text}
          numberOfLines={1}
          flex={1}
        >
          {item.label}
        </Text>
      </XStack>
    </AppLink>
  )
}