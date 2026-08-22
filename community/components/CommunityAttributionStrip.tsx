import { AppLink } from '~/components/navigation/AppLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function CommunityAttributionStrip({ postId }: { postId: string }) {
  const communityUi = useCommunityUi()

  return (
    <XStack
      alignItems="center"
      gap={8}
      paddingHorizontal={12}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
      alignSelf="flex-start"
    >
      <Icons.Users size={14} color={communityUi.brand} />
      <YStack gap={0} flexShrink={1}>
        <Text fontSize={12} fontWeight="700" color={communityUi.text}>
          Opened from Community
        </Text>
        <AppLink href={communityRoutes.post(postId)}>
          <Text fontSize={12} color={communityUi.brand} fontWeight="600">
            View original post
          </Text>
        </AppLink>
      </YStack>
    </XStack>
  )
}
