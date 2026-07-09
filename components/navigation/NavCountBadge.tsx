import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type NavCountBadgeProps = {
  count: number
  size?: 'sm' | 'md'
  borderColor?: string
}

/** Numeric pill for cart / notification counts on nav icons. */
export function NavCountBadge({
  count,
  size = 'md',
  borderColor,
}: NavCountBadgeProps) {
  const ui = useAppUi()

  if (count <= 0) {
    return null
  }

  const compact = size === 'sm'

  return (
    <YStack
      position="absolute"
      top={compact ? -5 : -6}
      right={compact ? -8 : -10}
      minWidth={compact ? 16 : 18}
      height={compact ? 16 : 18}
      borderRadius={999}
      backgroundColor={ui.brand}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={compact ? 3 : 4}
      borderWidth={2}
      borderColor={borderColor ?? ui.surface}
      zIndex={1}
      pointerEvents="none"
    >
      <Text
        fontSize={compact ? 9 : 11}
        fontWeight="700"
        color={ui.onBrand}
        lineHeight={compact ? 11 : 14}
      >
        {count > 9 ? '9+' : count}
      </Text>
    </YStack>
  )
}