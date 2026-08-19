import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerReturnHomeStrip } from '~/commerce/hooks/useBuyerReturnHomeStrip'
import type { BuyerReturnHomeCard } from '~/commerce/lib/buyer-return-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BuyerReturnHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useBuyerReturnHomeStrip()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Returns & exchanges
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Track open return requests, pickups, and refund progress without opening each order.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <BuyerReturnHomeRow key={card.issueId} card={card} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.orders} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View all orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function BuyerReturnHomeRow({ card }: { card: BuyerReturnHomeCard }) {
  const ui = useAppUi()
  const href = commerceRoutes.order(card.orderId)
  const toneColor = card.category === 'needs_action' ? ui.brand : ui.textSecondary

  return (
    <AppLink href={href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={44}
          height={44}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.imagePlaceholder}
        >
          <Icons.Package size={20} color={toneColor} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={toneColor}>
            Order {card.orderNumber}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.itemTitle}
          </Text>
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            {card.actionLabel}
          </Text>
          {card.actionDetail ? (
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
              {card.actionDetail}
            </Text>
          ) : null}
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
