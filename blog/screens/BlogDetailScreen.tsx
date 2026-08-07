import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'one'

import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'
import { CmsMarkdownBody } from '~/components/blog/CmsMarkdownBody'
import { PageScroll } from '~/components/layout/PageScroll'
import { usePageSeo } from '~/components/seo/RouteSeo'
import {
  Avatar,
  Badge,
  Button,
  Icons,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuth } from '~/hooks/useAuth'
import {
  checkLike,
  createComment,
  getContentCoverUrl,
  getContentTeaser,
  incrementViewCount,
  loadComments,
  loadContentBySlug,
  toggleLike,
  type CmsCommentWithAuthor,
} from '~/lib/cms'
import { blogRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function CommentRow({ comment }: { comment: CmsCommentWithAuthor }) {
  const ui = useAppUi()
  const name = comment.author?.full_name || comment.author?.username || 'Member'

  return (
    <XStack
      gap="$3"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      alignItems="flex-start"
    >
      <Avatar name={name} src={comment.author?.avatar_url} size={40} />
      <YStack flex={1} minWidth={0} gap="$1.5">
        <XStack justifyContent="space-between" gap="$2" flexWrap="wrap">
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
            {name}
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            {formatDate(comment.created_at)}
          </Text>
        </XStack>
        <Text fontSize={15} color={ui.text} lineHeight={22}>
          {comment.body}
        </Text>
      </YStack>
    </XStack>
  )
}

export function BlogDetailScreen() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom, gutter, mobileTabBarOffset } = useAppLayout()
  const { isAuthenticated, signIn } = useAuth()
  const { slug } = useParams<{ slug: string }>()

  const {
    currentContent,
    comments,
    isFetching,
    isCreating,
    contentError,
    likedContentIds,
    likeCounts,
  } = useAppSelector((s) => s.cms)

  const [commentBody, setCommentBody] = useState('')
  const [pendingNotice, setPendingNotice] = useState(false)

  const content =
    currentContent && currentContent.slug === slug && currentContent.status === 'published'
      ? currentContent
      : null

  useEffect(() => {
    if (!slug) return
    void dispatch(loadContentBySlug(slug))
  }, [dispatch, slug])

  useEffect(() => {
    if (!content?.id) return
    void dispatch(checkLike(content.id))
    void dispatch(
      loadComments({
        content_id: content.id,
        is_approved: true,
        page: 1,
        limit: 50,
      }),
    )
    void incrementViewCount(content.id)
  }, [content?.id, dispatch])

  const cover = content ? getContentCoverUrl(content) : ''
  const teaser = content ? getContentTeaser(content, 200) : ''
  const liked = content ? !!likedContentIds[content.id] : false
  const likeCount = content ? (likeCounts[content.id] ?? content.like_count ?? 0) : 0
  const approvedComments = useMemo(
    () => comments.filter((c) => c.is_approved && !c.deleted_at),
    [comments],
  )
  const tags =
    content?.cms_content_tag_map?.map((link) => link.cms_tags?.name).filter(Boolean) ?? []

  usePageSeo(
    useMemo(() => {
      if (!content) return null
      return {
        title: content.seo_title || content.title,
        description: content.seo_description || teaser || undefined,
        image: cover || null,
        type: 'article' as const,
      }
    }, [content, cover, teaser]),
  )

  async function handleLike() {
    if (!content) return
    if (!isAuthenticated) {
      signIn(blogRoutes.post(content.slug))
      return
    }
    try {
      await dispatch(toggleLike(content.id)).unwrap()
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Could not update like', { tone: 'danger' })
    }
  }

  async function handleComment() {
    if (!content) return
    if (!isAuthenticated) {
      signIn(blogRoutes.post(content.slug))
      return
    }
    const body = commentBody.trim()
    if (!body) {
      toast.show('Write a comment first', { tone: 'warning' })
      return
    }
    try {
      await dispatch(
        createComment({
          content_id: content.id,
          body,
        }),
      ).unwrap()
      setCommentBody('')
      setPendingNotice(true)
      toast.show('Comment submitted for review', { tone: 'success' })
      void dispatch(
        loadComments({
          content_id: content.id,
          is_approved: true,
          page: 1,
          limit: 50,
        }),
      )
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Could not post comment', { tone: 'danger' })
    }
  }

  if (isFetching && !content) {
    return (
      <PageScroll>
        <YStack minHeight={420} alignItems="center" justifyContent="center" gap="$2">
          <Spinner size="large" />
          <Text color={ui.textMuted}>Opening article…</Text>
        </YStack>
      </PageScroll>
    )
  }

  if (!content) {
    return (
      <PageScroll>
        <YStack
          width="100%"
          maxWidth={720}
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingVertical="$8"
          gap="$3"
        >
          <Text fontSize={24} fontWeight="800" color={ui.text}>
            Post not found
          </Text>
          <Text color={ui.textSecondary}>
            {contentError || 'This blog post may be unpublished or removed.'}
          </Text>
          <Button alignSelf="flex-start" icon={Icons.ArrowLeft} onPress={() => router.push(blogRoutes.home)}>
            Back to all posts
          </Button>
        </YStack>
      </PageScroll>
    )
  }

  const commentsEnabled = content.allow_comments !== false
  const bottomPad = safeBottom + (isDesktop ? 48 : mobileTabBarOffset + 24)

  return (
    <PageScroll>
      <YStack width="100%" backgroundColor={ui.background} paddingBottom={bottomPad}>
        {/* Cover */}
        {cover ? (
          <YStack
            width="100%"
            height={isDesktop ? 420 : 240}
            backgroundColor={ui.roseSurface}
            overflow="hidden"
          >
            <CmsCoverImage url={cover} alt={content.title} height="100%" />
          </YStack>
        ) : (
          <YStack
            width="100%"
            height={isDesktop ? 180 : 120}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.FileText size={40} color={ui.brand} />
          </YStack>
        )}

        <YStack
          width="100%"
          maxWidth={760}
          alignSelf="center"
          paddingHorizontal={gutter}
          marginTop={cover ? (isDesktop ? -56 : -36) : '$4'}
          gap="$5"
        >
          <YStack
            gap="$4"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            style={getShadowStyle('md')}
          >
            <XStack
              alignItems="center"
              gap="$2"
              cursor="pointer"
              alignSelf="flex-start"
              onPress={() => router.push(blogRoutes.home)}
              hoverStyle={{ opacity: 0.85 }}
            >
              <Icons.ArrowLeft size={18} color={ui.textMuted} />
              <Text fontSize={14} fontWeight="600" color={ui.textMuted}>
                All blog posts
              </Text>
            </XStack>

            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              {content.cms_categories?.name ? (
                <Badge tone="neutral">{content.cms_categories.name}</Badge>
              ) : (
                <Badge tone="neutral">Blog</Badge>
              )}
              {content.is_featured ? <Badge tone="brand">Featured</Badge> : null}
              <Text fontSize={13} color={ui.textMuted}>
                {formatDate(content.published_at ?? content.created_at)}
              </Text>
            </XStack>

            <Text
              fontSize={isDesktop ? 38 : 28}
              fontWeight="800"
              color={ui.text}
              letterSpacing={-0.7}
              lineHeight={isDesktop ? 46 : 34}
            >
              {content.title}
            </Text>

            {teaser ? (
              <Text fontSize={16} color={ui.textSecondary} lineHeight={24}>
                {teaser}
              </Text>
            ) : null}

            {content.author ? (
              <XStack gap="$2.5" alignItems="center">
                <Avatar
                  name={content.author.full_name || content.author.username || 'Author'}
                  src={content.author.avatar_url}
                  size={40}
                />
                <YStack>
                  <Text fontSize={14} fontWeight="700" color={ui.text}>
                    {content.author.full_name || content.author.username || 'Author'}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {(content.view_count ?? 0).toLocaleString()} views
                  </Text>
                </YStack>
              </XStack>
            ) : null}

            {tags.length ? (
              <XStack gap="$2" flexWrap="wrap">
                {tags.map((tag) => (
                  <Badge key={String(tag)} tone="neutral" size="sm">
                    #{tag}
                  </Badge>
                ))}
              </XStack>
            ) : null}
          </YStack>

          {/* Article body */}
          <YStack
            gap="$4"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <CmsMarkdownBody source={content.body} format={content.body_format} />
          </YStack>

          {/* Like / engagement */}
          <YStack
            gap="$3"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              Enjoyed this post?
            </Text>
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <Button
                size="$4"
                tone={liked ? 'primary' : 'outline'}
                icon={Icons.Heart}
                onPress={() => void handleLike()}
              >
                {liked ? 'Liked' : 'Like'} · {likeCount}
              </Button>
              <Button size="$4" tone="outline" icon={Icons.MessageSquare}>
                {approvedComments.length} comments
              </Button>
            </XStack>
            {!isAuthenticated ? (
              <Text fontSize={13} color={ui.textMuted}>
                Sign in to like this post or leave a comment.
              </Text>
            ) : null}
          </YStack>

          {/* Comments */}
          <YStack
            gap="$4"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <YStack gap="$1">
              <Text fontSize={20} fontWeight="800" color={ui.text}>
                Comments
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                Approved comments appear here. New comments are reviewed in Admin CMS.
              </Text>
            </YStack>

            {!commentsEnabled ? (
              <Text color={ui.textMuted}>Comments are closed for this post.</Text>
            ) : (
              <YStack gap="$3">
                <YStack
                  gap="$3"
                  padding="$3.5"
                  borderRadius={radius.card}
                  backgroundColor={ui.surfaceMuted}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                >
                  <TextArea
                    value={commentBody}
                    onChangeText={setCommentBody}
                    placeholder={
                      isAuthenticated ? 'Write a thoughtful comment…' : 'Sign in to leave a comment'
                    }
                    minHeight={110}
                    editable={isAuthenticated}
                    backgroundColor={ui.surface}
                  />
                  <XStack gap="$2" flexWrap="wrap" justifyContent="space-between" alignItems="center">
                    {pendingNotice ? (
                      <Text fontSize={13} color={ui.textSecondary} flex={1} minWidth={180}>
                        Thanks — your comment is waiting for admin approval.
                      </Text>
                    ) : (
                      <YStack flex={1} />
                    )}
                    {isAuthenticated ? (
                      <Button
                        size="$3"
                        disabled={isCreating || !commentBody.trim()}
                        onPress={() => void handleComment()}
                      >
                        {isCreating ? 'Posting…' : 'Post comment'}
                      </Button>
                    ) : (
                      <Button size="$3" onPress={() => signIn(blogRoutes.post(content.slug))}>
                        Sign in to comment
                      </Button>
                    )}
                  </XStack>
                </YStack>

                {approvedComments.length === 0 ? (
                  <YStack
                    padding="$4"
                    alignItems="center"
                    gap="$2"
                    borderRadius={radius.card}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                  >
                    <Icons.MessageSquare size={28} color={ui.textMuted} />
                    <Text fontWeight="700" color={ui.text}>
                      No comments yet
                    </Text>
                    <Text color={ui.textMuted} textAlign="center">
                      Be the first to share your thoughts.
                    </Text>
                  </YStack>
                ) : (
                  <YStack gap="$3">
                    {approvedComments.map((comment) => (
                      <CommentRow key={comment.id} comment={comment} />
                    ))}
                  </YStack>
                )}
              </YStack>
            )}
          </YStack>

          <Button
            alignSelf="flex-start"
            tone="outline"
            icon={Icons.ArrowLeft}
            onPress={() => router.push(blogRoutes.home)}
          >
            Back to all posts
          </Button>
        </YStack>
      </YStack>
    </PageScroll>
  )
}
