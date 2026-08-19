import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useRecommendationSentRevisit } from '~/community/hooks/useRecommendationSentRevisit'
import type { RecommendationSentRevisitCard } from '~/community/lib/recommendations'
import { recommendationSentRevisitSeeAllHref } from '~/community/lib/recommendations'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'

export function RecommendationSentRevisitStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips } = useCommunityFeedHeader()
  const { cards, hasCards } = useRecommendationSentRevisit()

  if (hideSidebarRedundantStrips) return null
  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Recommendation requests you sent
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Pending asks waiting on a connection to write your recommendation.
          </Text>
        </YStack>
        <AppLink href={recommendationSentRevisitSeeAllHref()} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See network
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <RecommendationSentRevisitCardItem key={card.id} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function RecommendationSentRevisitCardItem({ card }: { card: RecommendationSentRevisitCard }) {
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
        <XStack
          alignSelf="flex-start"
          paddingHorizontal={8}
          paddingVertical={4}
          borderRadius={999}
          backgroundColor={`${communityUi.brand}14`}
        >
          <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
            Awaiting write-up
          </Text>
        </XStack>
        <XStack gap={10} alignItems="center">
          <Avatar
            name={card.requestedFromName}
            src={card.requestedFromAvatar ?? undefined}
            size="$4"
          />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13} fontWeight="700" color={communityUi.text} numberOfLines={1}>
              {card.requestedFromName}
            </Text>
            <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
              {card.message?.trim() || 'Asked to recommend you'}
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </AppLink>
  )
}
