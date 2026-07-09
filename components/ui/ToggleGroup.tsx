import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { ToggleGroup as TToggleGroup } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnyToggleGroupItem = TToggleGroup.Item as unknown as ComponentType<any>

export const ToggleGroup = forwardRef<any, GetProps<typeof TToggleGroup>>(function ToggleGroup(
  props,
  ref
) {
  return (
    <TToggleGroup
      ref={ref}
      theme={BRAND_THEME}
      backgroundColor="$color3"
      borderRadius="$6"
      padding="$1"
      borderWidth={0}
      {...props}
    />
  )
})
ToggleGroup.displayName = 'ToggleGroup'

export const ToggleGroupItem = forwardRef<any, GetProps<typeof TToggleGroup.Item>>(
  function ToggleGroupItem(props, ref) {
    return (
      <AnyToggleGroupItem
        ref={ref}
        borderWidth={0}
        borderRadius="$5"
        backgroundColor="transparent"
        animation="quick"
        fontWeight="600"
        activeStyle={{ backgroundColor: '$color9', col: '$color1' }}
        {...props}
      />
    )
  }
)
ToggleGroupItem.displayName = 'ToggleGroupItem'