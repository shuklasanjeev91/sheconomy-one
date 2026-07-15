import { AppLink } from '~/components/navigation/AppLink'

import { AuthButton } from '~/components/auth'
import { AppSearchField } from '~/components/search'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { AppHeaderBackButton } from '~/components/navigation/AppHeaderBackButton'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { NavLogo } from '~/components/navigation/NavLogo'
import { useCart } from '~/commerce/hooks/useCart'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { useAppBackNavigation } from '~/hooks/useAppBackNavigation'
import { useProfile } from '~/hooks/useProfile'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useAppLayout } from '~/hooks/useAppLayout'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'

import { AppCenterNavTabs } from './AppCenterNavTabs'
import { AppMenuButton } from './AppMenuSheet'
import { getAppColors } from './config'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Desktop header — logo + unified search | icon-only center nav | utilities + avatar. */
export function AppDesktopHeader() {
  const ui = useAppUi()
  const { gutter } = useAppLayout()
  const colors = getAppColors(ui)
  const { isAuthenticated } = useProfile()
  const { canManageShops } = useAccess()
  const { shops, isLoading: shopsLoading } = useVendorShops()
  const { itemCount } = useCart()
  const { count: unreadNotifications } = useUnreadNotifications()
  const { showBack } = useAppBackNavigation()

  const hasShops = shops.length > 0
  const showCreateShop = canManageShops && isAuthenticated && !shopsLoading && !hasShops

  return (
    <YStack
      backgroundColor={colors.surface}
      borderBottomWidth={1}
      borderBottomColor={colors.borderSubtle}
      zIndex={200}
      position="sticky"
      top={0}
      width="100%"
      display="flex"
      style={chromeSurfaceStyle(ui)}
    >
      <XStack
        width="100%"
        alignSelf="center"
        alignItems="stretch"
        paddingHorizontal={gutter}
        height={60}
        gap="$3"
      >
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0} overflow="visible">
          {showBack ? <AppHeaderBackButton /> : null}
          <NavLogo compact href={commerceRoutes.home} />
          <YStack flex={1} minWidth={120} justifyContent="center" overflow="visible">
            <AppSearchField compact />
          </YStack>
        </XStack>

        <XStack flex={1.5} justifyContent="center" minWidth={0} alignSelf="stretch">
          <AppCenterNavTabs variant="desktop" />
        </XStack>

        <XStack
          alignItems="center"
          gap="$1.5"
          flex={1}
          justifyContent="flex-end"
          minWidth={0}
          alignSelf="center"
        >
          {isAuthenticated ? (
            <>
              <AppMenuButton mode="popover" size={40} />
              {canManageShops ? (
                <UtilityButton href={commerceRoutes.myShops} icon={Icons.Store} label="My shops" />
              ) : null}
              {showCreateShop ? (
                <AppLink href={`${commerceRoutes.myShops}?create=1` as import('one').Href} asChild>
                  <XStack
                    height={40}
                    paddingHorizontal="$3"
                    borderRadius={999}
                    backgroundColor={colors.brand}
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                    hoverStyle={{ opacity: 0.92 }}
                    aria-label="Create shop"
                  >
                    <Text fontSize={12} fontWeight="700" color={ui.onBrand}>
                      Open shop
                    </Text>
                  </XStack>
                </AppLink>
              ) : null}
            </>
          ) : null}
          <UtilityButton href={routes.cart} icon={Icons.ShoppingBag} label="Cart" badge={itemCount} />
          {isAuthenticated ? (
            <UtilityButton
              href={routes.notifications}
              icon={Icons.Bell}
              label="Notifications"
              badge={unreadNotifications}
            />
          ) : null}
          <AuthButton variant="header" />
        </XStack>
      </XStack>
    </YStack>
  )
}

function UtilityButton({
  href,
  onPress,
  icon: Icon,
  label,
  badge,
}: {
  href?: import('one').Href
  onPress?: () => void
  icon: typeof Icons.Bell
  label: string
  badge?: number
}) {
  const colors = getAppColors(useAppUi())

  const button = (
    <XStack
      width={40}
      height={40}
      borderRadius={999}
      backgroundColor={colors.chip}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: colors.chipHover }}
      aria-label={label}
      position="relative"
      overflow="visible"
      {...(onPress ? { onPress } : {})}
    >
      <Icon size={20} color={colors.text} />
      {badge != null && badge > 0 ? (
        <NavCountBadge count={badge} borderColor={colors.surface} />
      ) : null}
    </XStack>
  )

  if (href) {
    return (
      <AppLink href={href} asChild>
        {button}
      </AppLink>
    )
  }
  return button
}
