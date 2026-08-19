import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorPausedListingsHome } from '~/commerce/hooks/useVendorPausedListingsHome'
import type { VendorPausedListingHomeCard } from '~/commerce/lib/vendor-paused-listings-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorPausedListingsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorPausedListingsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Paused listings
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Listings you paused — reactivate them when you are ready to sell again.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorPausedListingHomeRow key={card.listingId} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorRoutes.products} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Manage products
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorPausedListingHomeRow({ card }: { card: VendorPausedListingHomeCard }) {
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
            <Icons.Pause size={22} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            Paused
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
