import { useEffect, useState } from 'react'
import { Link, useRouter } from 'one'

import { CommunityCard } from '~/community/components/CommunityCard'
import { PostActionSheets } from '~/community/components/PostActionSheets'
import { PostContentText } from '~/community/components/PostContentText'
import { PostLikeButton } from '~/community/components/PostLikeButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { usePostEngagement } from '~/community/hooks/usePostEngagement'
import { REACTION_TYPES } from '~/community/lib/constants'
import type { CommunityPoll, CommunityPost } from '~/community/lib/community'
import { castPollVote } from '~/community/lib/polls'
import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
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
  /** When false, timestamps and content won't link to the post detail page. */
  linkToDetail?: boolean
}

export function FeedPostCard({ post, linkToDetail = true }: FeedPostCardProps) {
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
  // Event posts show their cover image inside the event card, so keep it out of
  // the general media grid to avoid rendering the same image twice.
  const isEventPost = !!(post.event_rsvp_enabled && post.event_title)
  const mediaUrls = [
    ...(post.image_url && !isEventPost ? [post.image_url] : []),
    ...(post.media_urls ?? []).filter((url) => url !== post.image_url),
  ]

  function requireAuth() {
    router.push(routes.signIn)
  }

  return (
    <>
      <CommunityCard gap={0}>
        <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={12} gap={12} alignItems="flex-start">
          {post.company ? (
            <Link href={communityRoutes.company(post.company.id)} asChild>
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
              <Link href={communityRoutes.company(post.company.id)}>
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
              {linkToDetail ? (
                <Link href={communityRoutes.post(post.id)}>
                  <Text
                    fontSize={12}
                    color={communityUi.textSubtle}
                    cursor="pointer"
                    hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                  >
                    {formatPostTime(post.created_at)}
                  </Text>
                </Link>
              ) : (
                <Text fontSize={12} color={communityUi.textSubtle}>
                  {formatPostTime(post.created_at)}
                </Text>
              )}
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

        <YStack paddingHorizontal={16} paddingBottom={12} gap={10}>
          {linkToDetail ? (
            <Link href={communityRoutes.post(post.id)}>
              <PostContentText content={post.content} />
            </Link>
          ) : (
            <PostContentText content={post.content} />
          )}
          {post.poll ? <PollBlock poll={post.poll} onRequireAuth={requireAuth} /> : null}
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
          paddingHorizontal={8}
          marginHorizontal={8}
          marginBottom={8}
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
        <YStack width="100%" borderRadius={radius.card} overflow="hidden" backgroundColor={communityUi.pageBg}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={url} style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }} />
        </YStack>
      )
    }
    return (
      <YStack width="100%" borderRadius={radius.card} overflow="hidden" backgroundColor={communityUi.pageBg}>
        <Image src={url} width="100%" height={360} objectFit="cover" alt="" />
      </YStack>
    )
  }

  return (
    <XStack flexWrap="wrap" gap={4} borderRadius={radius.card} overflow="hidden">
      {urls.slice(0, 4).map((url) => (
        <YStack key={url} width="49%" height={180} backgroundColor={communityUi.pageBg} borderRadius={radius.chip} overflow="hidden">
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
      paddingVertical={10}
      paddingHorizontal={8}
      borderRadius={999}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ backgroundColor: communityUi.divider }}
      pressStyle={{ scale: 0.97 }}
      onPress={onPress}
    >
      <Icon size={20} color={communityUi.textMuted} />
      <Text
        fontSize={13}
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

function pollTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Final results'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days >= 1) return `${days}d left`
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours >= 1) return `${hours}h left`
  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)))
  return `${minutes}m left`
}

type PollState = {
  options: { id: string; text: string; votes: number }[]
  myOptionId: string | null
  totalVotes: number
}

function PollBlock({ poll, onRequireAuth }: { poll: CommunityPoll; onRequireAuth: () => void }) {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const [state, setState] = useState<PollState>({
    options: poll.options.map((option) => ({ id: option.id, text: option.text, votes: option.votes })),
    myOptionId: poll.myOptionId,
    totalVotes: poll.totalVotes,
  })

  useEffect(() => {
    setState({
      options: poll.options.map((option) => ({ id: option.id, text: option.text, votes: option.votes })),
      myOptionId: poll.myOptionId,
      totalVotes: poll.totalVotes,
    })
  }, [poll])

  const closed = poll.isClosed
  const showResults = !!state.myOptionId || closed

  function vote(optionId: string) {
    if (!user) {
      onRequireAuth()
      return
    }
    if (closed) return

    const previous = state
    setState((prev) => {
      const options = prev.options.map((option) => ({ ...option }))
      const findOption = (id: string) => options.find((option) => option.id === id)
      if (prev.myOptionId === optionId) {
        const target = findOption(optionId)
        if (target) target.votes = Math.max(0, target.votes - 1)
        return { options, myOptionId: null, totalVotes: Math.max(0, prev.totalVotes - 1) }
      }
      if (prev.myOptionId) {
        const old = findOption(prev.myOptionId)
        if (old) old.votes = Math.max(0, old.votes - 1)
        const next = findOption(optionId)
        if (next) next.votes += 1
        return { options, myOptionId: optionId, totalVotes: prev.totalVotes }
      }
      const next = findOption(optionId)
      if (next) next.votes += 1
      return { options, myOptionId: optionId, totalVotes: prev.totalVotes + 1 }
    })

    castPollVote(poll.id, optionId, user.id).then(({ error }) => {
      if (error) setState(previous)
    })
  }

  return (
    <YStack gap={8}>
      <YStack gap={6}>
        {state.options.map((option) => {
          const isMine = state.myOptionId === option.id
          const percent =
            state.totalVotes > 0 ? Math.round((option.votes / state.totalVotes) * 100) : 0
          return (
            <YStack
              key={option.id}
              onPress={() => vote(option.id)}
              cursor={closed ? 'default' : 'pointer'}
              borderRadius={8}
              borderWidth={1}
              borderColor={isMine ? communityUi.brand : communityUi.border}
              overflow="hidden"
              position="relative"
              minHeight={40}
              justifyContent="center"
              pressStyle={closed ? undefined : { opacity: 0.85 }}
            >
              {showResults ? (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  bottom={0}
                  width={`${Math.max(2, percent)}%`}
                  backgroundColor={isMine ? 'rgba(10,102,194,0.16)' : communityUi.divider}
                />
              ) : null}
              <XStack paddingHorizontal={12} paddingVertical={9} alignItems="center" gap={8}>
                <Text flex={1} fontSize={14} fontWeight={isMine ? '700' : '500'} color={communityUi.text}>
                  {option.text}
                </Text>
                {isMine ? <Icons.Check size={15} color={communityUi.brand} /> : null}
                {showResults ? (
                  <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                    {percent}%
                  </Text>
                ) : null}
              </XStack>
            </YStack>
          )
        })}
      </YStack>
      <Text fontSize={12} color={communityUi.textMuted}>
        {state.totalVotes} {state.totalVotes === 1 ? 'vote' : 'votes'} · {pollTimeLeft(poll.expiresAt)}
      </Text>
    </YStack>
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
      borderRadius={8}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
      overflow="hidden"
    >
      {post.image_url ? (
        <Image src={post.image_url} width="100%" height={168} objectFit="cover" alt="" />
      ) : null}
      <YStack padding={12} gap={8}>
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
    </YStack>
  )
}