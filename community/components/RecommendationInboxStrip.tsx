import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useRecommendationInbox } from '~/community/hooks/useRecommendationInbox'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'

export function RecommendationInboxStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips } = useCommunityFeedHeader()
  const { items, hasItems } = useRecommendationInbox()

  const hasContent = !hideSidebarRedundantStrips && hasItems
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <YStack gap={2}>
        <Text fontSize={16} fontWeight="700" color={communityUi.text}>
          Recommendation requests
        </Text>
        <Text fontSize={13} color={communityUi.textMuted}>
          Connections asked you to write a recommendation for their profile.
        </Text>
      </YStack>

      <YStack gap={12}>
        {items.map((request) => (
          <YStack
            key={request.id}
            gap={10}
            padding={12}
            borderRadius={14}
            borderWidth={1}
            borderColor={communityUi.border}
          >
            <XStack gap={10} alignItems="center">
              <ProfileLink userId={request.requesterId} username={request.requesterUsername}>
                <Avatar
                  name={request.requesterName}
                  src={request.requesterAvatar ?? undefined}
                  size="$4"
                />
              </ProfileLink>
              <YStack flex={1} minWidth={0} gap={2}>
                <ProfileLink userId={request.requesterId} username={request.requesterUsername}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                    {request.requesterName}
                  </Text>
                </ProfileLink>
                {request.message ? (
                  <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                    {request.message}
                  </Text>
                ) : (
                  <Text fontSize={12} color={communityUi.textMuted}>
                    Asked you to recommend them
                  </Text>
                )}
              </YStack>
            </XStack>
            <ProfileLink userId={request.requesterId} username={request.requesterUsername}>
              <Button tone="primary" size="$2" borderRadius={999} alignSelf="flex-start">
                Write recommendation
              </Button>
            </ProfileLink>
          </YStack>
        ))}
      </YStack>
    </CommunityCard>
  )
}
