import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { RadioGroup as TRadioGroup, XStack, Label as TLabel } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnyRadioGroupItem = TRadioGroup.Item as unknown as ComponentType<any>

export const RadioGroup = forwardRef<any, GetProps<typeof TRadioGroup>>(function RadioGroup(
  props,
  ref
) {
  return <TRadioGroup ref={ref} theme={BRAND_THEME} gap="$3" {...props} />
})
RadioGroup.displayName = 'RadioGroup'

export function RadioGroupItemWithLabel({
  value,
  label,
  disabled,
}: {
  value: string
  label: string
  disabled?: boolean
}) {
  const id = `radio-${value}`
  return (
    <XStack alignItems="center" gap="$2.5">
      <AnyRadioGroupItem
        value={value}
        id={id}
        disabled={disabled}
        size="$4.5"
        borderColor="$borderColor"
        borderWidth={1.5}
        animation="quick"
      >
        <TRadioGroup.Indicator backgroundColor="$color9" />
      </AnyRadioGroupItem>
      <TLabel htmlFor={id} size="$4" color="$color12">
        {label}
      </TLabel>
    </XStack>
  )
}