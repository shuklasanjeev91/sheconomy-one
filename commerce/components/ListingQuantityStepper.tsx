import { Text, XStack, YStack } from '~/components/ui'
import { radius, touchSlop } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingQuantityStepperProps = {
  quantity: number
  disabled?: boolean
  maxQuantity?: number | null
  size?: 'sm' | 'md'
  onDecrease: () => void
  onIncrease: () => void
}

/** Compact − / qty / + control used on listing PDP when the item is already in cart. */
export function ListingQuantityStepper({
  quantity,
  disabled,
  maxQuantity,
  size = 'md',
  onDecrease,
  onIncrease,
}: ListingQuantityStepperProps) {
  const ui = useAppUi()
  const atMax = typeof maxQuantity === 'number' && quantity >= maxQuantity
  const btnSize = size === 'sm' ? 34 : 40
  const fontSize = size === 'sm' ? 15 : 17

  return (
    <XStack
      alignItems="center"
      backgroundColor={ui.surfaceMuted}
      borderColor={ui.borderSubtle}
      borderWidth={1}
      borderRadius={radius.chip}
      overflow="hidden"
      opacity={disabled ? 0.55 : 1}
    >
      <StepperButton
        label="−"
        width={btnSize}
        height={btnSize}
        fontSize={fontSize}
        disabled={disabled}
        onPress={onDecrease}
        accessibilityLabel="Decrease quantity"
      />
      <YStack
        minWidth={size === 'sm' ? 36 : 44}
        height={btnSize}
        alignItems="center"
        justifyContent="center"
        borderLeftWidth={1}
        borderRightWidth={1}
        borderColor={ui.borderSubtle}
      >
        <Text fontSize={size === 'sm' ? 14 : 15} fontWeight="700" color={ui.text}>
          {quantity}
        </Text>
      </YStack>
      <StepperButton
        label="+"
        width={btnSize}
        height={btnSize}
        fontSize={fontSize}
        disabled={disabled || atMax}
        onPress={onIncrease}
        accessibilityLabel="Increase quantity"
      />
    </XStack>
  )
}

function StepperButton({
  label,
  width,
  height,
  fontSize,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string
  width: number
  height: number
  fontSize: number
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  const ui = useAppUi()

  return (
    <Text
      width={width}
      height={height}
      textAlign="center"
      lineHeight={height}
      fontSize={fontSize}
      fontWeight="600"
      color={disabled ? ui.textMuted : ui.text}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.45 : 1}
      onPress={disabled ? undefined : onPress}
      // Drawn at 34/40px to stay compact on the buy bar and cart rows.
      hitSlop={touchSlop(height)}
      hoverStyle={disabled ? undefined : { backgroundColor: ui.surfaceHover }}
      pressStyle={disabled ? undefined : { backgroundColor: ui.surfaceHover, opacity: 0.6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {label}
    </Text>
  )
}
