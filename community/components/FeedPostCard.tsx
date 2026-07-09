import { useEffect, useState } from 'react'
import { Link, useRouter } from 'one'

import { CommunityCard } from '~/community/components/CommunityCard'
import { PostActionSheets } from '~/community/components/PostActionSheets'
import { PostContentText } from '~/community/components/PostContentText'
import { PostLikeButton } from '~/community/components/PostLikeButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { usePostEngagement } from '~/community/hooks/usePostEngagement'
import { REACTION_TYPES } from '~/community/lib/constants'
import type { CommunityPost } from '~/community/lib/community'
import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { rsvpToPostEvent, cancelPostEventRsvp, fetchPostEventRsvpState } from '~/community/lib/events'

import { BRAND_MEMBER_LABEL } from '~/config/brand'

function formatPostTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${Math.max(minutes, 1)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

type FeedPostCardProps = {
  post: CommunityPost
}

export function FeedPostCard({ post }: FeedPostCardProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()

  const engagement = usePostEngagement(
    post.id,
    post.like_count ?? 0,
    post.comment_count ?? 0,
  )

  const authorName =
    post.company?.name ??
    post.group?.title ??
    post.author?.full_name ??
    post.author?.username ??
    BRAND_MEMBER_LABEL
  const avatarSrc = post.company?.logo_url ?? post.group?.avatar_url ?? post.author?.avatar_url ?? undefined
  const avatarName = post.company?.name ?? post.group?.name ?? authorName
  const contextLabel = post.company
    ? `Posted by ${post.author?.full_name || post.author?.username || 'member'}`
    : post.group
      ? `Posted in ${post.group.title}`
      : null
  const mediaUrls = [
    ...(post.image_url ? [post.image_url] : []),
    ...(post.media_urls ?? []).filter((url) => url !== post.image_url),
  ]

  function requireAuth() {
    router.push(routes.signIn)
  }

  return (
    <>
      <CommunityCard gap={0}>
        <XStack paddingHorizontal={12} paddingTop={12} paddingBottom={8} gap={8} alignItems="flex-start">
          {post.company ? (
            <Link href={communityRoutes.company(post.company.slug)} asChild>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </Link>
          ) : post.group ? (
            <Link href={communityRoutes.group(post.group.id)} asChild>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </Link>
          ) : (
            <ProfileLink userId={post.user_id} username={post.author?.username}>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </ProfileLink>
          )}
          <YStack flex={1} gap={2} minWidth={0}>
            {post.company ? (
              <Link href={communityRoutes.company(post.company.slug)}>
                <Text
                  fontWeight="600"
                  fontSize={14}
                  color={communityUi.text}
                  cursor="pointer"
                  hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                >
                  {authorName}
                </Text>
              </Link>
            ) : post.group ? (
              <Link href={communityRoutes.group(post.group.id)}>
                <Text
                  fontWeight="600"
                  fontSize={14}
                  color={communityUi.text}
                  cursor="pointer"
                  hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                >
                  {authorName}
                </Text>
              </Link>
            ) : (
              <ProfileLink userId={post.user_id} username={post.author?.username}>
                <Text
                  fontWeight="600"
                  fontSize={14}
                  color={communityUi.text}
                  cursor="pointer"
                  hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                >
                  {authorName}
                  {post.author_verified ? ' · ✓' : ''}
                </Text>
              </ProfileLink>
            )}
            {contextLabel ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                {contextLabel}
              </Text>
            ) : post.author?.headline ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                {post.author.headline}
              </Text>
            ) : null}
            <XStack gap={4} alignItems="center">
              <Text fontSize={12} color={communityUi.textSubtle}>
                {formatPostTime(post.created_at)}
              </Text>
              <Text fontSize={12} color={communityUi.textSubtle}>
                ·
              </Text>
              <Icons.Globe size={12} color={communityUi.textSubtle} />
            </XStack>
          </YStack>
          <XStack
            padding={4}
            borderRadius={999}
            cursor="pointer"
            hoverStyle={{ backgroundColor: communityUi.divider }}
            onPress={() => engagement.openSheet('options')}
          >
            <Icons.MoreHorizontal size={20} color={communityUi.textMuted} />
          </XStack>
        </XStack>

        <YStack paddingHorizontal={12} paddingBottom={8} gap={8}>
          <PostContentText content={post.content} />
          {post.event_rsvp_enabled && post.event_title ? (
            <PostEventCard post={post} onRequireAuth={requireAuth} />
          ) : null}
          {mediaUrls.length > 0 ? <PostMedia urls={mediaUrls} /> : null}
        </YStack>

        {(engagement.likeCount > 0 || engagement.commentCount > 0) ? (
          <XStack
            paddingHorizontal={12}
            paddingBottom={8}
            justifyContent="space-between"
            alignItems="center"
          >
            {engagement.likeCount > 0 ? (
              <XStack
                gap={6}
                alignItems="center"
                cursor="pointer"
                onPress={() => engagement.openSheet('reactions')}
              >
                <ReactionIcons />
                <Text fontSize={12} color={communityUi.textMuted} fontWeight="500">
                  {engagement.likeCount}
                </Text>
              </XStack>
            ) : (
              <YStack />
            )}
            {engagement.commentCount > 0 ? (
              <Text
                fontSize={12}
                color={communityUi.textMuted}
                fontWeight="500"
                cursor="pointer"
                onPress={() => engagement.openSheet('comments')}
              >
                {engagement.commentCount}{' '}
                {engagement.commentCount === 1 ? 'comment' : 'comments'}
              </Text>
            ) : null}
          </XStack>
        ) : null}

        <XStack
          paddingHorizontal={4}
          marginHorizontal={8}
          marginBottom={4}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
          justifyContent="space-around"
        >
          <PostLikeButton
            isLiked={engagement.isLiked}
            reactionType={engagement.reactionType}
            reactionLabel={engagement.reactionLabel}
            isAuthenticated={engagement.isAuthenticated}
            isReacting={engagement.isReacting}
            onQuickLike={() => {
              engagement.quickLike().then((result) => {
                if (result?.error) requireAuth()
              })
            }}
            onPickReaction={(type) => {
              engagement.pickReaction(type)
            }}
            onRequireAuth={requireAuth}
          />
          <PostActionButton
            icon={Icons.MessageCircle}
            label="Comment"
            onPress={() => engagement.openSheet('comments')}
          />
          <PostActionButton
            icon={Icons.Repeat2}
            label="Repost"
            onPress={() => engagement.openSheet('repost')}
          />
          <PostActionButton
            icon={Icons.Send}
            label="Send"
            onPress={() => engagement.openSheet('share')}
          />
        </XStack>
      </CommunityCard>

      <PostActionSheets post={post} engagement={engagement} />
    </>
  )
}

