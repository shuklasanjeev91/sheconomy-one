import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps, ThemeName } from 'tamagui'
import { Button as TButton } from 'tamagui'
import { brandColors } from '~/config/brand-colors'
import { BRAND_THEME } from '~/config/tokens'
import { useForcedScheme } from '~/lib/theme/scheme-override'

const AnyButton = TButton as unknown as ComponentType<any>

export type ButtonTone = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

export type ButtonProps = GetProps<typeof TButton> & {
  /** Semantic color/emphasis — maps to Tamagui's theme system under the hood. */
  tone?: ButtonTone
}

const TONE_STYLE: Record<ButtonTone, Record<string, unknown>> = {
  // Fixed colors: the dark theme's $color1 / $color10 are near-black / pale pink,
  // which fail contrast on the brand fill.
  primary: {
    backgroundColor: brandColors.primary,
    color: '#FFFFFF',
    borderWidth: 0,
    hoverStyle: { backgroundColor: brandColors.primaryDark, y: -1 },
    pressStyle: { backgroundColor: brandColors.primaryDark, scale: 0.98, y: 0 },
  },
  secondary: {
    backgroundColor: '$color3',
    color: '$color12',
    borderWidth: 0,
    hoverStyle: { backgroundColor: '$color4', y: -1 },
    pressStyle: { backgroundColor: '$color4', scale: 0.98, y: 0 },
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '$borderColor',
    color: '$color12',
    hoverStyle: { backgroundColor: '$color2', borderColor: '$color7', color: '$color12', y: -1 },
    pressStyle: { backgroundColor: '$color3', borderColor: '$color7', color: '$color12', scale: 0.98, y: 0 },
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '$color11',
    hoverStyle: { backgroundColor: '$color3', color: '$color12' },
    pressStyle: { backgroundColor: '$color4', color: '$color12', scale: 0.97 },
  },
  destructive: {
    backgroundColor: '$color9',
    color: '$color1',
    borderWidth: 0,
    hoverStyle: { backgroundColor: '$color10' },
    pressStyle: { backgroundColor: '$color10', scale: 0.97 },
  },
}

const CHROMELESS_STYLE: Record<string, unknown> = {
  backgroundColor: 'transparent',
  borderWidth: 0,
  color: '$color12',
  hoverStyle: { backgroundColor: '$color3' },
  pressStyle: { backgroundColor: '$color4', scale: 0.97 },
}

const TONE_THEME: Partial<Record<ButtonTone, ThemeName>> = {
  primary: BRAND_THEME,
  destructive: 'red',
}

/**
 * Premium button — five semantic tones on top of Tamagui's 'Button'
 * primitive. Tamagui already gives us size (`$1`…`$10`), `circular`,
 * `icon`/`iconAfter`, and full keyboard/hover/press states for free; this
 * wrapper adds a softer default shape + a tone system so call sites never
 * need to reach for raw colors.
 */
export const Button = forwardRef<any, ButtonProps>(function Button(
  { tone = 'primary', ...props },
  ref
) {
  // Tone fills are explicit props, so they would override Tamagui's chromeless variant.
  const chromeless = !!(props as { chromeless?: boolean }).chromeless
  const forcedScheme = useForcedScheme()
  const toneTheme = chromeless ? undefined : TONE_THEME[tone]
  // Inside a forced-scheme subtree Tamagui may resolve sub-themes from the root scheme.
  const theme = forcedScheme
    ? ((toneTheme ? `${forcedScheme}_${toneTheme}` : forcedScheme) as ThemeName)
    : toneTheme
  return (
    <AnyButton
      ref={ref}
      theme={theme}
      borderRadius="$7"
      fontWeight="700"
      letterSpacing={0.15}
      animation="quick"
      disabledStyle={{ opacity: 0.5 }}
      // HTML default for <button> inside a form is type=submit, which reloads the page.
      {...({ type: 'button' } as object)}
      {...(chromeless ? CHROMELESS_STYLE : TONE_STYLE[tone])}
      {...props}
    />
  )
})

Button.displayName = 'Button'