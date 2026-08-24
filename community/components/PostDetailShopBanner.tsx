import { AppLink } from '~/components/navigation/AppLink'
import type { CommunityPost } from '~/community/lib/community'
import { trackCommunityCommerceShare } from '~/community/lib/community-commerce-analytics'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ShareButton } from '~/components/share/ShareButton'
import { BRAND_NAME } from '~/config/brand'
import { communityRoutes } from '~/lib/routes'
import { getProfileShopShareUrl } from '~/lib/share/urls'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'

/** Banner on post detail linking to the author's shoppable profile shop. */
export function PostDetailShopBanner({ post }: { post: CommunityPost }) {
  const communityUi = useCommunityUi()
  const products = post.products ?? []
  const handle = post.author?.username
  if (!products.length || !handle) return null

  const authorName = post.author?.full_name || handle
  const profileShopHref = communityRoutes.profileShop(handle)

  return (
    <YStack
      gap={10}
      padding={14}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.accentMuted}
    >
      <XStack alignItems="center" justifyContent="space-between" gap={12} flexWrap="wrap">
        <XStack alignItems="center" gap={10} flex={1} minWidth={0}>
          <Icons.ShoppingBag size={20} color={communityUi.brand} />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={15} fontWeight="700" color={communityUi.text}>
              {`Shop from ${authorName}'s posts`}
            </Text>
            <Text fontSize={13} color={communityUi.textMuted}>
              {products.length} product{products.length === 1 ? '' : 's'} in this post
              {products.length > 1 ? ', plus more in their shop feed' : ''}.
            </Text>
          </YStack>
        </XStack>
        <XStack gap={8} flexWrap="wrap">
          <ShareButton
            variant="ghost"
            size="$2"
            label="Share shop"
            sheetTitle="Share shop from posts"
            copyLabel="Copy shop link"
            copyToastMessage="Shop link copied."
            onOpen={() =>
              trackCommunityCommerceShare({ surface: 'post_detail', postId: post.id })
            }
            payload={{
              url: getProfileShopShareUrl(handle),
              title: `Shop from ${authorName} on ${BRAND_NAME}`,
              text: `Browse products ${authorName} has shared in community posts.`,
            }}
          />
          <AppLink href={profileShopHref} asChild>
            <Button tone="primary" size="$2" borderRadius={999} icon={<Icons.ArrowRight size={14} color="white" />}>
              Open shop
            </Button>
          </AppLink>
        </XStack>
      </XStack>
    </YStack>
  )
}
