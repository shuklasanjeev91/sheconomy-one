import { Platform } from 'react-native'

/** Full-viewport height — flex on native; web uses minHeight so document can grow and scroll. */
export function screenFillStyle() {
  return Platform.select({
    web: { minHeight: '100vh' as const, width: '100%' as const, maxWidth: '100%' as const },
    default: { flex: 1, width: '100%' as const, maxWidth: '100%' as const },
  })
}

/** App shell viewport — document flow on web desktop, locked viewport on native + mobile web. */
export function appShellStyle(isDesktop: boolean) {
  if (Platform.OS !== 'web') return undefined

  if (isDesktop) {
    return {
      // Fill viewport so CommerceDesktopFooter sits after page content
      // (bottom of short pages, end of long pages).
      flexGrow: 1,
      minHeight: '100dvh' as const,
      width: '100%' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    }
  }

  return {
    height: '100dvh' as const,
    minHeight: '100dvh' as const,
    width: '100%' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
  }
}

/**
 * Locked app shell for pane apps (chat / community / class / co-work).
 * Gives flex children a definite height so they cannot collapse to a blank pane.
 */
export function lockedAppShellStyle() {
  if (Platform.OS !== 'web') return undefined
  return {
    height: '100dvh' as const,
    minHeight: '100dvh' as const,
    maxHeight: '100dvh' as const,
    width: '100%' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  }
}

/** Locked viewport for live meeting — prevents scroll and keeps controls on screen. */
export function meetingViewportStyle() {
  return Platform.select({
    web: {
      flex: 1,
      width: '100%' as const,
      maxWidth: '100%' as const,
      height: '100dvh' as const,
      maxHeight: '100dvh' as const,
      minHeight: '100dvh' as const,
      overflow: 'hidden' as const,
      position: 'relative' as const,
    },
    default: { flex: 1, width: '100%' as const, maxWidth: '100%' as const },
  })
}

/** Centered placeholder min height — flex on native, vh on web desktop. */
export function pageCenterMinHeight(isDesktop: boolean) {
  if (Platform.OS !== 'web') return undefined
  return isDesktop ? ('50vh' as const) : undefined
}
