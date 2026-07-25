import { useMemo } from 'react'

import { getShadowStyle, type ShadowSize } from '~/config/tokens'

import { useIsDarkTheme } from '~/lib/theme/useAppUi'

/** Theme-aware shadow preset for cards, panels, and chrome. */
export function useThemedShadowStyle(size: ShadowSize = 'sm') {
  const isDark = useIsDarkTheme()
  return useMemo(() => getShadowStyle(size, isDark ? 'dark' : 'light'), [isDark, size])
}
