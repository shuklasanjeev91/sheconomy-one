import { PostContentText } from '~/community/components/PostContentText'
import type { CommunityPost } from '~/community/lib/community'
import { collectPostMedia } from '~/community/lib/post-media'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_MEMBER_LABEL } from '~/config/brand'

type RepostPreviewCardProps = {
  post: CommunityPost
}

/** Compact original-post card shown inside remost composers / menus. */
export function RepostPreviewCard({ post }: RepostPreviewCardProps) {
  const ui = useAppUi()
  const authorName =
    post.company?.name ??
    post.group?.title ??
    post.author?.full_name ??
    post.author?.username ??
    BRAND_MEMBER_LABEL
  const avatarSrc =
    post.company?.logo_url ?? post.group?.avatar_url ?? post.author?.avatar_url ?? undefined
  const headline = post.author?.headline
  const thumb = collectPostMedia(post)[0]?.url ?? null

  return (
    <YStack
      padding="$3"
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      gap="$2"
    >
      <XStack gap="$3" alignItems="flex-start">
        <Avatar name={authorName} src={avatarSrc} size="$3" />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
            {authorName}
          </Text>
          {headline ? (
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {headline}
            </Text>
          ) : null}
        </YStack>
        {thumb ? (
          <Image src={thumb} width={56} height={56} borderRadius={8} objectFit="cover" alt="" />
        ) : null}
      </XStack>
      {post.content?.trim() ? (
        <PostContentText content={post.content} collapsible={false} fontSize={14} lineHeight={20} />
      ) : null}
    </YStack>
  )
}
