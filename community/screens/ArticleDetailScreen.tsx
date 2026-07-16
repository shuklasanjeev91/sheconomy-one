import { useParams } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchPostById, type CommunityPost } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { ProfileLink } from '~/community/components/ProfileLink'
import { PostContentText } from '~/community/components/PostContentText'
import { collectPostMedia } from '~/community/lib/post-media'
import { PostMediaCarousel } from '~/community/components/PostMediaCarousel'

/**
 * LinkedIn-style article reader — full-width headline + body with engagement below.
 */
export function ArticleDetailScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    fetchPostById(id).then((result) => {
      if (result.ok) {
        setPost(result.data)
        setError(null)
      } else {
        setPost(null)
        setError(result.error)
      }
      setIsLoading(false)
    })
  }, [id])

  if (isLoading) {
    return (
      <CommunityShell>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!post || (post.post_type !== 'article' && !post.article_title)) {
    return (
      <CommunityShell>
        <CommunityCard padding={24} gap={12}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Article unavailable
          </Text>
          <Text color={communityUi.textMuted}>{error ?? 'This article may have been removed.'}</Text>
          <AppLink href={communityRoutes.home} asChild>
            <Button
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              alignSelf="flex-start"
            >
              Open feed
            </Button>
          </AppLink>
        </CommunityCard>
      </CommunityShell>
    )
  }

  const media = collectPostMedia(post)
  const cover = media[0]?.kind === 'image' ? media[0].url : post.image_url
  const authorName = post.author?.full_name || post.author?.username || 'Member'

  return (
    <CommunityShell>
      <YStack gap="$4" width="100%" maxWidth={760} alignSelf="center">
        <AppLink href={communityRoutes.home}>
          <XStack alignItems="center" gap={8} cursor="pointer" hoverStyle={{ opacity: 0.85 }}>
            <Icons.ArrowLeft size={18} color={communityUi.textMuted} />
            <Text fontSize={14} fontWeight="600" color={communityUi.textMuted}>
              Back to feed
            </Text>
          </XStack>
        </AppLink>

        <CommunityCard padding={0} overflow="hidden">
          {cover ? (
            <Image src={cover} width="100%" height={280} objectFit="cover" alt="" />
          ) : null}

          <YStack padding={24} gap={16}>
            <XStack gap={8} alignItems="center">
              <Icons.Newspaper size={16} color={communityUi.brand} />
              <Text
                fontSize={12}
                fontWeight="700"
                color={communityUi.brand}
                textTransform="uppercase"
                letterSpacing={0.4}
              >
                Article
              </Text>
            </XStack>

            <Text
              fontSize={32}
              fontWeight="800"
              color={communityUi.text}
              letterSpacing={-0.6}
              lineHeight={40}
            >
              {post.article_title || 'Untitled article'}
            </Text>

            {post.article_tags?.length ? (
              <XStack gap={8} flexWrap="wrap">
                {post.article_tags.map((tag) => (
                  <XStack
                    key={tag}
                    paddingHorizontal={10}
                    paddingVertical={5}
                    borderRadius={999}
                    backgroundColor={communityUi.accentMuted}
                  >
                    <Text fontSize={12} fontWeight="600" color={communityUi.brand}>
                      {tag}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            ) : null}

            <XStack gap={12} alignItems="center">
              <ProfileLink username={post.author?.username} userId={post.user_id}>
                <Avatar name={authorName} src={post.author?.avatar_url ?? undefined} size="$4" />
              </ProfileLink>
              <YStack flex={1} minWidth={0}>
                <Text fontSize={15} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                  {authorName}
                </Text>
                {post.author?.headline ? (
                  <Text fontSize={13} color={communityUi.textMuted} numberOfLines={1}>
                    {post.author.headline}
                  </Text>
                ) : null}
              </YStack>
            </XStack>

            <YStack
              borderTopWidth={1}
              borderTopColor={communityUi.borderLight}
              paddingTop={16}
              gap={12}
            >
              <PostContentText content={post.content} fontSize={17} lineHeight={28} />
            </YStack>

            {media.length > 1 ? (
              <PostMediaCarousel items={media.slice(1)} height={320} fit="contain" />
            ) : null}
          </YStack>
        </CommunityCard>

        {/* Engagement reuses the standard feed card chrome without duplicating the article body. */}
        <FeedPostCard post={post} linkToDetail={false} compactArticle />
      </YStack>
    </CommunityShell>
  )
}
