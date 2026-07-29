import { config as configBase } from '@tamagui/config/v3'
import { createAnimations } from '@tamagui/animations-react-native'
import { createTamagui } from 'tamagui'

import { themes, tokens } from '~/config/themes'

/**
 * Native RN Animated driver — object timings only.
 * Never spread CSS string presets from `@tamagui/config/v3` into this map
 * (Hermes TypeError: Object is not a function).
 *
 * Note: `@tamagui/animations-moti` is deprecated / broken with current `moti`
 * ESM exports, so we use animations-react-native with a full preset map.
 */
const nativeAnimations = createAnimations({
  '0ms': { type: 'timing', duration: 0 },
  '30ms': { type: 'timing', duration: 30 },
  '50ms': { type: 'timing', duration: 50 },
  '75ms': { type: 'timing', duration: 75 },
  '100ms': { type: 'timing', duration: 100 },
  '200ms': { type: 'timing', duration: 200 },
  '250ms': { type: 'timing', duration: 250 },
  '300ms': { type: 'timing', duration: 300 },
  '400ms': { type: 'timing', duration: 400 },
  '500ms': { type: 'timing', duration: 500 },
  superBouncy: {
    type: 'spring',
    damping: 9,
    mass: 0.9,
    stiffness: 300,
  },
  bouncy: {
    type: 'spring',
    damping: 12,
    mass: 0.9,
    stiffness: 200,
  },
  kindaBouncy: {
    type: 'spring',
    damping: 15,
    mass: 1,
    stiffness: 150,
  },
  superLazy: { type: 'timing', duration: 600 },
  lazy: { type: 'timing', duration: 500 },
  medium: { type: 'timing', duration: 300 },
  slowest: { type: 'timing', duration: 800 },
  slow: { type: 'timing', duration: 450 },
  quick: { type: 'timing', duration: 150 },
  quickLessBouncy: { type: 'timing', duration: 180 },
  tooltip: {
    type: 'spring',
    damping: 18,
    mass: 0.8,
    stiffness: 220,
  },
  quicker: { type: 'timing', duration: 120 },
  quickerLessBouncy: { type: 'timing', duration: 100 },
  quickest: { type: 'timing', duration: 80 },
  quickestLessBouncy: { type: 'timing', duration: 60 },
  // App-specific extras (parity with web config)
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
  animations: nativeAnimations,
  // Phones + tablets (incl. iPad Pro): never activate desktop media.
  // Large-screen / desktop chrome is web-only.
  media: {
    ...configBase.media,
    gtMd: { minWidth: 100_000 },
    gtLg: { minWidth: 100_000 },
    gtXl: { minWidth: 100_000 },
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
