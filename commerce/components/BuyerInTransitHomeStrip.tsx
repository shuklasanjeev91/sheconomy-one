import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerInTransitHome } from '~/commerce/hooks/useBuyerInTransitHome'
import type { BuyerInTransitHomeCard } from '~/commerce/lib/buyer-in-transit-home'
import { buyerOrdersHref } from '~/commerce/lib/buyer-in-transit-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BuyerInTransitHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useBuyerInTransitHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Orders on the way
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Shipments in progress — track delivery status and updates.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <BuyerInTransitHomeRow key={card.orderId} card={card} />
        ))}
      </YStack>

      <AppLink href={buyerOrdersHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View all orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function BuyerInTransitHomeRow({ card }: { card: BuyerInTransitHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Truck size={18} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {card.statusLabel} · #{card.orderNumber}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.shopNames}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.detail}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
