import { Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useStableMedia } from '~/hooks/useStableMedia'
import { APP_LAYOUT } from '~/lib/layout/constants'

export function useAppLayout() {
  const media = useStableMedia()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const isMediaHydrated = media.isHydrated
  // Native: trust window width — Tamagui `useMedia` can mis-report and hide
  // the mobile header/tab dock (treating a phone as desktop).
  const isDesktop =
    Platform.OS === 'web' ? media.gtMd : width >= APP_LAYOUT.desktopMinWidth
  const isDesktopWeb = Platform.OS === 'web' && media.desktopWeb
  const isWide = Platform.OS === 'web' ? media.gtLg : width >= 1280
  const isTablet =
    Platform.OS === 'web'
      ? media.gtSm && !media.gtMd
      : width >= 600 && width < APP_LAYOUT.desktopMinWidth
  const isNative = Platform.OS !== 'web'

  const gutter = isWide
    ? APP_LAYOUT.railPaddingWide
    : isDesktop
      ? APP_LAYOUT.railPaddingDesktop
      : isTablet
        ? APP_LAYOUT.railPaddingTablet
        : APP_LAYOUT.railPaddingMobile

  const mobileTabBarOffset = APP_LAYOUT.mobileTabBarHeight + insets.bottom

  return {
    isDesktop,
    isDesktopWeb,
    isWide,
    isTablet,
    isMobile: !isDesktop,
    isNative,
    isMediaHydrated,
    gutter,
    sectionGap: isDesktop ? APP_LAYOUT.sectionGapDesktop : APP_LAYOUT.sectionGapMobile,
    safeTop: insets.top,
    safeBottom: insets.bottom,
    safeLeft: insets.left,
    safeRight: insets.right,
    /** Tab bar height + home-indicator / safe bottom — use for scroll viewport inset. */
    mobileTabBarOffset,
    /**
     * Offset for sticky CTAs sitting above the tab bar.
     * Pass sticky bar height so content padding clears both layers.
     */
    bottomChromeOffset: (stickyBarHeight = 0) => mobileTabBarOffset + stickyBarHeight,
    mobileHeaderTotalHeight: APP_LAYOUT.mobileHeaderHeight + (isNative ? insets.top : 0),
    desktopHeaderHeight: APP_LAYOUT.desktopHeaderHeight,
    mobileHeaderHeight: APP_LAYOUT.mobileHeaderHeight,
    stretch: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' as const },
  }
}

export type UseAppLayoutResult = ReturnType<typeof useAppLayout>
