import { Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useStableMedia } from '~/hooks/useStableMedia'
import { APP_LAYOUT } from '~/lib/layout/constants'
import {
  listingGridColumnsForWidth,
  type ListingGridColumns,
} from '~/lib/layout/listing-grid-columns'

export type { ListingGridColumns }

export function useAppLayout() {
  const media = useStableMedia()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const isMediaHydrated = media.isHydrated
  // Native never uses desktop chrome — iPad Pro logical width is ≥1024, which
  // used to flip `isDesktop` and hide the bottom tab bar while PageScroll still
  // reserved `mobileTabBarOffset` (empty footer gap).
  const isNative = Platform.OS !== 'web'
  const isDesktop = isNative ? false : media.gtMd
  const isDesktopWeb = Platform.OS === 'web' && media.desktopWeb
  // Wide rails are a large-screen (web) concern — never on iPhone/iPad.
  const isWide = Platform.OS === 'web' ? media.gtLg : false
  const isTablet =
    Platform.OS === 'web' ? media.gtSm && !media.gtMd : width >= 600

  const gutter = isWide
    ? APP_LAYOUT.railPaddingWide
    : isDesktop
      ? APP_LAYOUT.railPaddingDesktop
      : isTablet
        ? APP_LAYOUT.railPaddingTablet
        : APP_LAYOUT.railPaddingMobile

  const mobileTabBarOffset = APP_LAYOUT.mobileTabBarHeight + insets.bottom

  /**
   * Content sits beside a side rail — community sidebars, settings nav, Manage
   * shop sidebar, two-column pages.
   *
   * Kept separate from `isDesktop` so a large tablet (iPad Pro / web tablet band)
   * can take the wide content layout while keeping touch chrome when needed:
   * native always keeps the mobile header + bottom tabs; web uses desktop chrome
   * only when `gtMd` / `desktopWeb` apply.
   */
  const hasSideRails =
    isDesktop || width >= APP_LAYOUT.tabletSideRailMinWidth

  /** Room for a second rail (community right sidebar) beside the content. */
  const hasDualSideRails =
    isWide || width >= APP_LAYOUT.tabletDualSideRailMinWidth

  /**
   * Columns for product grids from viewport width (minus typical chrome).
   * Prefer measuring the grid host with `listingGridColumnsForWidth` when a
   * filter sidebar shrinks the content column (category / search PLP).
   */
  const listingGridColumns: ListingGridColumns = listingGridColumnsForWidth(
    Math.max(
      320,
      width -
        (hasSideRails ? 220 : 0) -
        // Category filter sidebar when present on wide screens.
        (isWide ? 300 : 0) -
        gutter * 2,
    ),
  )

  /** Fixed card width for horizontal listing carousels, same breakpoints. */
  const listingCardWidth = isWide ? 220 : isDesktop ? 200 : media.gtSm ? 168 : 160

  return {
    listingGridColumns,
    listingCardWidth,
    hasSideRails,
    hasDualSideRails,
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
