import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useStableMedia } from '~/hooks/useStableMedia'
import { APP_LAYOUT } from '~/lib/layout/constants'

export function useAppLayout() {
  const media = useStableMedia()
  const insets = useSafeAreaInsets()

  const isMediaHydrated = media.isHydrated
  const isDesktop = media.gtMd
  const isDesktopWeb = Platform.OS === 'web' && media.desktopWeb
  const isWide = media.gtLg
  const isTablet = media.gtSm && !media.gtMd
  const isNative = Platform.OS !== 'web'

  const gutter = isWide
    ? APP_LAYOUT.railPaddingWide
    : isDesktop
      ? APP_LAYOUT.railPaddingDesktop
      : isTablet
        ? APP_LAYOUT.railPaddingTablet
        : APP_LAYOUT.railPaddingMobile

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
    mobileTabBarOffset: APP_LAYOUT.mobileTabBarHeight + insets.bottom,
    mobileHeaderTotalHeight: APP_LAYOUT.mobileHeaderHeight + (isNative ? insets.top : 0),
    desktopHeaderHeight: APP_LAYOUT.desktopHeaderHeight,
    mobileHeaderHeight: APP_LAYOUT.mobileHeaderHeight,
    stretch: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' as const },
  }
}

export type UseAppLayoutResult = ReturnType<typeof useAppLayout>
