import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Slider as TSlider } from 'tamagui'

import { Text, XStack, YStack } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

const AnySliderThumb = TSlider.Thumb as unknown as ComponentType<any>

type PriceRangeSliderProps = {
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}

export function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}: PriceRangeSliderProps) {
  const ui = useAppUi()
  const bounds = useMemo(() => {
    if (max <= min) return { min: 0, max: Math.max(max, min, 1) }
    return { min, max }
  }, [min, max])

  const [values, setValues] = useState<[number, number]>([
    Math.max(bounds.min, valueMin),
    Math.min(bounds.max, valueMax),
  ])

  useEffect(() => {
    setValues([
      Math.max(bounds.min, Math.min(valueMin, bounds.max)),
      Math.min(bounds.max, Math.max(valueMax, bounds.min)),
    ])
  }, [bounds.min, bounds.max, valueMin, valueMax])

  const step = bounds.max - bounds.min > 1000 ? 50 : bounds.max - bounds.min > 200 ? 10 : 1

  return (
    <YStack gap="$3" width="100%">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={13} color={ui.textSecondary}>
          ₹{values[0].toLocaleString('en-IN')}
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          ₹{values[1].toLocaleString('en-IN')}
        </Text>
      </XStack>
      <TSlider
        theme={BRAND_THEME}
        size="$4"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={values}
        onValueChange={(next) => {
          const pair = next as number[]
          const low = Math.min(pair[0] ?? bounds.min, pair[1] ?? bounds.max)
          const high = Math.max(pair[0] ?? bounds.min, pair[1] ?? bounds.max)
          setValues([low, high])
          onChange(low, high)
        }}
      >
        <TSlider.Track backgroundColor={ui.borderSubtle} height={6} borderRadius={999}>
          <TSlider.TrackActive backgroundColor={ui.text} borderRadius={999} />
        </TSlider.Track>
        <AnySliderThumb
          index={0}
          circular
          size="$1.5"
          backgroundColor={ui.surface}
          borderWidth={2}
          borderColor={ui.text}
        />
        <AnySliderThumb
          index={1}
          circular
          size="$1.5"
          backgroundColor={ui.surface}
          borderWidth={2}
          borderColor={ui.text}
        />
      </TSlider>
    </YStack>
  )
}