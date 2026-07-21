/** Cross-platform layout tokens shared by web, iOS, and Android. */
export const APP_LAYOUT = {
  railPaddingMobile: 16,
  railPaddingTablet: 20,
  railPaddingDesktop: 24,
  railPaddingWide: 32,
  sectionGapMobile: 20,
  sectionGapDesktop: 28,
  /**
   * Mobile tab dock content height only (icons + labels + dock padding).
   * Safe-area / home-indicator is added separately in `useAppLayout`.
   */
  mobileTabBarHeight: 56,
  desktopHeaderHeight: 60,
  mobileHeaderHeight: 96,
  stickyTopDesktop: 60,
  /** Web desktop breakpoint — matches `app/_layout.tsx` media queries. */
  desktopMinWidth: 1021,
  /** Narrow column for OTP inputs and focused forms only — not page shells. */
  maxFormWidth: 560,
  /** Auth form column on desktop split layout. */
  maxAuthFormWidth: 480,
  /** Content rails — always full viewport width. */
  contentMaxWidth: '100%',
} as const

export type AppLayoutTokens = typeof APP_LAYOUT
