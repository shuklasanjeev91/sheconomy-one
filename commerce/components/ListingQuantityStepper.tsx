import { Text, XStack, YStack } from '~/components/ui'
import { radius, touchSlop } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingQuantityStepperProps = {
  quantity: number
  disabled?: boolean
  maxQuantity?: number | null
  size?: 'sm' | 'md' | 'lg'
  /** Stretch across the parent (PDP buy box, sticky bar, listing cards). */
  fullWidth?: boolean
  onDecrease: () => void
  onIncrease: () => void
}

/** − / qty / + control — compact by default, or full-width when item is in cart. */
export function ListingQuantityStepper({
  quantity,
  disabled,
  maxQuantity,
  size = 'md',
  fullWidth = false,
  onDecrease,
  onIncrease,
}: ListingQuantityStepperProps) {
  const ui = useAppUi()
  const atMax = typeof maxQuantity === 'number' && quantity >= maxQuantity
  const btnSize = size === 'sm' ? 34 : size === 'lg' ? 48 : 40
  const fontSize = size === 'sm' ? 15 : size === 'lg' ? 20 : 17
  const qtyFontSize = size === 'sm' ? 14 : size === 'lg' ? 16 : 15

  return (
    <XStack
      alignItems="center"
      width={fullWidth ? '100%' : undefined}
      backgroundColor={ui.surfaceMuted}
      borderColor={ui.borderSubtle}
      borderWidth={1}
      borderRadius={fullWidth ? 8 : radius.chip}
      overflow="hidden"
      opacity={disabled ? 0.55 : 1}
    >
      <StepperButton
        label="−"
        width={fullWidth ? undefined : btnSize}
        flex={fullWidth ? 1 : undefined}
        height={btnSize}
        fontSize={fontSize}
        disabled={disabled}
        onPress={onDecrease}
        accessibilityLabel="Decrease quantity"
      />
      <YStack
        minWidth={fullWidth ? 56 : size === 'sm' ? 36 : 44}
        width={fullWidth ? undefined : undefined}
        flex={fullWidth ? 0 : undefined}
        paddingHorizontal={fullWidth ? '$3' : undefined}
        height={btnSize}
        alignItems="center"
        justifyContent="center"
        borderLeftWidth={1}
        borderRightWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Text fontSize={qtyFontSize} fontWeight="700" color={ui.text}>
          {quantity}
        </Text>
      </YStack>
      <StepperButton
        label="+"
        width={fullWidth ? undefined : btnSize}
        flex={fullWidth ? 1 : undefined}
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
  flex,
  height,
  fontSize,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string
  width?: number
  flex?: number
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
      flex={flex}
      height={height}
      textAlign="center"
      lineHeight={height}
      fontSize={fontSize}
      fontWeight="600"
      color={disabled ? ui.textMuted : ui.text}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.45 : 1}
      onPress={disabled ? undefined : onPress}
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
