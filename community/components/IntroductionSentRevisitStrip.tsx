import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useIntroductionSentRevisit } from '~/community/hooks/useIntroductionSentRevisit'
import type { IntroductionSentRevisitCard } from '~/community/lib/introductions'
import { introductionSentRevisitSeeAllHref } from '~/community/lib/introductions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'

export function IntroductionSentRevisitStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips } = useCommunityFeedHeader()
  const { cards, hasCards } = useIntroductionSentRevisit()

  if (hideSidebarRedundantStrips) return null
  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Introduction requests you sent
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Pending asks waiting on a mutual connection to make the intro.
          </Text>
        </YStack>
        <AppLink href={introductionSentRevisitSeeAllHref()} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See network
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <IntroductionSentRevisitCardItem key={card.id} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function IntroductionSentRevisitCardItem({ card }: { card: IntroductionSentRevisitCard }) {
  const communityUi = useCommunityUi()

  return (
    <YStack
      width={220}
      padding={12}
      gap={10}
      borderRadius={14}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
    >
      <XStack
        alignSelf="flex-start"
        paddingHorizontal={8}
        paddingVertical={4}
        borderRadius={999}
        backgroundColor={`${communityUi.brand}14`}
      >
        <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
          Awaiting intro
        </Text>
      </XStack>
      <XStack gap={10} alignItems="center">
        <Avatar name={card.introducerName} src={card.introducerAvatar ?? undefined} size="$4" />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={13} fontWeight="700" color={communityUi.text} numberOfLines={1}>
            Via {card.introducerName}
          </Text>
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
            Intro to {card.targetName}
          </Text>
        </YStack>
      </XStack>
      {card.message ? (
        <Text fontSize={12} color={communityUi.textMuted} numberOfLines={3}>
          “{card.message}”
        </Text>
      ) : null}
    </YStack>
  )
}
