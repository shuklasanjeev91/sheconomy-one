import { config as configBase } from '@tamagui/config/v3'
import { createAnimations } from '@tamagui/animations-css'
import { createTamagui } from 'tamagui'

import { themes, tokens } from './themes'

const extraAnimations = createAnimations({
  smooth: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  lift: '200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  springy: '380ms cubic-bezier(0.34, 1.45, 0.64, 1)',
})

/**
 * Tamagui v3 preset plus a custom `sheconomy` accent theme derived from the
 * logo palette (#D01060 magenta, #F87840 coral).
 */
const tamaguiConfig = createTamagui({
  ...configBase,
  tokens,
  themes,
  animations: {
    ...configBase.animations,
    ...extraAnimations,
  },
  settings: {
    ...configBase.settings,
    fastSchemeChange: true,
    // SSR renders mobile breakpoints; client hydrates with same defaults first.
    mediaQueryDefaultActive: {
      sm: false,
      md: false,
      lg: false,
      xl: false,
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
