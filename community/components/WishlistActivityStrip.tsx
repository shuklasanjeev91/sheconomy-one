import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useWishlistActivity } from '~/community/hooks/useWishlistActivity'
import type { WishlistActivityCard } from '~/community/lib/wishlist-activity'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'

export function WishlistActivityStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useWishlistActivity()

  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            From your wishlist
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Saved picks, cart holdovers, and price wins worth another look.
          </Text>
        </YStack>
        <AppLink href={commerceRoutes.favorites} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            View all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <WishlistActivityCardItem key={card.listingId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function WishlistActivityCardItem({ card }: { card: WishlistActivityCard }) {
  const communityUi = useCommunityUi()

  return (
    <AppLink href={card.href} asChild>
      <YStack
        width={196}
        padding={12}
        gap={10}
        borderRadius={14}
        borderWidth={1}
        borderColor={communityUi.border}
        backgroundColor={communityUi.pageBg}
        cursor="pointer"
        hoverStyle={{ borderColor: communityUi.brand, opacity: 0.96 }}
        pressStyle={{ opacity: 0.9, scale: 0.98 }}
      >
        <YStack
          width="100%"
          height={96}
          borderRadius={10}
          overflow="hidden"
          backgroundColor={communityUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} width="100%" height={96} objectFit="cover" />
          ) : (
            <Icons.Heart size={22} color={communityUi.textMuted} />
          )}
        </YStack>
        <YStack gap={6}>
          <XStack
            alignSelf="flex-start"
            paddingHorizontal={8}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={`${communityUi.brand}14`}
          >
            <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
              {card.sourceLabel}
            </Text>
          </XStack>
          <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
            {card.title}
          </Text>
          <XStack gap={6} alignItems="center" flexWrap="wrap">
            <Text fontSize={12} fontWeight="700" color={communityUi.text}>
              {card.priceLabel}
            </Text>
            {card.previousPriceLabel ? (
              <Text fontSize={11} color={communityUi.textMuted} textDecorationLine="line-through">
                {card.previousPriceLabel}
              </Text>
            ) : null}
          </XStack>
        </YStack>
      </YStack>
    </AppLink>
  )
}
