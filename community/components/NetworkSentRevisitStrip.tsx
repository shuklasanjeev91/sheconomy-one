import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useNetworkSentRevisit } from '~/community/hooks/useNetworkSentRevisit'
import type { NetworkSentRevisitCard } from '~/community/lib/network-sent-revisit'
import { networkSentRevisitSeeAllHref } from '~/community/lib/network-sent-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'

export function NetworkSentRevisitStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips, isAuthenticated } = useCommunityFeedHeader()
  const { cards, hasCards } = useNetworkSentRevisit()

  const hasContent = !hideSidebarRedundantStrips && isAuthenticated && hasCards
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Pending connection requests
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Invites you sent that are still waiting for a response.
          </Text>
        </YStack>
        <AppLink href={networkSentRevisitSeeAllHref()} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <NetworkSentRevisitCardItem key={card.userId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function NetworkSentRevisitCardItem({ card }: { card: NetworkSentRevisitCard }) {
  const communityUi = useCommunityUi()

  return (
    <AppLink href={card.href} asChild>
      <YStack
        width={160}
        padding={12}
        gap={10}
        borderRadius={14}
        borderWidth={1}
        borderColor={communityUi.border}
        backgroundColor={communityUi.pageBg}
        cursor="pointer"
        hoverStyle={{ borderColor: communityUi.brand, opacity: 0.96 }}
        pressStyle={{ opacity: 0.9, scale: 0.98 }}
        alignItems="center"
      >
        <Avatar name={card.fullName} src={card.avatarUrl} size={52} />
        <YStack gap={4} alignItems="center" width="100%">
          <XStack
            paddingHorizontal={8}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={`${communityUi.brand}14`}
          >
            <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
              Awaiting reply
            </Text>
          </XStack>
          <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2} textAlign="center">
            {card.fullName}
          </Text>
          {card.headline ? (
            <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2} textAlign="center">
              {card.headline}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppLink>
  )
}
