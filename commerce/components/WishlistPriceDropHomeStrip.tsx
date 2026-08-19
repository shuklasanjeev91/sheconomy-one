import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useWishlistPriceDropHome } from '~/commerce/hooks/useWishlistPriceDropHome'
import type { WishlistPriceDropCard } from '~/commerce/lib/wishlist-price-drops-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function WishlistPriceDropHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useWishlistPriceDropHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Price drops on your wishlist
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Saved items that are now cheaper than when you bookmarked them.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <WishlistPriceDropRow key={card.listingId} card={card} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.favorites} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View wishlist
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function WishlistPriceDropRow({ card }: { card: WishlistPriceDropCard }) {
  const ui = useAppUi()
  const href = commerceRoutes.listing(card.slug ?? card.listingId)

  return (
    <AppLink href={href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            Save ₹{card.discountAmount.toLocaleString('en-IN')}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            Now ₹{card.price.toLocaleString('en-IN')}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
