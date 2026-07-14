import { Link, useRouter } from 'one'
import { useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Input, XStack, YStack } from '~/components/ui'
import { AppMobileBackButton } from '~/components/navigation/AppMobileBackButton'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { NavLogo } from '~/components/navigation/NavLogo'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { commerceRoutes, routes } from '~/lib/routes'
import { useMobileBackNavigation } from '~/hooks/useMobileBackNavigation'
import { useAppUi } from '~/lib/theme/useAppUi'
import { chromeSurfaceStyle, searchFieldFocusStyle, searchFieldStyle } from '~/lib/theme/surfaces'

import { AppCenterNavTabs } from './AppCenterNavTabs'
import { AppMenuButton } from './AppMenuSheet'
import { getAppColors } from './config'

import { BRAND_NAME } from '~/config/brand'

type AppMobileHeaderProps = {
  /** Compact detail chrome — back + search, no section tab row. */
  minimal?: boolean
}

/**
 * Mobile/tablet top bar (hidden on desktop).
 * Nested screens show a back control; section roots keep the logo.
 */
export function AppMobileHeader({ minimal = false }: AppMobileHeaderProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const router = useRouter()
  const { showBack } = useMobileBackNavigation()
  const { count: unreadNotifications } = useUnreadNotifications()
  const [searchQuery, setSearchQuery] = useState('')

  function submitSearch() {
    const trimmed = searchQuery.trim()
    router.push(trimmed ? commerceRoutes.search(trimmed) : commerceRoutes.search())
  }

  return (
    <YStack
      backgroundColor={colors.surface}
      borderBottomWidth={1}
      borderBottomColor={colors.borderSubtle}
      zIndex={200}
      width="100%"
      position={Platform.OS === 'web' ? 'sticky' : 'relative'}
      top={Platform.OS === 'web' ? 0 : undefined}
      $gtMd={{ display: 'none' }}
      style={chromeSurfaceStyle(ui)}
    >
      <XStack
        paddingHorizontal="$3"
        paddingTop="$2.5"
        paddingBottom="$2"
        alignItems="center"
        gap="$2.5"
        style={{ minHeight: 56 }}
      >
        <XStack flexShrink={0} alignItems="center">
          {showBack ? <AppMobileBackButton /> : <NavLogo compact href={commerceRoutes.home} />}
        </XStack>

        <XStack
          flex={1}
          minWidth={0}
          paddingHorizontal="$3"
          alignItems="center"
          gap={8}
          height={40}
          style={searchFieldStyle(ui)}
          focusStyle={searchFieldFocusStyle(ui)}
        >
          <Icons.Search size={17} color={colors.icon} flexShrink={0} />
          <Input
            flex={1}
            minWidth={0}
            unstyled
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder={`Search ${BRAND_NAME}`}
            fontSize={14}
            color={colors.text}
            placeholderTextColor={colors.icon}
            borderWidth={0}
            backgroundColor="transparent"
          />
        </XStack>

        <XStack flexShrink={0} gap={8} alignItems="center">
          <AppMenuButton mode="sheet" size={38} />
          <HeaderIcon
            href={routes.notifications}
            icon={Icons.Bell}
            label="Notifications"
            badgeCount={unreadNotifications}
          />
        </XStack>
      </XStack>

      {!minimal ? <AppCenterNavTabs variant="mobile" /> : null}
    </YStack>
  )
}

function HeaderIcon({
  href,
  onPress,
  icon: Icon,
  label,
  badgeCount,
}: {
  href?: import('one').Href
  onPress?: () => void
  icon: typeof Icons.Bell
  label: string
  badgeCount?: number
}) {
  const colors = getAppColors(useAppUi())

  const button = (
    <XStack
      width={38}
      height={38}
      borderRadius={999}
      backgroundColor={colors.chip}
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="visible"
      cursor="pointer"
      aria-label={label}
      animation="quick"
      hoverStyle={{ backgroundColor: colors.chipHover, scale: 1.04 }}
      pressStyle={{ opacity: 0.75, scale: 0.94 }}
      {...(onPress ? { onPress } : {})}
    >
      <Icon size={20} color={colors.text} />
      {badgeCount != null && badgeCount > 0 ? (
        <NavCountBadge count={badgeCount} size="sm" borderColor={colors.surface} />
      ) : null}
    </XStack>
  )

  if (href) {
    return (
      <Link href={href} asChild>
        {button}
      </Link>
    )
  }
  return button
}
