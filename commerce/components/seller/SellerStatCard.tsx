import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SellerStatCardProps = {
  label: string
  value: string
  hint?: string
}

export function SellerStatCard({ label, value, hint }: SellerStatCardProps) {
  const ui = useAppUi()

  return (
    <YStack
      flex={1}
      minWidth={140}
      gap="$1.5"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={12} fontWeight="600" color={ui.textMuted} letterSpacing={0.2}>
        {label}
      </Text>
      <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
        {value}
      </Text>
      {hint ? (
        <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
          {hint}
        </Text>
      ) : null}
    </YStack>
  )
}
