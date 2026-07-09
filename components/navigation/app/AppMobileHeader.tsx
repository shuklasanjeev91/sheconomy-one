import { Link, useRouter } from 'one'
import { useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Input, XStack, YStack } from '~/components/ui'
import { AppMobileBackButton } from '~/components/navigation/AppMobileBackButton'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { NavLogo } from '~/components/navigation/NavLogo'
import { useCart } from '~/commerce/hooks/useCart'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { useProfile } from '~/hooks/useProfile'
import { useMobileBackNavigation } from '~/hooks/useMobileBackNavigation'
import { chromeSurfaceStyle, searchFieldStyle } from '~/lib/theme/surfaces'

import { AppCenterNavTabs } from './AppCenterNavTabs'
import { getAppColors } from './config'
import { useAppUi } from '~/lib/theme/useAppUi'

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
  const { itemCount } = useCart()
  const { count: unreadNotifications } = useUnreadNotifications()
  const { isAuthenticated } = useProfile()
  const { canManageShops, canAccessFeature } = useAccess()
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
      position="sticky"
      top={0}
      $gtMd={{ display: 'none' }}
      style={chromeSurfaceStyle(ui)}
    >
      <XStack
        paddingHorizontal="$3"
        paddingTop="$2"
        paddingBottom="$1"
        alignItems="center"
        gap="$2"
        style={{ minHeight: 52 }}
      >
        <XStack flexShrink={0} alignItems="center">
          {showBack ? <AppMobileBackButton /> : <NavLogo compact href={commerceRoutes.home} />}
        </XStack>

        <XStack
          flex={1}
          minWidth={0}
          paddingHorizontal="$2.5"
          alignItems="center"
          gap={6}
          height={36}
          style={searchFieldStyle(ui)}
        >
          <Icons.Search size={16} color={colors.icon} flexShrink={0} />
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
          <HeaderIcon
            href={routes.cart}
            icon={Icons.ShoppingBag}
            label="Cart"
            badgeCount={itemCount}
          />
          {isAuthenticated && canManageShops ? (
            <HeaderIcon href={commerceRoutes.myShops} icon={Icons.Store} label="My shops" />
          ) : null}
          {isAuthenticated && canAccessFeature('community') ? (
            <HeaderIcon
              href={routes.notifications}
              icon={Icons.Bell}
              label="Notifications"
              badgeCount={unreadNotifications}
            />
          ) : null}
        </XStack>
      </XStack>

      {!minimal ? <AppCenterNavTabs variant="mobile" /> : null}
    </YStack>
  )
}

function HeaderIcon({
  href,
  icon: Icon,
  label,
  badgeCount,
}: {
  href: import('one').Href
  icon: typeof Icons.Bell
  label: string
  badgeCount?: number
}) {
  const colors = getAppColors(useAppUi())

  return (
    <Link href={href} asChild>
      <XStack
        width={36}
        height={36}
        borderRadius={999}
        backgroundColor={colors.chip}
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="visible"
        cursor="pointer"
        aria-label={label}
        pressStyle={{ opacity: 0.75 }}
      >
        <Icon size={20} color={colors.text} />
        {badgeCount != null && badgeCount > 0 ? (
          <NavCountBadge count={badgeCount} size="sm" borderColor={colors.surface} />
        ) : null}
      </XStack>
    </Link>
  )
}
