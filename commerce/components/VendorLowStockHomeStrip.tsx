import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorLowStockHome } from '~/commerce/hooks/useVendorLowStockHome'
import type { VendorLowStockHomeCard } from '~/commerce/lib/vendor-low-stock-home'
import { vendorLowStockProductsHref } from '~/commerce/lib/vendor-low-stock-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorLowStockHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorLowStockHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Low stock alerts
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Active listings running low — restock before you miss sales.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorLowStockHomeRow key={card.listingId} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorLowStockProductsHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Manage products
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorLowStockHomeRow({ card }: { card: VendorLowStockHomeCard }) {
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
          <Icons.AlertTriangle size={18} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {card.stock <= 0 ? 'Out of stock' : `${card.stock} left`}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
