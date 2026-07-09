import {
  blue,
  blueDark,
  gray,
  grayDark,
  green,
  greenDark,
  orange,
  orangeDark,
  pink,
  pinkDark,
  purple,
  purpleDark,
  red,
  redDark,
  yellow,
  yellowDark,
} from '@tamagui/colors/legacy'
import { createThemeBuilder } from '@tamagui/theme-builder'
import {
  defaultComponentThemes,
  defaultPalettes,
  defaultSubThemes,
  defaultTemplates,
  tokens as v3ThemeTokens,
} from '@tamagui/themes/v3-themes'
import { createTokens } from '@tamagui/web'

import {
  coralScaleLight,
  postfixObjKeys,
  sheconomyDark,
  sheconomyDarkPalette,
  sheconomyLight,
  sheconomyLightPalette,
} from './brand-colors'

const lightShadowColor = 'rgba(0,0,0,0.04)'
const lightShadowColorStrong = 'rgba(0,0,0,0.085)'
const darkShadowColor = 'rgba(0,0,0,0.2)'
const darkShadowColorStrong = 'rgba(0,0,0,0.3)'

const colorTokens = {
  light: { blue, gray, green, orange, pink, purple, red, yellow },
  dark: {
    blue: blueDark,
    gray: grayDark,
    green: greenDark,
    orange: orangeDark,
    pink: pinkDark,
    purple: purpleDark,
    red: redDark,
    yellow: yellowDark,
  },
}

const darkColors = {
  ...colorTokens.dark.blue,
  ...colorTokens.dark.gray,
  ...colorTokens.dark.green,
  ...colorTokens.dark.orange,
  ...colorTokens.dark.pink,
  ...colorTokens.dark.purple,
  ...colorTokens.dark.red,
  ...colorTokens.dark.yellow,
  ...sheconomyDark,
}

const lightColors = {
  ...colorTokens.light.blue,
  ...colorTokens.light.gray,
  ...colorTokens.light.green,
  ...colorTokens.light.orange,
  ...colorTokens.light.pink,
  ...colorTokens.light.purple,
  ...colorTokens.light.red,
  ...colorTokens.light.yellow,
  ...sheconomyLight,
  ...coralScaleLight,
}

const color = {
  white0: 'rgba(255,255,255,0)',
  white075: 'rgba(255,255,255,0.75)',
  white05: 'rgba(255,255,255,0.5)',
  white025: 'rgba(255,255,255,0.25)',
  black0: 'rgba(10,10,10,0)',
  black075: 'rgba(10,10,10,0.75)',
  black05: 'rgba(10,10,10,0.5)',
  black025: 'rgba(10,10,10,0.25)',
  white1: '#fff',
  white2: '#f8f8f8',
  white3: 'hsl(0, 0%, 96.3%)',
  white4: 'hsl(0, 0%, 94.1%)',
  white5: 'hsl(0, 0%, 92.0%)',
  white6: 'hsl(0, 0%, 90.0%)',
  white7: 'hsl(0, 0%, 88.5%)',
  white8: 'hsl(0, 0%, 81.0%)',
  white9: 'hsl(0, 0%, 56.1%)',
  white10: 'hsl(0, 0%, 50.3%)',
  white11: 'hsl(0, 0%, 42.5%)',
  white12: 'hsl(0, 0%, 9.0%)',
  black1: '#050505',
  black2: '#151515',
  black3: '#191919',
  black4: '#232323',
  black5: '#282828',
  black6: '#323232',
  black7: '#424242',
  black8: '#494949',
  black9: '#545454',
  black10: '#626262',
  black11: '#a5a5a5',
  black12: '#fff',
  ...postfixObjKeys(lightColors, 'Light'),
  ...postfixObjKeys(darkColors, 'Dark'),
}

const shadows = {
  light: {
    shadowColor: lightShadowColorStrong,
    shadowColorHover: lightShadowColorStrong,
    shadowColorPress: lightShadowColor,
    shadowColorFocus: lightShadowColor,
  },
  dark: {
    shadowColor: darkShadowColorStrong,
    shadowColorHover: darkShadowColorStrong,
    shadowColorPress: darkShadowColor,
    shadowColorFocus: darkShadowColor,
  },
}

const nonInherited = {
  light: { ...lightColors, ...shadows.light },
  dark: { ...darkColors, ...shadows.dark },
}

const palettes = {
  ...defaultPalettes,
  light_sheconomy: sheconomyLightPalette,
  dark_sheconomy: sheconomyDarkPalette,
}

const themeBuilder = createThemeBuilder()
  .addPalettes(palettes)
  .addTemplates(defaultTemplates)
  .addThemes({
    light: {
      template: 'base',
      palette: 'light',
      nonInheritedValues: nonInherited.light,
    },
    dark: {
      template: 'base',
      palette: 'dark',
      nonInheritedValues: nonInherited.dark,
    },
  })
  .addChildThemes({
    orange: { palette: 'orange', template: 'base' },
    yellow: { palette: 'yellow', template: 'base' },
    green: { palette: 'green', template: 'base' },
    blue: { palette: 'blue', template: 'base' },
    purple: { palette: 'purple', template: 'base' },
    pink: { palette: 'pink', template: 'base' },
    red: { palette: 'red', template: 'base' },
    gray: { palette: 'gray', template: 'base' },
    sheconomy: { palette: 'sheconomy', template: 'base' },
  })
  .addChildThemes(defaultSubThemes)
  .addComponentThemes(defaultComponentThemes, {
    avoidNestingWithin: ['alt1', 'alt2', 'surface1', 'surface2', 'surface3', 'surface4'],
  })

export const themes = themeBuilder.build()

const { color: _ignored, ...restV3Tokens } = v3ThemeTokens

export const tokens = createTokens({
  color,
  ...restV3Tokens,
})
