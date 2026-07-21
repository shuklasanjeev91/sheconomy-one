import { config as configBase } from '@tamagui/config/v3'
import { createAnimations } from '@tamagui/animations-react-native'
import { createTamagui } from 'tamagui'

import { themes, tokens } from './themes'

/**
 * Native uses React Native Animated — CSS string timings from
 * `@tamagui/animations-css` are web-only and break Hermes when mixed into
 * the v3 RN animation driver (TypeError: Object is not a function).
 */
const extraAnimations = createAnimations({
  smooth: { type: 'timing', duration: 250 },
  lift: { type: 'timing', duration: 200 },
  springy: {
    type: 'spring',
    damping: 15,
    mass: 0.9,
    stiffness: 150,
  },
})

const tamaguiConfig = createTamagui({
  ...configBase,
  tokens,
  themes,
  // Same merge shape as web config — replace CSS drivers with RN Animated.
  animations: {
    ...configBase.animations,
    ...extraAnimations,
    animations: {
      ...configBase.animations.animations,
      ...extraAnimations.animations,
    },
  },
  settings: {
    ...configBase.settings,
    fastSchemeChange: true,
    mediaQueryDefaultActive: {
      sm: false,
      md: false,
      lg: false,
      xl: false,
      gtXs: false,
      gtSm: false,
      gtMd: false,
      gtLg: false,
      gtXl: false,
    },
  },
})

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig
