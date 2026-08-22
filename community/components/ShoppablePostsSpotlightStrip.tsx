import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  fetchShoppableSpotlightCards,
  type ShoppableSpotlightCard,
} from '~/community/lib/shoppable-post-spotlight'
import { ShareButton } from '~/components/share/ShareButton'
import { BRAND_NAME } from '~/config/brand'
import { communityRoutes } from '~/lib/routes'
import { getShoppableFeedShareUrl } from '~/lib/share/urls'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'

export function ShoppablePostsSpotlightStrip() {
  const communityUi = useCommunityUi()
  const [cards, setCards] = useState<ShoppableSpotlightCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchShoppableSpotlightCards(8).then((rows) => {
      if (cancelled) return
      setCards(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const hasContent = loading || cards.length > 0
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Shoppable posts
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Fresh picks from the community with products you can shop right away.
          </Text>
        </YStack>
        {loading ? <Spinner size="small" /> : null}
        <XStack gap={6} alignItems="center">
          <ShareButton
            variant="icon"
            label="Share shoppable feed"
            sheetTitle="Share shoppable feed"
            copyLabel="Copy shoppable feed link"
            copyToastMessage="Shoppable feed link copied."
            payload={{
              url: getShoppableFeedShareUrl(),
              title: `Shoppable posts on ${BRAND_NAME}`,
              text: 'Browse community posts with products attached.',
            }}
          />
          <AppLink href={`${communityRoutes.home}?shoppable=1`} asChild>
            <Button tone="ghost" size="$2" borderRadius={999}>
              View all
            </Button>
          </AppLink>
        </XStack>
      </XStack>

      {cards.length ? (
        <HorizontalScrollRow gap={10}>
          {cards.map((card) => (
            <ShoppableSpotlightCardItem key={card.postId} card={card} />
          ))}
        </HorizontalScrollRow>
      ) : null}
    </CommunityCard>
  )
}

function ShoppableSpotlightCardItem({ card }: { card: ShoppableSpotlightCard }) {
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
          {card.previewImageUrl ? (
            <Image src={card.previewImageUrl} width="100%" height={96} objectFit="cover" />
          ) : (
            <Icons.ShoppingBag size={22} color={communityUi.textMuted} />
          )}
        </YStack>
        <XStack gap={8} alignItems="center">
          <Avatar name={card.authorName} src={card.authorAvatar ?? undefined} size="$2" />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13} fontWeight="700" color={communityUi.text} numberOfLines={1}>
              {card.authorName}
            </Text>
            <Text fontSize={11} color={communityUi.textMuted} numberOfLines={1}>
              {card.productCount} product{card.productCount === 1 ? '' : 's'}
              {card.previewTitle ? ` · ${card.previewTitle}` : ''}
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </AppLink>
  )
}
