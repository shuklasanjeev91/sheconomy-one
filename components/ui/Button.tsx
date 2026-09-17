import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps, ThemeName } from 'tamagui'
import { Button as TButton } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnyButton = TButton as unknown as ComponentType<any>

export type ButtonTone = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

export type ButtonProps = GetProps<typeof TButton> & {
  /** Semantic color/emphasis — maps to Tamagui's theme system under the hood. */
  tone?: ButtonTone
}

const TONE_STYLE: Record<ButtonTone, Record<string, unknown>> = {
  primary: {
    backgroundColor: '$color9',
    color: '$color1',
    borderWidth: 0,
    hoverStyle: { backgroundColor: '$color10', y: -1 },
    pressStyle: { backgroundColor: '$color10', scale: 0.98, y: 0 },
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
  return (
    <AnyButton
      ref={ref}
      theme={TONE_THEME[tone]}
      borderRadius="$7"
      fontWeight="700"
      letterSpacing={0.15}
      animation="quick"
      disabledStyle={{ opacity: 0.5 }}
      // HTML default for <button> inside a form is type=submit, which reloads the page.
      {...({ type: 'button' } as object)}
      {...TONE_STYLE[tone]}
      {...props}
    />
  )
})

Button.displayName = 'Button'