import { config as configBase } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

import { themes, tokens } from './themes'

/**
 * Tamagui v3 preset plus a custom `sheconomy` accent theme derived from the
 * logo palette (#D01060 magenta, #F87840 coral).
 */
const tamaguiConfig = createTamagui({
  ...configBase,
  tokens,
  themes,
  settings: {
    ...configBase.settings,
    fastSchemeChange: true,
  },
})

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig
