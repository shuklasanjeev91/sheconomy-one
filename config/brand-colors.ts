import { orange, orangeDark } from '@tamagui/colors/legacy'

/** Extracted from sheconomy-logo_v2.png — primary wordmark magenta */
export const brandColors = {
  primary: '#D01060',
  primaryDark: '#BD0E54',
  primaryLight: '#E83870',
  coral: '#F87840',
  coralLight: '#FFEDE5',
  roseTint: '#FEF5F9',
  roseSurface: '#FCEAF1',
} as const

/** 12-step light accent scale (Radix-style), anchored on logo #D01060 at step 9 */
export const sheconomyLight = {
  sheconomy1: '#fefcfd',
  sheconomy2: '#fef5f9',
  sheconomy3: '#fceaf1',
  sheconomy4: '#fadce8',
  sheconomy5: '#f7cbdd',
  sheconomy6: '#f2b4cd',
  sheconomy7: '#eb8eb3',
  sheconomy8: '#e35890',
  sheconomy9: brandColors.primary,
  sheconomy10: brandColors.primaryDark,
  sheconomy11: '#a20a47',
  sheconomy12: '#500b27',
} as const

/** 12-step dark accent scale */
export const sheconomyDark = {
  sheconomy1: '#1c0f14',
  sheconomy2: '#241118',
  sheconomy3: '#311520',
  sheconomy4: '#3d1927',
  sheconomy5: '#491c2e',
  sheconomy6: '#5a1f37',
  sheconomy7: '#742444',
  sheconomy8: '#992855',
  sheconomy9: brandColors.primary,
  sheconomy10: brandColors.primaryLight,
  sheconomy11: '#f6639e',
  sheconomy12: '#fcddea',
} as const

/** Coral accent tokens for gradients and highlights */
export const coralScaleLight = {
  coral1: '#fff9f6',
  coral2: '#ffede5',
  coral3: '#ffdccc',
  coral4: '#ffc4a8',
  coral5: '#ffa97d',
  coral6: brandColors.coral,
  coral7: '#e86a30',
  coral8: '#c45624',
  coral9: '#a3451c',
  coral10: '#853814',
  coral11: '#6b2d10',
  coral12: '#3d1808',
} as const

const transparent = (color: string, opacity = 0) => {
  if (color.startsWith('hsl')) {
    return color.replace('%)', `%, ${opacity})`).replace('hsl(', 'hsla(')
  }
  const hex = color.replace('#', '')
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/** Builds Tamagui accent palettes (same shape as v3 pink/purple palettes). */
export function buildAccentPalette(
  colors: Record<string, string>,
  accentColors: Record<string, string>,
): string[] {
  const colorPalette = Object.values(colors)
  const colorI = colorPalette.length - 4
  const accentPalette = Object.values(accentColors)
  const accentBackground = accentPalette[0]
  const accentColor = accentPalette[accentPalette.length - 1]

  return [
    accentBackground,
    transparent(colorPalette[0], 0),
    transparent(colorPalette[0], 0.25),
    transparent(colorPalette[0], 0.5),
    transparent(colorPalette[0], 0.75),
    ...colorPalette,
    transparent(colorPalette[colorI], 0.75),
    transparent(colorPalette[colorI], 0.5),
    transparent(colorPalette[colorI], 0.25),
    transparent(colorPalette[colorI], 0),
    accentColor,
  ]
}

export const sheconomyLightPalette = buildAccentPalette(sheconomyLight, orange)
export const sheconomyDarkPalette = buildAccentPalette(sheconomyDark, orangeDark)

function postfixObjKeys<A extends Record<string, string>, B extends string>(
  obj: A,
  postfix: B,
): Record<`${keyof A extends string ? keyof A : never}${B}`, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [`${k}${postfix}`, v]),
  ) as Record<`${keyof A extends string ? keyof A : never}${B}`, string>
}

export { postfixObjKeys }
