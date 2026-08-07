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
    month: 'short',
    year: 'numeric',
  })
}

function CommentRow({ comment }: { comment: CmsCommentWithAuthor }) {
  const ui = useAppUi()
  const name = comment.author?.full_name || comment.author?.username || 'Member'

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      <XStack gap="$2" alignItems="center">
        <Avatar name={name} src={comment.author?.avatar_url} size={32} />
        <YStack flex={1} minWidth={0}>
          <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {name}
          </Text>
          <Text fontSize={11} color={ui.textMuted}>
            {formatDate(comment.created_at)}
          </Text>
        </YStack>
      </XStack>
      <Text fontSize={14} color={ui.text} lineHeight={20}>
        {comment.body}
      </Text>
    </YStack>
  )
}

export function BlogDetailScreen() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
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
  const teaser = content ? getContentTeaser(content, 180) : ''
  const liked = content ? !!likedContentIds[content.id] : false
  const likeCount = content
    ? (likeCounts[content.id] ?? content.like_count ?? 0)
    : 0
  const approvedComments = useMemo(
    () => comments.filter((c) => c.is_approved && !c.deleted_at),
    [comments],
  )
  const tags =
    content?.cms_content_tag_map
      ?.map((link) => link.cms_tags?.name)
      .filter(Boolean) ?? []

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
      // Reload approved-only list so pending draft does not appear publicly yet.
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
        <YStack minHeight={360} alignItems="center" justifyContent="center" gap="$2">
          <Spinner size="large" />
          <Text color={ui.textMuted}>Loading article…</Text>
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
          padding="$6"
          gap="$3"
          marginTop="$6"
        >
          <Text fontSize={22} fontWeight="800" color={ui.text}>
            Post not found
          </Text>
          <Text color={ui.textSecondary}>
            {contentError || 'This blog post may be unpublished or removed.'}
          </Text>
          <Button alignSelf="flex-start" onPress={() => router.push(blogRoutes.home)}>
            Back to Blog
          </Button>
        </YStack>
      </PageScroll>
    )
  }

  const commentsEnabled = content.allow_comments !== false

  return (
    <PageScroll>
      <YStack
        width="100%"
        maxWidth={760}
        alignSelf="center"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$5' : '$4'}
        paddingBottom={safeBottom + 48}
        gap="$5"
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
            Back to Blog
          </Text>
        </XStack>

        <YStack gap="$3">
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            {content.cms_categories?.name ? (
              <Badge tone="neutral">{content.cms_categories.name}</Badge>
            ) : null}
            {content.is_featured ? <Badge tone="brand">Featured</Badge> : null}
            <Text fontSize={13} color={ui.textMuted}>
              {formatDate(content.published_at ?? content.created_at)}
            </Text>
          </XStack>

          <Text fontSize={isDesktop ? 36 : 28} fontWeight="800" color={ui.text} letterSpacing={-0.6}>
            {content.title}
          </Text>

          {teaser ? (
            <Text fontSize={16} color={ui.textSecondary} lineHeight={24}>
              {teaser}
            </Text>
          ) : null}

          {content.author ? (
            <XStack gap="$2" alignItems="center">
              <Avatar
                name={content.author.full_name || content.author.username || 'Author'}
                src={content.author.avatar_url}
                size={36}
              />
              <Text fontSize={14} fontWeight="600" color={ui.text}>
                {content.author.full_name || content.author.username || 'Author'}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        {cover ? (
          <YStack
            borderRadius={radius.card}
            overflow="hidden"
            height={isDesktop ? 360 : 220}
            style={getShadowStyle('sm')}
          >
            <CmsCoverImage url={cover} alt={content.title} height="100%" />
          </YStack>
        ) : null}

        {tags.length ? (
          <XStack gap="$2" flexWrap="wrap">
            {tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                #{tag}
              </Badge>
            ))}
          </XStack>
        ) : null}

        <CmsMarkdownBody source={content.body} format={content.body_format} />

        <XStack
          gap="$3"
          flexWrap="wrap"
          alignItems="center"
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <Button
            size="$3"
            tone={liked ? 'primary' : 'outline'}
            icon={Icons.Heart}
            onPress={() => void handleLike()}
          >
            {liked ? 'Liked' : 'Like'} · {likeCount}
          </Button>
          <XStack gap="$1.5" alignItems="center">
            <Icons.MessageSquare size={16} color={ui.textMuted} />
            <Text fontSize={14} color={ui.textSecondary}>
              {approvedComments.length} comments
            </Text>
          </XStack>
          {!isAuthenticated ? (
            <Text fontSize={13} color={ui.textMuted}>
              Sign in to like or comment
            </Text>
          ) : null}
        </XStack>

        <YStack
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            Comments
          </Text>

          {!commentsEnabled ? (
            <Text color={ui.textMuted}>Comments are closed for this post.</Text>
          ) : (
            <>
              <YStack gap="$2">
                <TextArea
                  value={commentBody}
                  onChangeText={setCommentBody}
                  placeholder={
                    isAuthenticated
                      ? 'Share your thoughts…'
                      : 'Sign in to leave a comment'
                  }
                  minHeight={96}
                  editable={isAuthenticated}
                />
                <XStack gap="$2" flexWrap="wrap">
                  {isAuthenticated ? (
                    <Button
                      size="$3"
                      disabled={isCreating}
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
                {pendingNotice ? (
                  <Text fontSize={13} color={ui.textSecondary}>
                    Your comment was sent for moderation. Admins can approve it in CMS → Comments.
                  </Text>
                ) : null}
              </YStack>

              {approvedComments.length === 0 ? (
                <Text color={ui.textMuted}>No comments yet. Be the first to share.</Text>
              ) : (
                <YStack gap="$2">
                  {approvedComments.map((comment) => (
                    <CommentRow key={comment.id} comment={comment} />
                  ))}
                </YStack>
              )}
            </>
          )}
        </YStack>
      </YStack>
    </PageScroll>
  )
}
