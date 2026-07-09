import { Platform } from 'react-native'

/** Full-viewport height — flex on native, minHeight vh on web. */
export function screenFillStyle() {
  return Platform.select({
    web: { flex: 1, minHeight: '100vh' as const, width: '100%' as const, maxWidth: '100%' as const },
    default: { flex: 1, width: '100%' as const, maxWidth: '100%' as const },
  })
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
