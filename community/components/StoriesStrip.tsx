import { Link } from 'one'
import { Platform, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { useStoryRings } from '~/community/hooks/useStories'
import { BRAND_BLUE } from '~/community/lib/constants'
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
                  <StoryRingAvatar
                    name={ring.full_name}
                    src={ring.avatar_url}
                    hasUnseen={ring.has_unseen}
                    cardBg={communityUi.cardBg}
                    borderColor={communityUi.border}
                  />
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

const STORY_RING_COLORS = ['#f58529', '#dd2a7b', '#8134af'] as const

function StoryRingAvatar({
  name,
  src,
  hasUnseen,
  cardBg,
  borderColor,
}: {
  name: string
  src?: string | null
  hasUnseen: boolean
  cardBg: string
  borderColor: string
}) {
  const inner = (
    <YStack padding={2} borderRadius={999} backgroundColor={cardBg}>
      <Avatar name={name} src={src ?? undefined} size="$5" />
    </YStack>
  )

  if (!hasUnseen) {
    return (
      <YStack padding={2} borderRadius={999} backgroundColor={borderColor}>
        {inner}
      </YStack>
    )
  }

  if (Platform.OS === 'web') {
    return (
      <YStack
        padding={2}
        borderRadius={999}
        style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
      >
        {inner}
      </YStack>
    )
  }

  return (
    <LinearGradient
      colors={[...STORY_RING_COLORS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 999, padding: 2 }}
    >
      {inner}
    </LinearGradient>
  )
}