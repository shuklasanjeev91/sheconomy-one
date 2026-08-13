import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'

/**
 * Safe-area insets for overlays that cover the entire device screen — bottom
 * sheets, dialogs, and popovers/selects adapted into a sheet.
 *
 * `AppShell` wraps routes in `NativeSafeArea edges={['top']}`, so the shell owns
 * the top inset and delegates the bottom to whatever docks there. Full-screen
 * overlays escape that wrapper entirely and Android draws edge-to-edge, so they
 * paint behind both the status bar and the navigation bar and must inset
 * themselves. Returns zeroes on web, where the page owns its own chrome.
 */
export function useFullscreenOverlayInsets() {
  const insets = useSafeAreaInsets()

  return {
    top: isNativeFullscreenOverlay ? insets.top : 0,
    bottom: isNativeFullscreenOverlay ? insets.bottom : 0,
  }
}
