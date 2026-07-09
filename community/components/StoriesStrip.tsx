import { Link } from 'one'
import { ScrollView } from 'react-native'

import { useStoryRings } from '~/community/hooks/useStories'
import { INSTAGRAM_GRADIENT, BRAND_BLUE } from '~/community/lib/constants'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

export function StoriesStrip() {
  const communityUi = useCommunityUi()
  const { profile, isAuthenticated } = useProfile()
  const { rings, isLoading } = useStoryRings()
  const displayName = profile?.full_name || profile?.username || 'You'
  const ownRing = rings.find((ring) => ring.user_id === profile?.id)
  const otherRings = rings.filter((ring) => ring.user_id !== profile?.id)

  if (!isAuthenticated && otherRings.length === 0) return null

  return (
    <YStack
      width="100%"
      backgroundColor={communityUi.cardBg}
      borderRadius={10}
      borderWidth={1}
      borderColor={communityUi.border}
      paddingVertical="$3"
    >
      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$2">
          <Spinner size="small" color={communityUi.brand} />
        </YStack>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$3" paddingHorizontal="$3">
            {isAuthenticated ? (
              <Link
                href={ownRing ? communityRoutes.storyUser(profile!.id) : communityRoutes.storyCreate}
                asChild
              >
                <YStack width={72} alignItems="center" gap={6} cursor="pointer">
                  <YStack position="relative">
                    <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$5" />
                    <YStack
                      position="absolute"
                      bottom={-2}
                      right={-2}
                      width={22}
                      height={22}
                      borderRadius={999}
                      backgroundColor={BRAND_BLUE}
                      borderWidth={2}
                      borderColor={communityUi.cardBg}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icons.Plus size={12} color="white" />
                    </YStack>
                  </YStack>
                  <Text fontSize={11} fontWeight="500" color={communityUi.text} textAlign="center" numberOfLines={1}>
                    {ownRing ? 'Your story' : 'Add story'}
                  </Text>
                </YStack>
              </Link>
            ) : null}

            {otherRings.map((ring) => (
              <Link key={ring.user_id} href={communityRoutes.storyUser(ring.user_id)} asChild>
                <YStack width={72} alignItems="center" gap={6} cursor="pointer">
                  <YStack
                    padding={2}
                    borderRadius={999}
                    style={{
                      background: ring.has_unseen ? INSTAGRAM_GRADIENT : communityUi.border,
                    }}
                  >
                    <YStack padding={2} borderRadius={999} backgroundColor={communityUi.cardBg}>
                      <Avatar name={ring.full_name} src={ring.avatar_url ?? undefined} size="$5" />
                    </YStack>
                  </YStack>
                  <Text fontSize={11} fontWeight="500" color={communityUi.text} textAlign="center" numberOfLines={1} width={68}>
                    {ring.full_name.split(' ')[0]}
                  </Text>
                </YStack>
              </Link>
            ))}
          </XStack>
        </ScrollView>
      )}
    </YStack>
  )
}