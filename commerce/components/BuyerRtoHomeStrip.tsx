import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerRtoHomeStrip } from '~/commerce/hooks/useBuyerRtoHomeStrip'
import type { BuyerRtoHomeCard } from '~/commerce/lib/buyer-rto-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { navigateApp } from '~/lib/platform/navigate'

export function BuyerRtoHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useBuyerRtoHomeStrip()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Shipment updates
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Reverse pickups and courier RTO legs that still need your attention.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <BuyerRtoHomeRow key={card.deliveryId} card={card} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.orders} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function BuyerRtoHomeRow({ card }: { card: BuyerRtoHomeCard }) {
  const ui = useAppUi()
  const href = commerceRoutes.order(card.orderId)

  function handleTrackPress() {
    if (card.trackingUrl) {
      navigateApp(card.trackingUrl)
    }
  }

  return (
    <YStack gap="$2" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
      <AppLink href={href} asChild>
        <XStack gap="$3" alignItems="flex-start">
          <YStack
            width={44}
            height={44}
            borderRadius={12}
            alignItems="center"
            justifyContent="center"
            backgroundColor={ui.imagePlaceholder}
          >
            <Icons.Truck size={20} color={card.kind === 'rto' ? ui.brand : ui.textSecondary} />
          </YStack>
          <YStack flex={1} minWidth={0} gap="$1.5">
            <Text fontSize={10} fontWeight="700" color={ui.brand}>
              Order {card.orderNumber}
            </Text>
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
              {card.itemTitle}
            </Text>
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {card.label}
            </Text>
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={3}>
              {card.detail}
            </Text>
          </YStack>
          <Icons.ChevronRight size={18} color={ui.textMuted} />
        </XStack>
      </AppLink>
      {card.trackingUrl ? (
        <Button tone="outline" size="$2" borderRadius={999} alignSelf="flex-start" onPress={handleTrackPress}>
          Track shipment
        </Button>
      ) : null}
    </YStack>
  )
}
