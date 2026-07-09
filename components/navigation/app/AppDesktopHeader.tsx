import { Link, usePathname, useRouter } from 'one'
import { useState } from 'react'
import { Platform } from 'react-native'

import { Avatar, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { NavLogo } from '~/components/navigation/NavLogo'
import { useCart } from '~/commerce/hooks/useCart'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import { useVendorShops } from '~/hooks/useVendorShops'
import { chromeSurfaceStyle, searchFieldStyle } from '~/lib/theme/surfaces'

import { AppCenterNavTabs } from './AppCenterNavTabs'
import { getAppColors } from './config'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

/** Facebook web desktop header — logo + search | icon-only center nav | utilities + avatar. */
export function AppDesktopHeader() {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const pathname = usePathname()
  const { isAuthenticated, profile } = useProfile()
  const { canManageShops, isMale, canAccessFeature } = useAccess()
  const { signOut } = useAuth()
  const { shops, isLoading: shopsLoading } = useVendorShops()
  const { itemCount } = useCart()
  const { count: unreadNotifications } = useUnreadNotifications()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const hasShops = shops.length > 0
  const showCreateShop = canManageShops && isAuthenticated && !shopsLoading && !hasShops

  const accountHref = isMale ? routes.verifyGender : routes.profile

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
      position="sticky"
      top={0}
      width="100%"
      display="none"
      $gtMd={{ display: 'flex' }}
      style={chromeSurfaceStyle(ui)}
    >
      <XStack
        width="100%"
        alignSelf="center"
        alignItems="stretch"
        paddingHorizontal="$5"
        height={60}
        gap="$3"
      >
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <NavLogo compact href={commerceRoutes.home} />
          <XStack
            flex={1}
            minWidth={0}
            alignItems="center"
            gap="$2"
            height={40}
            alignSelf="center"
            paddingHorizontal="$3"
            style={searchFieldStyle(ui)}
          >
            <Icons.Search size={16} color={colors.icon} />
            <Input
              flex={1}
              unstyled
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder={`Search ${BRAND_NAME}`}
              fontSize={15}
              color={colors.text}
              placeholderTextColor={colors.icon}
              borderWidth={0}
              backgroundColor="transparent"
            />
          </XStack>
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
              <UtilityButton href={routes.settings} icon={Icons.Grid2x2} label="Menu" />
              {canManageShops ? (
                <UtilityButton href={commerceRoutes.myShops} icon={Icons.Store} label="My shops" />
              ) : null}
              {showCreateShop ? (
                <Link href={`${commerceRoutes.myShops}?create=1` as import('one').Href} asChild>
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
                </Link>
              ) : null}
            </>
          ) : null}
          <UtilityButton href={routes.cart} icon={Icons.ShoppingBag} label="Cart" badge={itemCount} />
          {isAuthenticated && canAccessFeature('community') ? (
            <UtilityButton
              href={routes.notifications}
              icon={Icons.Bell}
              label="Notifications"
              badge={unreadNotifications}
            />
          ) : null}
          {isAuthenticated ? (
            <>
              <Link href={accountHref} asChild>
                <YStack cursor="pointer" pressStyle={{ opacity: 0.85 }} marginLeft={2}>
                  <Avatar
                    name={profile?.full_name || profile?.username || 'Account'}
                    src={profile?.avatar_url ?? undefined}
                    size="$3"
                  />
                </YStack>
              </Link>
              <XStack
                width={40}
                height={40}
                borderRadius={999}
                backgroundColor={colors.chip}
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                hoverStyle={{ backgroundColor: colors.chipHover }}
                aria-label="Sign out"
                onPress={() => {
                  void signOut()
                }}
              >
                <Icons.LogOut size={20} color={colors.text} />
              </XStack>
            </>
          ) : (
            <Link href={buildSignInUrl(pathname)} asChild>
              <XStack
                height={40}
                paddingHorizontal="$3"
                borderRadius={999}
                borderWidth={1}
                borderColor={colors.border}
                backgroundColor={colors.chip}
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                hoverStyle={{ backgroundColor: colors.chipHover }}
              >
                <Text fontSize={13} fontWeight="700" color={colors.text}>
                  Sign in
                </Text>
              </XStack>
            </Link>
          )}
        </XStack>
      </XStack>
    </YStack>
  )
}

function UtilityButton({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: import('one').Href
  icon: typeof Icons.Bell
  label: string
  badge?: number
}) {
  const colors = getAppColors(useAppUi())

  return (
    <Link href={href} asChild>
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
      >
        <Icon size={20} color={colors.text} />
        {badge != null && badge > 0 ? (
          <NavCountBadge count={badge} borderColor={colors.surface} />
        ) : null}
      </XStack>
    </Link>
  )
}