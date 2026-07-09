import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { Checkbox as TCheckbox } from 'tamagui'
import { Check } from '@tamagui/lucide-icons'
import { BRAND_THEME } from '~/config/tokens'

// Checkbox's own prop type omits 'animation' despite supporting it at
// runtime — a known typing gap in some Tamagui compound components (see
// `looseStyle` in config/tokens.ts for the styled()-call equivalent fix).
// Rendering through an untyped alias sidesteps it here without weakening
// our own exported `GetProps<typeof TCheckbox>`-based prop type.
const AnyCheckbox = TCheckbox as unknown as ComponentType<any> & {
  Indicator: typeof TCheckbox.Indicator
}

export const Checkbox = forwardRef<any, GetProps<typeof TCheckbox>>(function Checkbox(
  props,
  ref
) {
  return (
    <AnyCheckbox
      ref={ref}
      theme={BRAND_THEME}
      size="$5"
      borderRadius="$3"
      borderWidth={1.5}
      borderColor="$borderColor"
      backgroundColor="$background"
      animation="quick"
      {...props}
    >
      <AnyCheckbox.Indicator backgroundColor="$color9" borderColor="$color9">
        <Check size={14} color="$color1" strokeWidth={3} />
      </AnyCheckbox.Indicator>
    </AnyCheckbox>
  )
})

Checkbox.displayName = 'Checkbox'