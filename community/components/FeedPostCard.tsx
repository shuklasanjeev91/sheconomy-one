import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useThemeName } from 'tamagui'

import { CommunityCard } from '~/community/components/CommunityCard'
import { PostActionSheets } from '~/community/components/PostActionSheets'
import { PostContentText } from '~/community/components/PostContentText'
import { PostImageLightbox } from '~/community/components/PostImageLightbox'
import { PostLikeButton } from '~/community/components/PostLikeButton'
import { PostLinkPreviewCard } from '~/community/components/PostLinkPreviewCard'
import { PostMediaCarousel } from '~/community/components/PostMediaCarousel'
import { PostMediaSlide } from '~/community/components/PostMediaSlide'
import { ProfileLink } from '~/community/components/ProfileLink'
import { usePostEngagement } from '~/community/hooks/usePostEngagement'
import { REACTION_TYPES } from '~/community/lib/constants'
import type {
  CommunityPoll,
  CommunityPost,
  OriginalPostPreview,
  PostCelebration,
  PostProduct,
  PostShop,
} from '~/community/lib/community'
import { castPollVote } from '~/community/lib/polls'
import { collectPostMedia, type PostMediaItem } from '~/community/lib/post-media'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  getPostTypeSurface,
  resolveFeedPostType,
} from '~/community/lib/post-type-surface'
import { Avatar, Button, Icons, Image, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { commerceRoutes, communityRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { rsvpToPostEvent, cancelPostEventRsvp, fetchPostEventRsvpState } from '~/community/lib/events'
import { CongratulateSheet } from '~/community/components/CongratulateSheet'

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
  /** On the article reader, hide the article body (already shown above) and keep engagement. */
  compactArticle?: boolean
  onPostUpdated?: (postId: string, patch: Partial<CommunityPost>) => void
  onPostDeleted?: (postId: string) => void
}

export function FeedPostCard({
  post,
  linkToDetail = true,
  compactArticle = false,
  onPostUpdated,
  onPostDeleted,
}: FeedPostCardProps) {
  const communityUi = useCommunityUi()
  const themeName = useThemeName()
  const router = useRouter()
  const [congratulateOpen, setCongratulateOpen] = useState(false)
  const postSurface = useMemo(
    () =>
      getPostTypeSurface(
        resolveFeedPostType(post),
        communityUi,
        themeName === 'dark' ? 'dark' : 'light',
      ),
    [communityUi, post, themeName],
  )

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
  const posterName = post.author?.full_name || post.author?.username || 'member'
  // Event posts show their cover image inside the event card, so keep it out of
  // the general media grid to avoid rendering the same image twice.
  const isEventPost = !!(post.event_title && (post.event_rsvp_enabled || post.post_type === 'event'))
  const mediaItems = collectPostMedia(post).filter((item) => {
    if (!isEventPost) return true
    return item.url !== post.image_url
  })

  const articleHref = communityRoutes.article(post.id)
  const isArticle = post.post_type === 'article' || !!post.article_title
  const detailHref = isArticle ? articleHref : communityRoutes.post(post.id)

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  function requireAuth() {
    router.push(routes.signIn)
  }

  // LinkedIn-style: tapping media opens a fullscreen zoomable viewer (feed + detail).
  function openMedia(index = 0) {
    setLightboxIndex(typeof index === 'number' ? index : 0)
    setLightboxOpen(true)
  }

  return (
    <>
      <CommunityCard
        gap={0}
        backgroundColor={postSurface.backgroundColor}
        borderColor={postSurface.borderColor}
        borderLeftWidth={3}
        borderLeftColor={postSurface.accentColor}
      >
        {post.original_post_id || post.post_type === 'repost' ? (
          <XStack
            paddingHorizontal={16}
            paddingTop={12}
            paddingBottom={0}
            gap={6}
            alignItems="center"
          >
            <Icons.Repeat size={14} color={postSurface.accentColor} />
            <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
              {authorName} reposted
            </Text>
          </XStack>
        ) : null}

        <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={12} gap={12} alignItems="flex-start">
          {post.company ? (
            <AppLink href={communityRoutes.company(post.company.id)} asChild>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </AppLink>
          ) : post.group ? (
            <AppLink href={communityRoutes.group(post.group.id)} asChild>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </AppLink>
          ) : (
            <ProfileLink userId={post.user_id} username={post.author?.username}>
              <Avatar name={avatarName} src={avatarSrc} size="$4" cursor="pointer" />
            </ProfileLink>
          )}
          <YStack flex={1} gap={2} minWidth={0}>
            {post.company ? (
              <AppLink href={communityRoutes.company(post.company.id)}>
                <Text
                  fontWeight="600"
                  fontSize={14}
                  color={communityUi.text}
                  cursor="pointer"
                  hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                >
                  {authorName}
                </Text>
              </AppLink>
            ) : post.group ? (
              <AppLink href={communityRoutes.group(post.group.id)}>
                <Text
                  fontWeight="600"
                  fontSize={14}
                  color={communityUi.text}
                  cursor="pointer"
                  hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                >
                  {authorName}
                </Text>
              </AppLink>
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
            {post.company ? (
              <XStack alignItems="center" gap={4} flexWrap="wrap">
                <Text fontSize={12} color={communityUi.textMuted}>
                  Posted by
                </Text>
                <ProfileLink userId={post.user_id} username={post.author?.username}>
                  <Text
                    fontSize={12}
                    color={communityUi.textMuted}
                    fontWeight="600"
                    cursor="pointer"
                    hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                    numberOfLines={1}
                  >
                    {posterName}
                  </Text>
                </ProfileLink>
              </XStack>
            ) : post.group ? (
              <XStack alignItems="center" gap={4} flexWrap="wrap">
                <Text fontSize={12} color={communityUi.textMuted}>
                  Posted in
                </Text>
                <AppLink href={communityRoutes.group(post.group.id)}>
                  <Text
                    fontSize={12}
                    color={communityUi.textMuted}
                    fontWeight="600"
                    cursor="pointer"
                    hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                    numberOfLines={1}
                  >
                    {post.group.title}
                  </Text>
                </AppLink>
              </XStack>
            ) : post.author?.headline ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                {post.author.headline}
              </Text>
            ) : null}
            <XStack gap={4} alignItems="center">
              {linkToDetail ? (
                <AppLink href={detailHref}>
                  <Text
                    fontSize={12}
                    color={communityUi.textSubtle}
                    cursor="pointer"
                    hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
                  >
                    {formatPostTime(post.created_at)}
                  </Text>
                </AppLink>
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
          {!compactArticle && isArticle ? (
            <AppLink href={articleHref}>
              <YStack
                gap={10}
                borderRadius={12}
                borderWidth={1}
                borderColor={communityUi.border}
                overflow="hidden"
                backgroundColor={communityUi.pageBg}
                cursor="pointer"
                hoverStyle={{ borderColor: communityUi.brand }}
              >
                {post.image_url || mediaItems[0]?.kind === 'image' ? (
                  <Image
                    src={post.image_url || mediaItems[0]?.url || ''}
                    width="100%"
                    height={160}
                    objectFit="cover"
                    alt=""
                  />
                ) : null}
                <YStack padding={14} gap={8}>
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
                  {post.article_title ? (
                    <Text fontSize={20} fontWeight="800" color={communityUi.text} letterSpacing={-0.3} lineHeight={26}>
                      {post.article_title}
                    </Text>
                  ) : null}
                  <PostContentText content={post.content} collapsible />
                  <Text fontSize={13} fontWeight="700" color={communityUi.brand}>
                    Read article →
                  </Text>
                </YStack>
              </YStack>
            </AppLink>
          ) : null}

          {!compactArticle && !isArticle ? (
            <>
              {linkToDetail ? (
                <AppLink href={detailHref}>
                  <PostContentText content={post.content} />
                </AppLink>
              ) : (
                <PostContentText content={post.content} />
              )}
            </>
          ) : null}

          {post.originalPost ? (
            <OriginalPostEmbed original={post.originalPost} />
          ) : null}
          {post.celebration ? (
            <YStack gap={10}>
              <PostCelebrationCard celebration={post.celebration} />
              <Button
                alignSelf="flex-start"
                size="$3"
                borderRadius={999}
                backgroundColor={communityUi.brand}
                color="white"
                icon={<Icons.PartyPopper size={16} color="white" />}
                onPress={() => {
                  if (!engagement.isAuthenticated) {
                    requireAuth()
                    return
                  }
                  setCongratulateOpen(true)
                }}
              >
                Congratulate
              </Button>
            </YStack>
          ) : null}
          {post.poll ? <PollBlock poll={post.poll} onRequireAuth={requireAuth} /> : null}
          {isEventPost ? (
            <PostEventCard post={post} onRequireAuth={requireAuth} />
          ) : null}
          {!isArticle && mediaItems.length > 0 ? (
            <PostMedia items={mediaItems} onPress={openMedia} />
          ) : null}
          {post.link && mediaItems.length === 0 && !isArticle ? (
            <PostLinkPreviewCard preview={post.link} />
          ) : null}
          {post.product ? <PostProductCard product={post.product} /> : null}
          {post.shop ? <PostShopCard shop={post.shop} /> : null}
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
            onPress={() => engagement.openSheet('repost-menu')}
          />
          <PostActionButton
            icon={Icons.Send}
            label="Send"
            onPress={() => engagement.openSheet('send')}
          />
        </XStack>
      </CommunityCard>

      <PostActionSheets
        post={post}
        engagement={engagement}
        onPostUpdated={onPostUpdated}
        onPostDeleted={onPostDeleted}
      />

      {post.celebration ? (
        <CongratulateSheet
          open={congratulateOpen}
          onOpenChange={setCongratulateOpen}
          post={post}
          onCongratulated={() => {
            engagement.openSheet('comments')
          }}
        />
      ) : null}

      {mediaItems.length > 0 ? (
        <PostImageLightbox
          items={mediaItems}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          initialIndex={lightboxIndex}
        />
      ) : null}
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

function PostMedia({
  items,
  onPress,
}: {
  items: PostMediaItem[]
  onPress?: (index?: number) => void
}) {
  const communityUi = useCommunityUi()
  const companionImage = items.find((item) => item.kind === 'image')?.url ?? null
  const hasVideo = items.some((item) => item.kind === 'video')
  // LinkedIn: videos stay in-feed with muted autoplay — images open zoom lightbox.
  const pressable =
    onPress && !hasVideo
      ? ({ cursor: 'pointer' as const, onPress: () => onPress(0) } as const)
      : {}

  if (items.length === 1) {
    const item = items[0]
    const height = item.kind === 'video' ? 420 : 360
    return (
      <YStack
        width="100%"
        height={height}
        borderRadius={radius.card}
        overflow="hidden"
        backgroundColor={item.kind === 'video' ? '#000' : communityUi.pageBg}
        {...pressable}
      >
        <PostMediaSlide
          item={item}
          width={0}
          height={height}
          fit={item.kind === 'video' ? 'contain' : 'cover'}
          fill
          posterUrl={companionImage}
          autoplayInView={item.kind === 'video'}
        />
      </YStack>
    )
  }

  return (
    <PostMediaCarousel
      items={items}
      height={hasVideo ? 420 : 360}
      fit="contain"
      onPressImage={onPress && !hasVideo ? (index) => onPress(index) : undefined}
    />
  )
}

const CELEBRATION_EMOJI: Record<string, string> = {
  new_job: '💼',
  work_anniversary: '🎊',
  education: '🎓',
  award: '🏆',
  launch: '🚀',
  milestone: '📈',
  welcome: '👋',
}

function PostCelebrationCard({ celebration }: { celebration: PostCelebration }) {
  const communityUi = useCommunityUi()
  const emoji = CELEBRATION_EMOJI[celebration.occasion] ?? '🎉'
  return (
    <YStack borderRadius={radius.card} overflow="hidden" borderWidth={1} borderColor={communityUi.border}>
      {celebration.imageUrl ? (
        <YStack position="relative">
          <Image
            src={celebration.imageUrl}
            width="100%"
            height={260}
            objectFit="cover"
            alt={celebration.title}
          />
          <YStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            paddingHorizontal={16}
            paddingTop={40}
            paddingBottom={14}
            gap={4}
            backgroundColor="rgba(0,0,0,0.45)"
          >
            {celebration.subtitle ? (
              <Text fontSize={11} fontWeight="700" color="#fff" letterSpacing={0.4} opacity={0.9}>
                {emoji} {celebration.subtitle.toUpperCase()}
              </Text>
            ) : null}
            <Text fontSize={17} fontWeight="800" color="#fff">
              {celebration.title}
            </Text>
          </YStack>
        </YStack>
      ) : (
        <YStack
          alignItems="center"
          justifyContent="center"
          paddingVertical={28}
          gap={8}
          backgroundColor={communityUi.accentMuted}
        >
          <Text fontSize={44}>{emoji}</Text>
          {celebration.subtitle ? (
            <Text fontSize={12} fontWeight="700" color={communityUi.brand} letterSpacing={0.4}>
              {celebration.subtitle.toUpperCase()}
            </Text>
          ) : null}
          <Text
            fontSize={17}
            fontWeight="800"
            color={communityUi.text}
            textAlign="center"
            paddingHorizontal={16}
          >
            {celebration.title}
          </Text>
        </YStack>
      )}
    </YStack>
  )
}

function formatPostPrice(price: number | null, currency: string | null) {
  if (price == null) return 'Free'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `${currency ?? '₹'}${price}`
  }
}

function PostProductCard({ product }: { product: PostProduct }) {
  const communityUi = useCommunityUi()
  const card = (
    <XStack
      borderRadius={radius.card}
      overflow="hidden"
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.cardBg}
      cursor={product.slug ? 'pointer' : 'default'}
      hoverStyle={product.slug ? { borderColor: communityUi.brand } : undefined}
      animation="quick"
    >
      <YStack
        width={112}
        height={112}
        backgroundColor={communityUi.pageBg}
        alignItems="center"
        justifyContent="center"
      >
        {product.imageUrl ? (
          <Image src={product.imageUrl} width={112} height={112} objectFit="cover" alt="" />
        ) : (
          <Icons.Package size={26} color={communityUi.textMuted} />
        )}
      </YStack>
      <YStack flex={1} padding={12} gap={4} justifyContent="center" minWidth={0}>
        <Text fontSize={11} fontWeight="700" color={communityUi.textMuted} letterSpacing={0.4}>
          PRODUCT
        </Text>
        <Text fontSize={15} fontWeight="700" color={communityUi.text} numberOfLines={2}>
          {product.title}
        </Text>
        <Text fontSize={14} fontWeight="700" color={communityUi.brand}>
          {formatPostPrice(product.price, product.currency)}
        </Text>
        {product.shopName ? (
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
            {product.shopName}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )

  if (product.slug) {
    return (
      <AppLink href={commerceRoutes.listing(product.slug)} asChild>
        {card}
      </AppLink>
    )
  }
  return card
}

function PostShopCard({ shop }: { shop: PostShop }) {
  const communityUi = useCommunityUi()
  const card = (
    <XStack
      alignItems="center"
      gap={12}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.cardBg}
      padding={12}
      cursor={shop.slug ? 'pointer' : 'default'}
      hoverStyle={shop.slug ? { borderColor: communityUi.brand } : undefined}
      animation="quick"
    >
      <Avatar name={shop.name} src={shop.logoUrl ?? undefined} size="$5" />
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={11} fontWeight="700" color={communityUi.textMuted} letterSpacing={0.4}>
          SHOP
        </Text>
        <Text fontSize={15} fontWeight="700" color={communityUi.text} numberOfLines={1}>
          {shop.name}
        </Text>
        {shop.description ? (
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
            {shop.description}
          </Text>
        ) : null}
      </YStack>
      {shop.slug ? (
        <XStack
          paddingHorizontal={14}
          paddingVertical={7}
          borderRadius={999}
          borderWidth={1}
          borderColor={communityUi.brand}
        >
          <Text fontSize={13} fontWeight="700" color={communityUi.brand}>
            Visit
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )

  if (shop.slug) {
    return (
      <AppLink href={commerceRoutes.shop(shop.slug)} asChild>
        {card}
      </AppLink>
    )
  }
  return card
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
  const toast = useAppToast()
  const [pending, setPending] = useState(false)
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
    if (closed || pending) return

    const previous = state
    setPending(true)
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
      setPending(false)
      if (error) {
        setState(previous)
        toast.show('Could not vote', { tone: 'danger', message: error })
      }
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
              disabled={closed || pending}
              cursor={closed || pending ? 'default' : 'pointer'}
              borderRadius={8}
              borderWidth={1}
              borderColor={isMine ? communityUi.brand : communityUi.border}
              overflow="hidden"
              position="relative"
              minHeight={40}
              justifyContent="center"
              pressStyle={closed || pending ? undefined : { opacity: 0.85 }}
              opacity={pending ? 0.85 : 1}
              accessibilityRole="button"
              accessibilityState={{ disabled: closed || pending, selected: isMine }}
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
      ? await cancelPostEventRsvp(post.id, user.id, post.community_event_id)
      : await rsvpToPostEvent(post.id, user.id, post.community_event_id)
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
          <Text fontSize={15} fontWeight="600" color={communityUi.text} flex={1}>
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
        <XStack gap={8} flexWrap="wrap">
          {post.event_rsvp_enabled !== false ? (
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
          ) : null}
          {post.community_event_id ? (
            <AppLink href={communityRoutes.event(post.community_event_id)}>
              <Button
                alignSelf="flex-start"
                size="$3"
                borderRadius={999}
                tone="outline"
                icon={<Icons.ArrowUpRight size={14} />}
              >
                View event
              </Button>
            </AppLink>
          ) : null}
        </XStack>
      </YStack>
    </YStack>
  )
}

function OriginalPostEmbed({ original }: { original: OriginalPostPreview }) {
  const communityUi = useCommunityUi()

  return (
    <AppLink href={communityRoutes.post(original.id)}>
      <YStack
        borderWidth={1}
        borderColor={communityUi.border}
        borderRadius={8}
        overflow="hidden"
        backgroundColor={communityUi.pageBg}
        cursor="pointer"
        hoverStyle={{ borderColor: communityUi.brandLight }}
      >
        <XStack padding={12} gap={10} alignItems="flex-start">
          <Avatar
            name={original.authorName}
            src={original.authorAvatar ?? undefined}
            size="$3"
          />
          <YStack flex={1} gap={2} minWidth={0}>
            <Text fontSize={13} fontWeight="700" color={communityUi.text} numberOfLines={1}>
              {original.authorName}
            </Text>
            {original.authorHeadline ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                {original.authorHeadline}
              </Text>
            ) : null}
            <Text fontSize={12} color={communityUi.textSubtle}>
              {formatPostTime(original.createdAt)}
            </Text>
          </YStack>
        </XStack>
        {original.content ? (
          <YStack paddingHorizontal={12} paddingBottom={12}>
            <PostContentText content={original.content} fontSize={14} lineHeight={22} />
          </YStack>
        ) : null}
        {(() => {
          const originalMedia = collectPostMedia(original)
          if (!originalMedia.length) return null
          if (originalMedia.length === 1) {
            return (
              <YStack height={180} backgroundColor="#000">
                <PostMediaSlide item={originalMedia[0]} width={0} height={180} fit="cover" fill />
              </YStack>
            )
          }
          return <PostMediaCarousel items={originalMedia} height={180} fit="cover" rounded={false} />
        })()}
      </YStack>
    </AppLink>
  )
}