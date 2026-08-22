import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useProfileViewersNudge } from '~/community/hooks/useProfileViewersNudge'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

function formatViewedAt(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ProfileViewersStrip() {
  const communityUi = useCommunityUi()
  const { viewers, hasViewers } = useProfileViewersNudge()

  const hasContent = hasViewers
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Who viewed your profile
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Recent profile views from people in your professional network.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.analytics} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            Analytics
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {viewers.map((viewer) => (
          <AppLink
            key={`${viewer.viewerId}-${viewer.viewedAt}`}
            href={
              viewer.username
                ? communityRoutes.userProfile(viewer.username)
                : communityRoutes.profile
            }
            asChild
          >
            <YStack
              width={168}
              padding={12}
              gap={10}
              borderRadius={14}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.pageBg}
              cursor="pointer"
            >
              <XStack gap={10} alignItems="center">
                <Avatar name={viewer.fullName} src={viewer.avatarUrl ?? undefined} size="$4" />
                <YStack flex={1} minWidth={0} gap={2}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                    {viewer.fullName}
                  </Text>
                  {viewer.headline ? (
                    <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                      {viewer.headline}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
              <Text fontSize={11} color={communityUi.textMuted}>
                Viewed {formatViewedAt(viewer.viewedAt)}
              </Text>
            </YStack>
          </AppLink>
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
