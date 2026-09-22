import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Platform } from 'react-native'
import { Theme, useThemeName } from 'tamagui'

/**
 * Paint overlays on the real viewport.
 *
 * Vendor (and other) screens render inside a scrolling host. A `transform` or
 * `overflow` on that host becomes the containing block for `position: fixed`,
 * so backdrops shrink to a grey rectangle and drawers clip off the top/right.
 * Portaling to `document.body` keeps the same React tree (context, clicks)
 * while escaping that box. Native keeps in-place rendering.
 *
 * Re-provide `<Theme>` inside the portal so Tamagui leaves (YStack / lucide
 * icons) never see an empty ThemeStateContext if a bundler split duplicates
 * `@tamagui/core` across async meeting chunks.
 */
export function ViewportOverlay({ children }: { children: ReactNode }) {
  const themeName = useThemeName()
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return createPortal(<Theme name={themeName}>{children}</Theme>, document.body)
  }
  return <>{children}</>
}
