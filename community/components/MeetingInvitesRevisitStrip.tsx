import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useMeetingInvitesRevisit } from '~/community/hooks/useMeetingInvitesRevisit'
import type { MeetingInviteRevisitCard } from '~/co-work/lib/meeting-invites-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { coWorkRoutes } from '~/lib/routes'

export function MeetingInvitesRevisitStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useMeetingInvitesRevisit()

  const hasContent = hasCards
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Co-work meeting invites
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Sessions you were invited to and have not joined yet.
          </Text>
        </YStack>
        <AppLink href={coWorkRoutes.meetings} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <MeetingInviteRevisitCardItem key={card.meetingId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function MeetingInviteRevisitCardItem({ card }: { card: MeetingInviteRevisitCard }) {
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
          height={72}
          borderRadius={10}
          backgroundColor={communityUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Mail size={22} color={card.isLive ? communityUi.brand : communityUi.textMuted} />
        </YStack>
        <YStack gap={6}>
          <XStack
            alignSelf="flex-start"
            paddingHorizontal={8}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={card.isLive ? `${communityUi.brand}22` : `${communityUi.brand}14`}
          >
            <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
              {card.isLive ? 'Live now' : 'Invite pending'}
            </Text>
          </XStack>
          <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
            {card.whenLabel}
          </Text>
          {card.hostName ? (
            <Text fontSize={11} color={communityUi.textMuted} numberOfLines={1}>
              From · {card.hostName}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppLink>
  )
}
