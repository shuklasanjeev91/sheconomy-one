import { useRouter } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { useStoryRings } from '~/community/hooks/useStories'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

export function StoriesScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { profile, isAuthenticated } = useProfile()
  const { rings, isLoading } = useStoryRings()

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Stories"
          subtitle="Short updates from people in your network — visible for 24 hours."
          actions={
            isAuthenticated ? (
              <Button
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                icon={<Icons.Plus size={16} color="white" />}
                onPress={() => router.push(communityRoutes.storyCreate)}
              >
                Add story
              </Button>
            ) : undefined
          }
        />
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : rings.length === 0 ? (
        <CommunityCard padding={24} gap={12}>
          <Text color={communityUi.textMuted} lineHeight={22}>
            No active stories right now. When your network posts stories, they will appear here.
          </Text>
          {isAuthenticated ? (
            <Button
              alignSelf="flex-start"
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              onPress={() => router.push(communityRoutes.storyCreate)}
            >
              Share your story
            </Button>
          ) : null}
        </CommunityCard>
      ) : (
        <CommunityCard padding={12} gap={8}>
          {rings.map((ring) => (
            <AppLink key={ring.user_id} href={communityRoutes.storyUser(ring.user_id)} asChild>
              <XStack
                gap={12}
                alignItems="center"
                paddingVertical={10}
                paddingHorizontal={10}
                borderRadius={10}
                cursor="pointer"
                hoverStyle={{ backgroundColor: communityUi.divider }}
              >
                <Avatar name={ring.full_name} src={ring.avatar_url ?? undefined} size="$4" />
                <YStack flex={1} gap={2}>
                  <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                    {ring.full_name}
                  </Text>
                  <Text fontSize={13} color={communityUi.textMuted}>
                    {ring.story_count} {ring.story_count === 1 ? 'story' : 'stories'}
                    {ring.has_unseen ? ' · New' : ''}
                  </Text>
                </YStack>
                <Icons.ChevronRight size={18} color={communityUi.textMuted} />
              </XStack>
            </AppLink>
          ))}
        </CommunityCard>
      )}

      {isAuthenticated && profile?.id && rings.some((ring) => ring.user_id === profile.id) ? (
        <CommunityCard padding={16}>
          <AppLink href={communityRoutes.storyUser(profile.id)} asChild>
            <Button backgroundColor={communityUi.divider} color={communityUi.text} borderRadius={999}>
              View your story
            </Button>
          </AppLink>
        </CommunityCard>
      ) : null}
    </CommunityShell>
  )
}
