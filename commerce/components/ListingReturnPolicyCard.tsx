import { Icons, Text, XStack, YStack } from '~/components/ui'
import type { ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

export function ListingReturnPolicyCard({ policy }: { policy: ListingReturnPolicy }) {
  const ui = useAppUi()

  const points = [
    policy.acceptsReturns
      ? policy.returnWindowDays
        ? `Returns accepted within ${policy.returnWindowDays} days`
        : 'Returns accepted'
      : 'Returns not accepted',
    policy.acceptsExchanges ? 'Exchanges accepted' : null,
    policy.acceptsRefunds ? 'Refunds available' : null,
    policy.returnShippingPaidBy
      ? `Return shipping paid by ${policy.returnShippingPaidBy}`
      : null,
  ].filter(Boolean) as string[]

  return (
    <YStack
      gap="$2.5"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      width="100%"
    >
      <XStack alignItems="center" gap="$2">
        <Icons.RotateCcw size={15} color={ui.brand} />
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {policy.policyName}
        </Text>
      </XStack>
      {points.map((point) => (
        <XStack key={point} gap="$2" alignItems="flex-start">
          <Icons.Check size={13} color={ui.success} style={{ marginTop: 2 }} />
          <Text fontSize={12.5} color={ui.textSecondary} flex={1}>
            {point}
          </Text>
        </XStack>
      ))}
      {policy.conditionDescription ? (
        <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
          {policy.conditionDescription}
        </Text>
      ) : null}
      {policy.policyDetails ? (
        <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
          {policy.policyDetails}
        </Text>
      ) : null}
    </YStack>
  )
}