function ReactionIcons() {
  const communityUi = useCommunityUi()
  return (
    <XStack>
      {REACTION_TYPES.slice(0, 3).map((reaction, index) => (
        <XStack
          key={reaction.type}
          width={18}
          height={18}
          borderRadius={999}
          backgroundColor={reaction.color}
          alignItems="center"
          justifyContent="center"
          marginLeft={index === 0 ? 0 : -6}
          borderWidth={1}
          borderColor={communityUi.cardBg}
        >
          <Text fontSize={9}>{reaction.emoji}</Text>
        </XStack>
      ))}
    </XStack>
  )
}

function PostMedia({ urls }: { urls: string[] }) {
  const communityUi = useCommunityUi()
  if (urls.length === 1) {
    const url = urls[0]
    if (isGifUrl(url)) {
      return (
        <YStack width="100%" borderRadius={4} overflow="hidden" backgroundColor={communityUi.pageBg}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={url} style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }} />
        </YStack>
      )
    }
    return (
      <YStack width="100%" borderRadius={4} overflow="hidden" backgroundColor={communityUi.pageBg}>
        <Image src={url} width="100%" height={360} objectFit="cover" alt="" />
      </YStack>
    )
  }

  return (
    <XStack flexWrap="wrap" gap={2} borderRadius={4} overflow="hidden">
      {urls.slice(0, 4).map((url) => (
        <YStack key={url} width="49%" height={180} backgroundColor={communityUi.pageBg}>
          {isGifUrl(url) ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Image src={url} width="100%" height="100%" objectFit="cover" alt="" />
          )}
        </YStack>
      ))}
    </XStack>
  )
}

function PostActionButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Icons.MessageCircle
  label: string
  onPress?: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap={6}
      paddingVertical={12}
      paddingHorizontal={8}
      borderRadius={4}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.divider }}
      onPress={onPress}
    >
      <Icon size={20} color={communityUi.textMuted} />
      <Text
        fontSize={14}
        fontWeight="600"
        color={communityUi.textMuted}
        display="none"
        $gtSm={{ display: 'flex' }}
      >
        {label}
      </Text>
    </XStack>
  )
}

function PostEventCard({
  post,
  onRequireAuth,
}: {
  post: CommunityPost
  onRequireAuth: () => void
}) {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const [isRsvped, setIsRsvped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsRsvped(false)
      setIsLoading(false)
      return
    }
    fetchPostEventRsvpState(post.id, user.id).then((state) => {
      setIsRsvped(state.isRsvped)
      setIsLoading(false)
    })
  }, [post.id, user])

  async function toggleRsvp() {
    if (!user) {
      onRequireAuth()
      return
    }
    setIsToggling(true)
    const result = isRsvped
      ? await cancelPostEventRsvp(post.id, user.id)
      : await rsvpToPostEvent(post.id, user.id)
    setIsToggling(false)
    if (!result.error) setIsRsvped(!isRsvped)
  }

  const when = post.event_start_time
    ? new Date(post.event_start_time).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <YStack
      padding={12}
      borderRadius={8}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
      gap={8}
    >
      <XStack gap={8} alignItems="center">
        <Icons.Calendar size={18} color={communityUi.brand} />
        <Text fontSize={15} fontWeight="600" color={communityUi.text}>
          {post.event_title}
        </Text>
      </XStack>
      {when ? (
        <Text fontSize={13} color={communityUi.textMuted}>
          {when}
          {post.event_location ? ` · ${post.event_location}` : ''}
        </Text>
      ) : null}
      {post.event_description ? (
        <Text fontSize={13} color={communityUi.textMuted} numberOfLines={3}>
          {post.event_description}
        </Text>
      ) : null}
      <Button
        alignSelf="flex-start"
        size="$3"
        borderRadius={999}
        backgroundColor={isRsvped ? communityUi.divider : communityUi.brand}
        color={isRsvped ? communityUi.textMuted : 'white'}
        disabled={isLoading || isToggling}
        onPress={toggleRsvp}
      >
        {isRsvped ? 'Going' : 'RSVP'}
      </Button>
    </YStack>
  )
}