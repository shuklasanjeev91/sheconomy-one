import { Link, usePathname } from 'one'
import { useMemo, useState } from 'react'

import {
  COMMUNITY_LEFT_NAV,
  COMMUNITY_LEFT_NAV_VISIBLE,
  type CommunityNavItem,
} from '~/community/navigation/config'
import type { Href } from 'one'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { Avatar, Icons, Separator, Text, XStack, YStack } from '~/components/ui'
import { useProfile } from '~/hooks/useProfile'
import { communityRoutes } from '~/lib/routes'

export function CommunityLeftSidebar() {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { profile, isAuthenticated } = useProfile()
  const [expanded, setExpanded] = useState(false)
  const displayName = profile?.full_name || profile?.username || 'Your profile'

  const navItems = useMemo(
    () => COMMUNITY_LEFT_NAV.filter((item) => !item.authRequired || isAuthenticated),
    [isAuthenticated],
  )

  const visibleItems = expanded ? navItems : navItems.slice(0, COMMUNITY_LEFT_NAV_VISIBLE)
  const canExpand = navItems.length > COMMUNITY_LEFT_NAV_VISIBLE

  return (
    <YStack
      width={COMMUNITY_LAYOUT.leftSidebarWidth}
      flexShrink={0}
      gap="$1"
      position="sticky"
      top={COMMUNITY_LAYOUT.stickyTop}
      alignSelf="flex-start"
      display="none"
      $gtMd={{ display: 'flex' }}
    >
      {isAuthenticated ? (
        <Link href={communityRoutes.profile} asChild>
          <XStack
            gap={12}
            alignItems="center"
            paddingVertical={8}
            paddingHorizontal={8}
            borderRadius={8}
            cursor="pointer"
            hoverStyle={{ backgroundColor: communityUi.divider }}
          >
            <Avatar
              name={displayName}
              src={profile?.avatar_url ?? undefined}
              size="$4"
            />
            <Text fontSize={15} fontWeight="600" color={communityUi.text} numberOfLines={1} flex={1}>
              {displayName}
            </Text>
          </XStack>
        </Link>
      ) : null}

      <Separator borderColor={communityUi.borderLight} marginVertical={4} />

      <YStack gap={2}>
        {visibleItems.map((item) => (
          <SidebarNavItem
            key={item.label}
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
    </YStack>
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
    <Link href={item.href as Href} asChild>
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
    </Link>
  )
}