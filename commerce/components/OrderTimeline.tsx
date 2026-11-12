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

  const chronological = [...events]
  const currentIndex = Math.max(
    0,
    chronological.findIndex((event) => event.isCurrent),
  )
  const seen = new Set<string>()
  const stripEvents = chronological
    .filter((event) => {
      if (seen.has(event.label)) return false
      seen.add(event.label)
      return true
    })
    .slice(0, 5)

  const displayEvents = [...events].reverse()

  return (
    <YStack gap="$4" width="100%">
      {stripEvents.length > 1 ? (
        <XStack width="100%" alignItems="flex-start" justifyContent="space-between" gap="$1">
          {stripEvents.map((event, index) => {
            const active = event.isCurrent || chronological.indexOf(event) <= currentIndex
            const isCurrent = event.isCurrent
            return (
              <YStack key={`${event.id}-strip`} flex={1} alignItems="center" gap="$1.5" minWidth={0}>
                <XStack width="100%" alignItems="center">
                  {index > 0 ? (
                    <YStack
                      flex={1}
                      height={2}
                      backgroundColor={active ? ui.brand : ui.borderSubtle}
                    />
                  ) : (
                    <YStack flex={1} />
                  )}
                  <YStack
                    width={isCurrent ? 14 : 10}
                    height={isCurrent ? 14 : 10}
                    borderRadius={999}
                    backgroundColor={active ? ui.brand : ui.surface}
                    borderWidth={2}
                    borderColor={active ? ui.brand : ui.borderSubtle}
                  />
                  {index < stripEvents.length - 1 ? (
                    <YStack
                      flex={1}
                      height={2}
                      backgroundColor={
                        chronological.indexOf(event) < currentIndex ? ui.brand : ui.borderSubtle
                      }
                    />
                  ) : (
                    <YStack flex={1} />
                  )}
                </XStack>
                <Text
                  fontSize={10}
                  fontWeight={isCurrent ? '800' : '600'}
                  color={isCurrent ? ui.brand : active ? ui.text : ui.textMuted}
                  textAlign="center"
                  numberOfLines={2}
                >
                  {event.label}
                </Text>
              </YStack>
            )
          })}
        </XStack>
      ) : null}

      <YStack gap="$0" width="100%">
        {displayEvents.map((event, index) => {
          const isLast = index === displayEvents.length - 1
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
              <YStack
                flex={1}
                gap={2}
                paddingBottom={isLast ? 0 : '$3'}
                minWidth={0}
                padding="$2.5"
                borderRadius={12}
                backgroundColor={event.isCurrent ? ui.chip : 'transparent'}
              >
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
                    <Text fontSize={11} color={ui.textMuted} flexShrink={0}>
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
    </YStack>
  )
}
