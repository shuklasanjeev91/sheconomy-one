import { Platform, type ViewStyle } from 'react-native'

import { getShadowStyle } from '~/config/tokens'
import type { CoWorkShadows } from '~/co-work/lib/theme'

type ShadowKey = keyof CoWorkShadows

const nativeShadowSize: Record<ShadowKey, 'sm' | 'md' | 'lg'> = {
  card: 'md',
  panel: 'lg',
  dock: 'lg',
  tile: 'md',
}

/** Co-Work box shadow on web, elevation on iOS/Android. */
export function coworkBoxShadow(shadows: CoWorkShadows, key: ShadowKey): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: shadows[key] } as ViewStyle
  }
  return getShadowStyle(nativeShadowSize[key]) as ViewStyle
}

/** Page background gradient on web, solid fallback on native. */
export function pageGradientStyle(gradient: string, fallbackColor: string): ViewStyle {
  if (Platform.OS === 'web') {
    return { background: gradient } as ViewStyle
  }
  return { backgroundColor: fallbackColor }
}

/** Control button gradient on web, brand-tinted solid on native. */
export function controlGradientStyle(gradient: string, fallbackColor: string): ViewStyle {
  if (Platform.OS === 'web') {
    return { backgroundImage: gradient } as ViewStyle
  }
  return { backgroundColor: fallbackColor }
}

/** Bottom dock fade on web, solid tint on native. */
export function footerFadeStyle(webGradient: string, nativeColor: string): ViewStyle {
  if (Platform.OS === 'web') {
    return { background: webGradient } as ViewStyle
  }
  return { backgroundColor: nativeColor }
}
