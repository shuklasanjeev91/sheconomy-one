import { Text, XStack, YStack } from '~/components/ui'
import type { CustomerTimelineEvent } from '~/commerce/lib/customer-order-lifecycle'
import { formatOrderDate } from '~/lib/orders/order.utils'
import { useAppUi } from '~/lib/theme/useAppUi'

type OrderTimelineProps = {
  events: CustomerTimelineEvent[]
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  const ui = useAppUi()

  if (!events.length) {
    return (
      <Text fontSize={13} color={ui.textMuted}>
        Tracking updates will appear here once your order is confirmed.
      </Text>
    )
  }

  return (
    <YStack gap="$0" width="100%">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        return (
          <XStack key={event.id} gap="$3" alignItems="stretch">
            <YStack alignItems="center" width={18}>
              <YStack
                width={12}
                height={12}
                borderRadius={999}
                marginTop={4}
                backgroundColor={event.isCurrent ? ui.brand : ui.borderSubtle}
                borderWidth={event.isCurrent ? 0 : 2}
                borderColor={ui.borderSubtle}
              />
              {!isLast ? (
                <YStack flex={1} width={2} backgroundColor={ui.borderSubtle} minHeight={28} />
              ) : null}
            </YStack>
            <YStack flex={1} gap={2} paddingBottom={isLast ? 0 : '$3'}>
              <XStack justifyContent="space-between" gap="$2" alignItems="flex-start">
                <Text
                  fontSize={14}
                  fontWeight={event.isCurrent ? '800' : '700'}
                  color={ui.text}
                  flex={1}
                >
                  {event.label}
                </Text>
                {event.at ? (
                  <Text fontSize={11} color={ui.textMuted}>
                    {formatOrderDate(event.at, true)}
                  </Text>
                ) : null}
              </XStack>
              <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
                {event.description}
              </Text>
            </YStack>
          </XStack>
        )
      })}
    </YStack>
  )
}
