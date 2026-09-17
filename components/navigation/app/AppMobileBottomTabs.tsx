import { usePathname } from 'one'
import { useEffect, useMemo, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { AuthButton } from '~/components/auth'
import { XStack, YStack } from '~/components/ui'
import { tabBarPositionStyle } from '~/lib/layout/styles'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { openHumanVerification } from '~/lib/gender-verification/open-request'
import { navigateApp } from '~/lib/platform/navigate'
import { isCreateShopPath } from '~/lib/routes'
import { mobileTabBarDockStyle } from '~/lib/theme/surfaces'
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
} from '~/components/navigation/app/config'
import {
  getBottomTabWidthTier,
  shouldShowBottomTabLabels,
} from '~/components/navigation/app/mobile-tab-bar-width'
import { MobileTabBarItem } from '~/components/navigation/app/MobileTabBarItem'
import {
  collapseLiveMeetingForBrowsing,
  shouldCollapseMeetingBeforeNavigate,
} from '~/co-work/lib/meeting-browse'
import { useAppUi } from '~/lib/theme/useAppUi'
import { QA } from '~/lib/qa/test-ids'

const TAB_ICON = { active: 24, inactive: 22 } as const

/** Native-style full-width bottom tab bar — frosted dock, pill active states. */
export function AppMobileBottomTabs() {
  const pathname = usePathname()
  const { tier, isFemale, isAuthenticated, isTierKnown } = useAccess()
  const { safeBottom } = useAppLayout()
  const { shops, primaryShopId } = useVendorShops()
  const hasShops = shops.length > 0
  // Optimistic highlight so tab presses feel instant while the route settles.
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  const activePath = pendingPath ?? pathname

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
      isTierKnown,
    )
  }, [hasShops, isTierKnown, pathname, primaryShopId, tier, widthTier])

  const section = getMobileBottomTabSection(pathname)

  if (tabs.length === 0) {
    return null
  }

  const tabTestSection = section ?? 'app'

  const isCoWork = section === 'co-work'
  const activeColor = isCoWork ? coworkUi.brandLight : appColors.brand
  const inactiveColor = isCoWork ? coworkUi.textMuted : appColors.icon
  const dockSurface = isCoWork ? coworkUi.controlsDock : ui.chromeBg
  const activePillBg = isCoWork ? coworkUi.brandMuted : `${appColors.brand}14`

  function focusPathForTab(tab: AppMobileTabItem) {
    return String(tab.href)
  }

  function isTabFocused(tab: AppMobileTabItem) {
    return tab.match ? tab.match(activePath) : activePath === tab.href
  }

  function pressTab(tab: AppMobileTabItem) {
    const href = focusPathForTab(tab)

    // Create shop requires Human verification for limited members. An unsettled
    // profile reads as limited, so navigate and let AppAccessGate rule on it
    // rather than sending a verified member back to verification.
    if (isCreateShopPath(href) && !hasShops && isTierKnown) {
      if (isFemale) {
        // fall through to navigate
      } else if (isAuthenticated) {
        openHumanVerification({ returnTo: href })
        return
      } else {
        navigateApp(buildSignInUrl(href))
        return
      }
    }

    if (tab.match ? tab.match(pathname) : pathname === tab.href) {
      setPendingPath(null)
      return
    }
    setPendingPath(href)
    if (shouldCollapseMeetingBeforeNavigate()) {
      collapseLiveMeetingForBrowsing({ href })
      return
    }
    navigateApp(tab.href)
  }

  return (
    <YStack
      zIndex={95_000}
      // Keep tabs visible on all native phones/tablets — `$gtMd` can mis-fire
      // with Tamagui media on RN and hide the dock entirely.
      {...(Platform.OS === 'web' ? { $gtMd: { display: 'none' as const } } : { display: 'flex' })}
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
        paddingTop={4}
        // Home-indicator only — avoid stacking extra bottom padding on top of safe area.
        paddingBottom={safeBottom > 0 ? safeBottom : Platform.OS === 'ios' ? 4 : 2}
        pointerEvents="auto"
        style={mobileTabBarDockStyle(ui, {
          dark: isCoWork,
          surface: dockSurface,
        })}
      >
        {tabs.map((tab) => {
          const isAuthTab = tab.label === 'You'
          const isFocused = isTabFocused(tab)

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
              fill={isFocused && tab.label !== 'Shops' ? activeColor : 'none'}
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
                testID={QA.bottomTab(tabTestSection, tab.label)}
                onPress={tab.onPress}
              >
                {iconNode}
              </MobileTabBarItem>
            )
          }

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
              testID={QA.bottomTab(tabTestSection, tab.label)}
              onPress={() => pressTab(tab)}
            >
              {iconNode}
            </MobileTabBarItem>
          )
        })}
      </XStack>
    </YStack>
  )
}
