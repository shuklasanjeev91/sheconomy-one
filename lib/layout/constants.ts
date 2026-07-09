/** Cross-platform layout tokens shared by web, iOS, and Android. */
export const APP_LAYOUT = {
  railPaddingMobile: 16,
  railPaddingTablet: 20,
  railPaddingDesktop: 24,
  railPaddingWide: 32,
  sectionGapMobile: 20,
  sectionGapDesktop: 28,
  mobileTabBarHeight: 88,
  desktopHeaderHeight: 60,
  mobileHeaderHeight: 96,
  stickyTopDesktop: 60,
  /** Optional cap for focused flows (auth, settings forms). Main feeds stay full width. */
  maxFormWidth: 560,
  maxAuthWidth: 1120,
  /** Content rails — feeds and commerce use full width; no global max cap. */
  contentMaxWidth: '100%',
} as const

export type AppLayoutTokens = typeof APP_LAYOUT
