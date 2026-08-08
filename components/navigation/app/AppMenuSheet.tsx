import type { Href } from 'one'
import { useState } from 'react'

import {
  AppBottomSheet,
  Icons,
  Popover,
  PopoverContent,
  Separator,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import { useProfile } from '~/hooks/useProfile'
import { navigateApp } from '~/lib/platform/navigate'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'
import { blogRoutes, commerceRoutes, communityRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { getAppColors } from '~/components/navigation/app/config'

type MenuTile = {
  label: string
  icon: typeof Icons.Users
  href?: Href
  action?: 'open-ai'
  color: string
}

/**
 * Secondary destinations only — never repeat APP_CENTER_NAV hubs
 * (Marketplace / Community / Chat / Classes / Co-Work).
 */
function useExploreTiles(): MenuTile[] {
  const { canAccessFeature } = useAccess()
  const hasCommunity = canAccessFeature('community')

  return [
    { label: 'Shops', icon: Icons.Store, href: commerceRoutes.shops, color: '#8b5cf6' },
    { label: 'Blog', icon: Icons.FileText, href: blogRoutes.home, color: '#D81B60' },
    ...(hasCommunity
      ? ([
          { label: 'Groups', icon: Icons.UsersRound, href: communityRoutes.groups, color: '#f59e0b' },
          { label: 'Events', icon: Icons.Calendar, href: communityRoutes.events, color: '#ef4444' },
          { label: 'Pages', icon: Icons.Building2, href: communityRoutes.companies, color: '#6366f1' },
        ] as MenuTile[])
      : []),
  ]
}

/**
 * Guests get Sign in here. Signed-in account helpers (Help / AI / Profile)
 * live only in the Auth / You menu — keep this menu for "More" explore.
 */
function useUtilityTiles(): MenuTile[] {
  const { isAuthenticated } = useProfile()
  const ui = useAppUi()
  if (!isAuthenticated) {
    return [{ label: 'Sign in', icon: Icons.LogIn, href: routes.signIn, color: ui.brand }]
  }
  return []
}

type AppMenuButtonProps = {
  mode: 'popover' | 'sheet'
  size?: number
}

/**
 * App launcher — secondary destinations + help/AI only.
 * Primary product tabs and full account stay in center nav / Auth You menu.
 */
export function AppMenuButton({ mode, size = 40 }: AppMenuButtonProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const [open, setOpen] = useState(false)
  const exploreTiles = useExploreTiles()
  const utilityTiles = useUtilityTiles()
  const ai = useAiAssistOptional()

  function go(href: Href) {
    navigateApp(href)
    requestAnimationFrame(() => setOpen(false))
  }

  function onTile(tile: MenuTile) {
    if (tile.action === 'open-ai') {
      ai?.openAssist()
      requestAnimationFrame(() => setOpen(false))
      return
    }
    if (tile.href) go(tile.href)
  }

  const body = (
    <YStack gap="$3" width="100%">
      {utilityTiles.length > 0 ? (
        <>
          <MenuSectionLabel colors={colors} label="Account" />
          <XStack flexWrap="wrap" rowGap="$3" columnGap="$2">
            {utilityTiles.map((tile) => (
              <MenuTileButton
                key={tile.label}
                tile={tile}
                colors={colors}
                onPress={() => onTile(tile)}
              />
            ))}
          </XStack>
        </>
      ) : null}

      {exploreTiles.length > 0 ? (
        <>
          {utilityTiles.length > 0 ? <Separator borderColor={colors.borderSubtle} /> : null}
          <MenuSectionLabel colors={colors} label="More" />
          <XStack flexWrap="wrap" rowGap="$3" columnGap="$2">
            {exploreTiles.map((tile) => (
              <MenuTileButton
                key={tile.label}
                tile={tile}
                colors={colors}
                onPress={() => onTile(tile)}
              />
            ))}
          </XStack>
        </>
      ) : null}
    </YStack>
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
        <PopoverContent width={360} maxWidth={360} borderColor={colors.borderSubtle} zIndex={1000}>
          {body}
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
        {body}
      </AppBottomSheet>
    </>
  )
}

function MenuSectionLabel({
  colors,
  label,
}: {
  colors: ReturnType<typeof getAppColors>
  label: string
}) {
  return (
    <Text
      fontSize={12}
      fontWeight="800"
      color={colors.icon}
      textTransform="uppercase"
      letterSpacing={0.7}
    >
      {label}
    </Text>
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
