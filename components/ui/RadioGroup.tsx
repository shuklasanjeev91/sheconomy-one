import { forwardRef, useCallback } from 'react'
import type { GetProps } from 'tamagui'
import { RadioGroup as TRadioGroup, Text, XStack, YStack } from 'tamagui'

import { brandColors } from '~/config/brand-colors'
import { BRAND_THEME } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

export const RadioGroup = forwardRef<any, GetProps<typeof TRadioGroup>>(function RadioGroup(
  props,
  ref,
) {
  return <TRadioGroup ref={ref} theme={BRAND_THEME} gap="$1" {...props} />
})
RadioGroup.displayName = 'RadioGroup'

type RadioGroupItemWithLabelProps = {
  value: string
  label: string
  disabled?: boolean
  /** Controlled selected state — pass from parent for reliable native presses. */
  selected?: boolean
  /** Called when the row is pressed. */
  onSelect?: (value: string) => void
}

/**
 * Full-row radio with a large hit target for web, iOS, and Android.
 * Pass `selected` + `onSelect` from the parent (do not rely on Label htmlFor).
 */
export function RadioGroupItemWithLabel({
  value,
  label,
  disabled,
  onSelect,
  selected = false,
}: RadioGroupItemWithLabelProps) {
  const ui = useAppUi()

  const select = useCallback(() => {
    if (disabled) return
    onSelect?.(value)
  }, [disabled, onSelect, value])

  return (
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical="$3"
      paddingHorizontal="$2"
      minHeight={48}
      borderRadius={12}
      opacity={disabled ? 0.5 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { backgroundColor: ui.navHover }}
      pressStyle={disabled ? undefined : { opacity: 0.88, backgroundColor: ui.navHover }}
      onPress={select}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={label}
    >
      <YStack
        width={22}
        height={22}
        borderRadius={999}
        borderWidth={2}
        borderColor={selected ? brandColors.primary : ui.border}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.surface}
        flexShrink={0}
      >
        {selected ? (
          <YStack
            width={12}
            height={12}
            borderRadius={999}
            backgroundColor={brandColors.primary}
          />
        ) : null}
      </YStack>
      <Text color={ui.text} fontSize={15} fontWeight="600" flex={1}>
        {label}
      </Text>
    </XStack>
  )
}
