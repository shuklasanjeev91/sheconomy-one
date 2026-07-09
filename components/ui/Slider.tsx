import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { Slider as TSlider } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnySliderThumb = TSlider.Thumb as unknown as ComponentType<any>

export const Slider = forwardRef<any, GetProps<typeof TSlider>>(function Slider(props, ref) {
  return (
    <TSlider ref={ref} theme={BRAND_THEME} size="$4" {...props}>
      <TSlider.Track backgroundColor="$color4" height={6} borderRadius="$10">
        <TSlider.TrackActive backgroundColor="$color9" borderRadius="$10" />
      </TSlider.Track>
      <AnySliderThumb
        index={0}
        circular
        size="$1.5"
        backgroundColor="white"
        borderWidth={2}
        borderColor="$color9"
        animation="quick"
        elevation="$1"
      />
    </TSlider>
  )
})

Slider.displayName = 'Slider'