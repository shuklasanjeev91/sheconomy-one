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

/** Full-screen overlay backdrop (filters, modals). */
export function overlayBackdropStyle() {
  return Platform.select({
    web: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0 },
    default: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  })
}

/** Slide-in panel from edge (filter drawer). */
export function edgePanelPositionStyle() {
  return Platform.select({
    web: { position: 'fixed' as const, top: 0, left: 0, bottom: 0 },
    default: { position: 'absolute' as const, top: 0, left: 0, bottom: 0 },
  })
}
