import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useProfessionalSpotlight } from '~/community/hooks/useProfessionalSpotlight'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function ProfessionalSpotlightStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips, isAuthenticated } = useCommunityFeedHeader()
  const { cards, hasCards } = useProfessionalSpotlight()

  if (hideSidebarRedundantStrips) return null
  if (!isAuthenticated) return null
  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Open to work & services
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            People in your network sharing hiring intent or services they offer.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.jobs} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            Browse jobs
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <YStack
            key={card.userId}
            width={196}
            padding={12}
            gap={8}
            borderRadius={14}
            borderWidth={1}
            borderColor={communityUi.border}
            backgroundColor={communityUi.pageBg}
          >
            <XStack gap={10} alignItems="center">
              <ProfileLink userId={card.userId} username={card.username}>
                <Avatar name={card.fullName} src={card.avatarUrl ?? undefined} size="$4" />
              </ProfileLink>
              <YStack flex={1} minWidth={0} gap={2}>
                <ProfileLink userId={card.userId} username={card.username}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                    {card.fullName}
                  </Text>
                </ProfileLink>
                {card.headline ? (
                  <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                    {card.headline}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
            <XStack gap={6} alignItems="center">
              {card.intent === 'open_to_work' ? (
                <Icons.Briefcase size={14} color={communityUi.brand} />
              ) : (
                <Icons.Sparkles size={14} color={communityUi.brand} />
              )}
              <Text fontSize={12} fontWeight="700" color={communityUi.brand} numberOfLines={1}>
                {card.intentLabel}
              </Text>
            </XStack>
            {card.detail ? (
              <Text fontSize={11} color={communityUi.textMuted} numberOfLines={2}>
                {card.detail}
              </Text>
            ) : null}
          </YStack>
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
