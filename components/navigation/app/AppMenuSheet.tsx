import type { Href } from 'one'
import { useRouter } from 'one'
import { useState } from 'react'

import {
  AppBottomSheet,
  Icons,
  Popover,
  PopoverContent,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
} from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { getAppColors } from './config'

type MenuTile = {
  label: string
  icon: typeof Icons.Users
  href: Href
  color: string
}

function useMenuTiles(): MenuTile[] {
  const { canAccessFeature } = useAccess()
  const hasCommunity = canAccessFeature('community')

  return [
    { label: 'Marketplace', icon: Icons.Store, href: commerceRoutes.home, color: '#0a66c2' },
    { label: 'Shops', icon: Icons.ShoppingBag, href: commerceRoutes.shops, color: '#8b5cf6' },
    ...(hasCommunity
      ? ([
          { label: 'Feed', icon: Icons.Newspaper, href: communityRoutes.home, color: '#e7357a' },
          { label: 'Network', icon: Icons.Users, href: communityRoutes.network, color: '#0ea5e9' },
          { label: 'Jobs', icon: Icons.Briefcase, href: communityRoutes.jobs, color: '#0f9d58' },
          { label: 'Groups', icon: Icons.UsersRound, href: communityRoutes.groups, color: '#f59e0b' },
          { label: 'Events', icon: Icons.Calendar, href: communityRoutes.events, color: '#ef4444' },
          { label: 'Pages', icon: Icons.Building2, href: communityRoutes.companies, color: '#6366f1' },
        ] as MenuTile[])
      : []),
    { label: 'Messages', icon: Icons.MessageCircle, href: chatRoutes.home, color: '#25D366' },
    { label: 'Meetings', icon: Icons.Video, href: coWorkRoutes.home, color: '#14b8a6' },
    { label: 'Classes', icon: Icons.GraduationCap, href: classRoutes.home, color: '#d9488f' },
  ]
}

type AppMenuButtonProps = {
  /** Desktop headers use an anchored popup; mobile uses a bottom sheet. */
  mode: 'popover' | 'sheet'
  /** Diameter of the round trigger chip. */
  size?: number
}

/**
 * Facebook-style app launcher trigger + menu.
 * `popover` → anchored dropdown (desktop); `sheet` → bottom sheet (mobile).
 */
export function AppMenuButton({ mode, size = 40 }: AppMenuButtonProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const tiles = useMenuTiles()

  function go(href: Href) {
    setOpen(false)
    router.push(href)
  }

  const grid = (
    <XStack flexWrap="wrap" rowGap="$3" columnGap="$2">
      {tiles.map((tile) => (
        <MenuTileButton key={tile.label} tile={tile} colors={colors} onPress={() => go(tile.href)} />
      ))}
    </XStack>
  )

  const chipStyle = {
    width: size,
    height: size,
    borderRadius: 999,
    backgroundColor: colors.chip,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    cursor: 'pointer' as const,
    hoverStyle: { backgroundColor: colors.chipHover },
    pressStyle: { opacity: 0.75, scale: 0.94 },
    animation: 'quick' as const,
  }

  if (mode === 'popover') {
    return (
      <Popover placement="bottom-end" open={open} onOpenChange={setOpen} offset={10} allowFlip>
        <Popover.Trigger asChild>
          <XStack {...chipStyle} aria-label="Menu">
            <Icons.Grid2x2 size={20} color={colors.text} />
          </XStack>
        </Popover.Trigger>
        <PopoverContent
          width={360}
          maxWidth={360}
          borderColor={colors.borderSubtle}
          zIndex={1000}
        >
          <YStack gap="$3" width="100%">
            <Text
              fontSize={12}
              fontWeight="800"
              color={colors.icon}
              textTransform="uppercase"
              letterSpacing={0.7}
            >
              Menu
            </Text>
            {grid}
          </YStack>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      <XStack {...chipStyle} aria-label="Menu" onPress={() => setOpen(true)}>
        <Icons.Grid2x2 size={20} color={colors.text} />
      </XStack>
      <AppBottomSheet open={open} onOpenChange={setOpen} title="Menu" scrollable>
        {grid}
      </AppBottomSheet>
    </>
  )
}

function MenuTileButton({
  tile,
  colors,
  onPress,
}: {
  tile: MenuTile
  colors: ReturnType<typeof getAppColors>
  onPress: () => void
}) {
  const Icon = tile.icon
  return (
    <YStack
      width="31%"
      minWidth={92}
      gap="$1.5"
      padding="$2.5"
      borderRadius={14}
      backgroundColor={colors.chip}
      cursor="pointer"
      hoverStyle={{ backgroundColor: colors.chipHover }}
      pressStyle={{ opacity: 0.8, scale: 0.97 }}
      animation="quick"
      onPress={onPress}
      accessibilityLabel={tile.label}
    >
      <YStack
        width={38}
        height={38}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={`${tile.color}1f`}
      >
        <Icon size={20} color={tile.color} />
      </YStack>
      <Text fontSize={13} fontWeight="600" color={colors.text} numberOfLines={1}>
        {tile.label}
      </Text>
    </YStack>
  )
}
