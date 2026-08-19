import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useFollowedShopActivity } from '~/community/hooks/useFollowedShopActivity'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { FollowedShopActivityCard } from '~/community/lib/followed-shop-activity'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'

export function FollowedShopActivityStrip() {
  const communityUi = useCommunityUi()
  const { cards, loading, hasCards } = useFollowedShopActivity()

  if (!loading && !hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            From shops you follow
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            New arrivals, price drops, and saved picks from sellers you already trust.
          </Text>
        </YStack>
        {loading ? <Spinner size="small" /> : null}
        {hasCards ? (
          <AppLink href={commerceRoutes.following} asChild>
            <Button tone="ghost" size="$2" borderRadius={999}>
              View all
            </Button>
          </AppLink>
        ) : null}
      </XStack>

      {hasCards ? (
        <HorizontalScrollRow gap={10}>
          {cards.map((card) => (
            <FollowedShopActivityCardItem key={card.listingId} card={card} />
          ))}
        </HorizontalScrollRow>
      ) : null}
    </CommunityCard>
  )
}

function FollowedShopActivityCardItem({ card }: { card: FollowedShopActivityCard }) {
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
            <Icons.Store size={22} color={communityUi.textMuted} />
          )}
        </YStack>

        <YStack gap={6} flex={1}>
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
          {card.subtitle ? (
            <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
              {card.subtitle}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppLink>
  )
}
