import { Link, usePathname } from 'one'
import { useMemo } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { AuthButton } from '~/components/auth'
import { XStack, YStack } from '~/components/ui'
import { tabBarPositionStyle } from '~/lib/layout/styles'
import { mobileTabBarDockStyle } from '~/lib/theme/surfaces'
import { useCart } from '~/commerce/hooks/useCart'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useStableMedia } from '~/hooks/useStableMedia'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useCoWorkTheme } from '~/co-work/lib/theme'

import {
  getAppColors,
  buildMobileBottomTabs,
  getMobileBottomTabMiddleTabs,
  getMobileBottomTabSection,
  type AppMobileTabItem,
} from './config'
import {
  getBottomTabWidthTier,
  shouldShowBottomTabLabels,
} from './mobile-tab-bar-width'
import { MobileTabBarItem } from './MobileTabBarItem'
import { useAppUi } from '~/lib/theme/useAppUi'

const TAB_ICON = { active: 24, inactive: 22 } as const

/** Native-style full-width bottom tab bar — frosted dock, pill active states. */
export function AppMobileBottomTabs() {
  const pathname = usePathname()
  const { tier } = useAccess()
  const { safeBottom } = useAppLayout()
  const { itemCount } = useCart()
  const { shops } = useVendorShops()
  const hasShops = shops.length > 0
  const primaryShopId = shops[0]?.id ?? null

  const ui = useAppUi()
  const { ui: coworkUi } = useCoWorkTheme()
  const appColors = getAppColors(ui)
  const { width } = useWindowDimensions()
  const media = useStableMedia()
  const widthTier = getBottomTabWidthTier(width, media.gtSm)
  const showLabels = shouldShowBottomTabLabels(widthTier)

  const tabs = useMemo((): AppMobileTabItem[] => {
    const section = getMobileBottomTabSection(pathname)
    if (!section) {
      return []
    }

    return buildMobileBottomTabs(
      section,
      getMobileBottomTabMiddleTabs(
        section,
        section === 'commerce' ? { hasShops, primaryShopId } : undefined,
        widthTier,
      ),
      tier,
      widthTier,
    )
  }, [hasShops, pathname, primaryShopId, tier, widthTier])

  const section = getMobileBottomTabSection(pathname)

  if (tabs.length === 0) {
    return null
  }

  const isCoWork = section === 'co-work'
  const activeColor = isCoWork ? coworkUi.brandLight : appColors.brand
  const inactiveColor = isCoWork ? coworkUi.textMuted : appColors.icon
  const dockSurface = isCoWork ? coworkUi.controlsDock : ui.chromeBg
  const activePillBg = isCoWork ? coworkUi.brandMuted : `${appColors.brand}14`

  return (
    <YStack
      zIndex={200}
      $gtMd={{ display: 'none' }}
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      pointerEvents="box-none"
      style={tabBarPositionStyle()}
    >
      <XStack
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        alignItems="stretch"
        paddingTop={6}
        paddingBottom={Math.max(safeBottom, Platform.OS === 'ios' ? 10 : 8)}
        style={mobileTabBarDockStyle(ui, {
          dark: isCoWork,
          surface: dockSurface,
        })}
      >
        {tabs.map((tab) => {
          const isAuthTab = tab.label === 'You'
          const isCartTab = tab.label === 'Cart'
          const isFocused = tab.match ? tab.match(pathname) : pathname === tab.href

          if (isAuthTab) {
            return (
              <YStack
                key={`${tab.label}-${String(tab.href)}`}
                flex={1}
                minWidth={0}
                alignSelf="stretch"
              >
                <AuthButton
                  variant="tab"
                  isFocused={isFocused}
                  activeColor={activeColor}
                  inactiveColor={inactiveColor}
                  activePillBg={activePillBg}
                  surfaceColor={dockSurface}
                  tabLabel={tab.label}
                  showTabLabel={showLabels}
                />
              </YStack>
            )
          }

          const Icon = tab.icon
          const iconNode = (
            <Icon
              size={isFocused ? TAB_ICON.active : TAB_ICON.inactive}
              color={isFocused ? activeColor : inactiveColor}
              fill={
                isFocused && tab.label !== 'Cart' && tab.label !== 'Shops'
                  ? activeColor
                  : 'none'
              }
              strokeWidth={isFocused ? 2.4 : 1.85}
            />
          )

          // Action tabs (e.g. Create Post) trigger an overlay instead of routing.
          if (tab.onPress) {
            return (
              <MobileTabBarItem
                key={`${tab.label}-${String(tab.href)}`}
                flex={1}
                minWidth={0}
                alignSelf="stretch"
                label={tab.label}
                showLabel={showLabels}
                isFocused={isFocused}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                activePillBg={activePillBg}
                badgeBorderColor={dockSurface}
                onPress={tab.onPress}
              >
                {iconNode}
              </MobileTabBarItem>
            )
          }

          return (
            <Link key={`${tab.label}-${String(tab.href)}`} href={tab.href} replace asChild>
              <MobileTabBarItem
                flex={1}
                minWidth={0}
                alignSelf="stretch"
                label={tab.label}
                showLabel={showLabels}
                isFocused={isFocused}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                activePillBg={activePillBg}
                badge={isCartTab ? itemCount : undefined}
                badgeBorderColor={dockSurface}
              >
                {iconNode}
              </MobileTabBarItem>
            </Link>
          )
        })}
      </XStack>
    </YStack>
  )
}
