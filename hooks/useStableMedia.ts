import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { useMedia } from '~/components/ui'
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
 * Native keeps mobile defaults until mount, then reflects the real viewport.
 */
export function useStableMedia(): StableMedia {
  const media = useMedia()
  const viewportMedia = useViewportMedia()
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

  return {
    ...(hydrated ? media : SSR_MEDIA),
    isHydrated: hydrated,
  }
}
