import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerOrderAttentionStrip } from '~/commerce/hooks/useBuyerOrderAttentionStrip'
import type { BuyerOrderAttentionItem } from '~/commerce/lib/buyer-order-attention'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BuyerOrderAttentionStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { items, hasItems } = useBuyerOrderAttentionStrip()

  if (!hasItems) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Orders needing attention
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Returns, exchanges, reverse pickups, and courier RTO updates in one place.
        </Text>
      </YStack>

      <YStack gap="$3">
        {items.map((item) => (
          <BuyerOrderAttentionRow key={item.id} item={item} />
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

function BuyerOrderAttentionRow({ item }: { item: BuyerOrderAttentionItem }) {
  const ui = useAppUi()
  const href = commerceRoutes.order(item.orderId)
  const toneColor = item.priority <= 1 ? ui.brand : ui.textSecondary
  const Icon = item.kind === 'rto' || item.kind === 'return_shipment' ? Icons.Truck : Icons.Package

  function handleTrackPress() {
    if (item.trackingUrl) navigateApp(item.trackingUrl)
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
            <Icon size={20} color={toneColor} />
          </YStack>
          <YStack flex={1} minWidth={0} gap="$1.5">
            <Text fontSize={10} fontWeight="700" color={toneColor}>
              Order {item.orderNumber} · {kindLabel(item.kind)}
            </Text>
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
              {item.itemTitle}
            </Text>
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {item.headline}
            </Text>
            {item.detail ? (
              <Text fontSize={12} color={ui.textSecondary} numberOfLines={3}>
                {item.detail}
              </Text>
            ) : null}
          </YStack>
          <Icons.ChevronRight size={18} color={ui.textMuted} />
        </XStack>
      </AppLink>
      {item.trackingUrl ? (
        <Button tone="outline" size="$2" borderRadius={999} alignSelf="flex-start" onPress={handleTrackPress}>
          Track shipment
        </Button>
      ) : null}
    </YStack>
  )
}

function kindLabel(kind: BuyerOrderAttentionItem['kind']) {
  switch (kind) {
    case 'exchange':
      return 'Exchange'
    case 'return':
      return 'Return'
    case 'return_shipment':
      return 'Return pickup'
    case 'rto':
      return 'RTO'
    default:
      return 'Order'
  }
}
