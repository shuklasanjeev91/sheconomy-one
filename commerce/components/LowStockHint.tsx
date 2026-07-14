import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type LowStockHintProps = {
  stock: number | null | undefined
  /** Show when units remaining are at or below this threshold. */
  threshold?: number
}

/** Scarcity cue when inventory is running low (marketplace urgency). */
export function LowStockHint({ stock, threshold = 5 }: LowStockHintProps) {
  const ui = useAppUi()
  if (stock == null || stock <= 0 || stock > threshold) return null

  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical={6}
      borderRadius={8}
      backgroundColor={ui.badgeAccentBg}
      alignSelf="flex-start"
    >
      <Icons.AlertTriangle size={14} color={ui.badgeAccentText} />
      <Text fontSize={12} fontWeight="700" color={ui.badgeAccentText}>
        {stock === 1 ? 'Only 1 left' : `Only ${stock} left`}
      </Text>
    </XStack>
  )
}
