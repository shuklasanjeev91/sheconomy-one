import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorFulfillmentHome } from '~/commerce/hooks/useVendorFulfillmentHome'
import type { VendorFulfillmentHomeCard } from '~/commerce/lib/vendor-fulfillment-home'
import { vendorFulfillmentHomeHref } from '~/commerce/lib/vendor-fulfillment-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function severityColor(ui: ReturnType<typeof useAppUi>, severity: VendorFulfillmentHomeCard['severity']) {
  switch (severity) {
    case 'critical':
      return ui.danger
    case 'high':
      return ui.notification
    case 'medium':
      return ui.brand
    case 'low':
    default:
      return ui.textSecondary
  }
}

export function VendorFulfillmentHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorFulfillmentHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Fulfilment backlog
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Orders waiting to be picked, packed, or shipped from your shop.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorFulfillmentHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorFulfillmentHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open fulfilments
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorFulfillmentHomeRow({ card }: { card: VendorFulfillmentHomeCard }) {
  const ui = useAppUi()
  const accent = severityColor(ui, card.severity)

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
          <Icons.Package size={18} color={accent} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={accent}>
            {card.badge}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
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
