import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorSaleEventsHome } from '~/commerce/hooks/useVendorSaleEventsHome'
import type { VendorSaleEventHomeCard } from '~/commerce/lib/vendor-sale-events-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorSaleEventsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorSaleEventsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Sale events for your shop
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Open registrations and enrollments that need your attention.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorSaleEventHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorRoutes.ads} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Manage discounts
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorSaleEventHomeRow({ card }: { card: VendorSaleEventHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={72}
          height={72}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} width={72} height={72} objectFit="cover" />
          ) : (
            <Icons.Sparkles size={22} color={ui.brand} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
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
