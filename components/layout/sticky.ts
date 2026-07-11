import { Platform } from 'react-native'

import { APP_LAYOUT } from '~/lib/layout/constants'

/** Offset below the sticky desktop header when pinning side rails / order summary. */
export const STICKY_RAIL_TOP = APP_LAYOUT.desktopHeaderHeight + 20

type StickyRailOptions = {
  top?: number
  /** Allow tall rails to scroll inside the viewport while pinned. */
  scrollable?: boolean
}

/**
 * Web `position: sticky` for order summary and community side rails.
 * On native, returns align-only styles (no sticky).
 */
export function stickyRailStyle(options: StickyRailOptions = {}) {
  const top = options.top ?? STICKY_RAIL_TOP
  const base = {
    alignSelf: 'flex-start' as const,
  }

  if (Platform.OS !== 'web') {
    return base
  }

  const style: Record<string, string | number> = {
    position: 'sticky',
    top,
    alignSelf: 'flex-start',
    zIndex: 5,
  }

  if (options.scrollable) {
    style.maxHeight = `calc(100vh - ${top + 16}px)`
    style.overflowY = 'auto'
  }

  return style
}
