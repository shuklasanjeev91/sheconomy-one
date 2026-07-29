import { useEffect, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { useMedia } from 'tamagui'

import { useViewportMedia } from '~/hooks/useViewportMedia'

/** Tamagui SSR defaults — keep first client paint aligned to avoid hydration blank screens. */
const SSR_MEDIA = {
  gtSm: false,
  gtMd: false,
  gtLg: false,
  gtXl: false,
  desktopWeb: false,
} as const

export type StableMedia = typeof SSR_MEDIA & { isHydrated: boolean }

/**
 * useMedia safe for SSR + hydration. On web, uses `matchMedia` (Tamagui can lag).
 *
 * Native phones + tablets (including iPad Pro) always stay on the mobile layout
 * tokens — desktop / "large screen" chrome is web-only.
 */
export function useStableMedia(): StableMedia {
  const media = useMedia()
  const viewportMedia = useViewportMedia()
  const { width } = useWindowDimensions()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (Platform.OS === 'web') {
    return {
      ...viewportMedia,
      isHydrated: true,
    }
  }

  // Native: allow compact tablet density (gtSm) but never desktop breakpoints.
  return {
    gtSm: hydrated ? width >= 801 || !!media.gtSm : false,
    gtMd: false,
    gtLg: false,
    gtXl: false,
    desktopWeb: false,
    isHydrated: hydrated,
  }
}
