import { usePathname } from 'one'
import { Platform } from 'react-native'

import { Text, XStack, YStack } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { openHumanVerification } from '~/lib/gender-verification/open-request'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

import { APP_CENTER_NAV, getAppColors } from '~/components/navigation/app/config'

/** Tamagui layout animation is costly on Hermes during rapid tab switches. */
const tabAnim = Platform.OS === 'web' ? ('quick' as const) : undefined

type AppCenterNavTabsProps = {
  variant?: 'desktop' | 'mobile' | 'mobile-inline'
  /** Tighter padding when the mobile bar has collapsed to tabs-only. */
  compact?: boolean
}

export function AppCenterNavTabs({ variant = 'desktop', compact = false }: AppCenterNavTabsProps) {
  const pathname = usePathname()
  const { canAccessFeature, isGuest, isAuthenticated } = useAccess()
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const isInline = variant === 'mobile-inline'
  const isMobile = variant === 'mobile' || isInline
  const showMobileLabels = isMobile

  function pressNavItem(item: (typeof APP_CENTER_NAV)[number]) {
    const href = String(item.href)
    if (canAccessFeature(item.feature)) {
      navigateApp(href)
      return
    }

    // Community / Chat — Human verification only when signed in.
    if (item.feature === 'community' || item.feature === 'chat') {
      if (isAuthenticated) {
        openHumanVerification({ returnTo: href })
        return
      }
      navigateApp(buildSignInUrl(href))
      return
    }

    if (isGuest) {
      navigateApp(buildSignInUrl(href))
      return
    }
    navigateApp(href)
  }

  return (
    <XStack
      flex={isInline ? 1 : undefined}
      width={isInline ? undefined : '100%'}
      minWidth={isInline ? 0 : undefined}
      justifyContent={isInline ? 'space-evenly' : 'space-around'}
      alignItems="stretch"
      alignSelf="stretch"
      borderTopWidth={variant === 'mobile' && !compact ? 1 : 0}
      borderTopColor={colors.border}
      paddingHorizontal={variant === 'mobile' ? 4 : 0}
      paddingVertical={variant === 'mobile' ? (compact ? 4 : 6) : 0}
      gap={variant === 'mobile' ? 2 : 0}
      animation={tabAnim}
    >
      {APP_CENTER_NAV.map((item) => {
        const isActive = item.match(pathname)
        const Icon = item.icon

        return (
          <YStack
            key={item.label}
            flex={1}
            maxWidth={!isMobile ? 112 : undefined}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            position="relative"
            minHeight={
              isMobile
                ? showMobileLabels
                  ? compact
                    ? 52
                    : 56
                  : isInline
                    ? 44
                    : 48
                : undefined
            }
            borderRadius={isMobile ? 14 : 0}
            paddingHorizontal={isMobile ? 4 : 0}
            paddingVertical={isMobile && showMobileLabels ? 4 : 0}
            gap={isMobile && showMobileLabels ? 2 : 0}
            backgroundColor={isMobile && isActive ? `${colors.brand}18` : 'transparent'}
            hoverStyle={
              isMobile ? { backgroundColor: `${colors.brand}10` } : { backgroundColor: ui.navHover }
            }
            pressStyle={isMobile ? { opacity: 0.72, scale: 0.96 } : undefined}
            animation={tabAnim}
            aria-label={item.label}
            title={item.label}
            role="link"
            accessibilityRole="link"
            onPress={() => pressNavItem(item)}
          >
            <Icon
              size={isInline ? 20 : isMobile ? 20 : 24}
              color={isActive ? colors.brand : colors.icon}
              fill={isActive ? colors.brand : 'none'}
              strokeWidth={isActive ? 2.2 : 1.8}
              pointerEvents="none"
            />
            {showMobileLabels ? (
              <Text
                fontSize={9}
                fontWeight={isActive ? '700' : '500'}
                color={isActive ? colors.brand : colors.textSecondary}
                numberOfLines={1}
                textAlign="center"
                width="100%"
                lineHeight={11}
              >
                {item.label}
              </Text>
            ) : isMobile && !isInline ? (
              <YStack
                width={isActive ? 4 : 0}
                height={4}
                borderRadius={999}
                backgroundColor={colors.brand}
                marginTop={4}
                animation={tabAnim}
              />
            ) : isActive ? (
              <YStack
                position="absolute"
                bottom={0}
                left={isInline ? '12%' : isMobile ? '18%' : '8%'}
                right={isInline ? '12%' : isMobile ? '18%' : '8%'}
                height={3}
                backgroundColor={colors.brand}
                borderTopLeftRadius={3}
                borderTopRightRadius={3}
              />
            ) : null}
          </YStack>
        )
      })}
    </XStack>
  )
}
