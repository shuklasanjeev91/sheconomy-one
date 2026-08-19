import { Platform } from 'react-native'

/** Full-width stretch props for any page section, rail, or card. */
export const LAYOUT_STRETCH = {
  width: '100%',
  maxWidth: '100%',
  alignSelf: 'stretch',
} as const

/** Bottom tab bar — fixed on web, pinned to screen bottom on native. */
export function tabBarPositionStyle() {
  return Platform.select({
    web: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      maxWidth: '100vw',
    },
    default: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
    },
  })
}

/** Sticky/fixed bottom action bar above tab bar. */
export function bottomBarPositionStyle(bottomOffset = 0) {
  return Platform.select({
    web: {
      position: 'fixed' as const,
      bottom: bottomOffset,
      left: 0,
      right: 0,
      zIndex: 150,
    },
    default: {
      position: 'absolute' as const,
      bottom: bottomOffset,
      left: 0,
      right: 0,
      zIndex: 150,
    },
  })
}

/**
 * Clears the compositing hint react-native-web puts on every ScrollView
 * (`transform: translateZ(0)`).
 *
 * A transform makes an element the containing block for its `position: fixed`
 * descendants, so a drawer rendered inside a page scroller anchors to the
 * scroll box instead of the viewport — and the scroller's `overflow` then clips
 * it. That is what cut the vendor drawers off mid-page. Spread this into the
 * style of any scroller that hosts route content.
 */
export function scrollHostTransformReset() {
  return Platform.OS === 'web' ? ({ transform: 'none' } as const) : null
}

/** Full-screen overlay backdrop (filters, modals). */
export function overlayBackdropStyle() {
  return Platform.select({
    web: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100dvh',
      maxWidth: '100vw',
      maxHeight: '100dvh',
    },
    default: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  })
}

/** Right-edge drawer panel pinned to the viewport. */
export function overlayPanelStyle() {
  return Platform.select({
    web: {
      position: 'fixed' as const,
      top: 0,
      right: 0,
      bottom: 0,
      height: '100dvh',
      maxHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
    },
    default: { position: 'absolute' as const, top: 0, right: 0, bottom: 0 },
  })
}

/** Slide-in panel from edge (filter drawer). */
export function edgePanelPositionStyle() {
  return Platform.select({
    web: { position: 'fixed' as const, top: 0, left: 0, bottom: 0 },
    default: { position: 'absolute' as const, top: 0, left: 0, bottom: 0 },
  })
}
