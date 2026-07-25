import { orange, orangeDark } from '@tamagui/colors/legacy'

/**
 * Brand palette from official logo
 * https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png
 */
export const brandColors = {
  /** Deep magenta — primary brand / splash / CTAs */
  primary: '#D81B60',
  primaryDark: '#B0144E',
  /** Vibrant pink — globe / highlights */
  primaryLight: '#FF5E9B',
  /** Bright orange — accent diagonal / gradients */
  coral: '#FF8C42',
  coralLight: '#FFE8D6',
  /** Soft wash backgrounds */
  roseTint: '#FEF5F9',
  roseSurface: '#FCEAF1',
  softPink: '#FF9B9B',
} as const

/** 12-step light accent scale (Radix-style), anchored on logo primary at step 9 */
export const sheconomyLight = {
  sheconomy1: '#fffbfd',
  sheconomy2: '#fef5f9',
  sheconomy3: '#fceaf1',
  sheconomy4: '#fadce8',
  sheconomy5: '#f7cbdd',
  sheconomy6: '#f2b4cd',
  sheconomy7: '#eb8eb3',
  sheconomy8: '#e85a96',
  sheconomy9: brandColors.primary,
  sheconomy10: brandColors.primaryDark,
  sheconomy11: '#8f0f3f',
  sheconomy12: '#4a0a22',
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
  sheconomy11: '#ff7eb0',
  sheconomy12: '#fcddea',
} as const

/** Coral accent tokens for gradients and highlights */
export const coralScaleLight = {
  coral1: '#fff9f6',
  coral2: '#ffe8d6',
  coral3: '#ffd4b3',
  coral4: '#ffbc8a',
  coral5: '#ffa35e',
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
