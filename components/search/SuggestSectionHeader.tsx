import { Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SuggestSectionHeaderProps = {
  label: string
  actionLabel?: string
  onAction?: () => void
}

export function SuggestSectionHeader({ label, actionLabel, onAction }: SuggestSectionHeaderProps) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$3"
      paddingBottom="$1"
    >
      <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
        {label}
      </Text>
      {actionLabel && onAction ? (
        <Text
          fontSize={12}
          fontWeight="600"
          color={ui.brand}
          cursor="pointer"
          onPress={onAction}
        >
          {actionLabel}
        </Text>
      ) : null}
    </XStack>
  )
}
