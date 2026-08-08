import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'one'

import { BlogCard } from '~/blog/components/BlogCard'
import { BlogPostsGrid } from '~/blog/components/BlogPostsGrid'
import { BlogCommentSection } from '~/blog/components/BlogCommentSection'
import { BlogLikeButton } from '~/blog/components/BlogLikeButton'
import { BlogPostContent } from '~/blog/components/BlogPostContent'
import { BlogPostSkeleton } from '~/blog/components/BlogSkeletons'
import { BlogShareButton } from '~/blog/components/BlogShareButton'
import { estimateReadTime, formatBlogDate, formatCount } from '~/blog/lib/blog-utils'
import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'
import { AppLink } from '~/components/navigation/AppLink'
import { PageScroll } from '~/components/layout/PageScroll'
import { usePageSeo } from '~/components/seo/RouteSeo'
import {
  Avatar,
  Badge,
  Button,
  Icons,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuth } from '~/hooks/useAuth'
import {
  checkLike,
  getContentCoverUrl,
  getContentTeaser,
  incrementViewCount,
  listContents,
  loadContentBySlug,
  type CmsContentDetail,
} from '~/lib/cms'
import { blogRoutes, commerceRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

function isReadablePost(post: CmsContentDetail | null | undefined, slug: string) {
  if (!post || !slug) return false
  if (post.slug !== slug) return false
  if (post.deleted_at) return false
  return post.status === 'published'
}

export function BlogDetailScreen({ slug: slugProp }: { slug?: string }) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const ui = useAppUi()
  const { isDesktop, safeBottom, gutter, mobileTabBarOffset } = useAppLayout()
  const { isAuthenticated } = useAuth()
  const slug = (slugProp || '').trim()

  const { currentContent, items, contentError } = useAppSelector((s) => s.cms)
  const [related, setRelated] = useState<CmsContentDetail[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [viewTracked, setViewTracked] = useState(false)
  const requestId = useRef(0)

  const cachedFromList = useMemo(
    () => items.find((p) => p.slug === slug && p.status === 'published') ?? null,
    [items, slug],
  )

  const content = useMemo(() => {
    if (isReadablePost(currentContent, slug)) return currentContent as CmsContentDetail
    if (isReadablePost(cachedFromList, slug)) return cachedFromList as CmsContentDetail
    return null
  }, [currentContent, cachedFromList, slug])

  useEffect(() => {
    if (!slug) {
      setLoadState('done')
      return
    }
    const id = ++requestId.current
    setLoadState('loading')
    setViewTracked(false)
    void dispatch(loadContentBySlug(slug))
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        if (requestId.current === id) setLoadState('done')
      })
  }, [dispatch, slug])

  useEffect(() => {
    if (!content?.id || viewTracked) return
    void incrementViewCount(content.id)
    setViewTracked(true)
  }, [content?.id, viewTracked])

  useEffect(() => {
    if (content?.id && isAuthenticated) {
      void dispatch(checkLike(content.id))
    }
  }, [content?.id, dispatch, isAuthenticated])

  useEffect(() => {
    let cancelled = false
    async function loadRelated() {
      if (!content?.category_id) {
        setRelated([])
        return
      }
      const result = await listContents({
        type: 'post',
        status: 'published',
        category_id: content.category_id,
        limit: 4,
        order_by: 'published_at',
        ascending: false,
      })
      if (cancelled || !result.success || !result.data) return
      setRelated(result.data.filter((p) => p.id !== content.id).slice(0, 3))
    }
    void loadRelated()
    return () => {
      cancelled = true
    }
  }, [content?.id, content?.category_id])

  const coverHeight = isDesktop ? 360 : 200
  const cover = content ? getContentCoverUrl(content) : ''
  const teaser = content ? getContentTeaser(content, 220) : ''
  const tags =
    content?.cms_content_tag_map?.map((link) => link.cms_tags).filter(Boolean) ?? []
  const readTime = estimateReadTime(content?.body || '')
  const authorName =
    content?.author?.full_name || content?.author?.username || 'SHEconomy Team'

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

  const bottomPad = safeBottom + (isDesktop ? 48 : mobileTabBarOffset + 24)

  if (!content && loadState !== 'done') {
    return (
      <PageScroll>
        <YStack paddingHorizontal={gutter} width="100%">
          <BlogPostSkeleton />
        </YStack>
      </PageScroll>
    )
  }

  if (!content) {
    return (
      <PageScroll>
        <YStack
          maxWidth={720}
          width="100%"
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingVertical="$10"
          alignItems="center"
          gap="$3"
        >
          <Icons.FileText size={48} color={ui.textMuted} />
          <Text fontSize={24} fontWeight="800" color={ui.text}>
            Post not found
          </Text>
          <Text color={ui.textSecondary} textAlign="center">
            {contentError ||
              (!slug
                ? 'Missing article link.'
                : 'This article does not exist or has been removed.')}
          </Text>
          <Button icon={Icons.ArrowLeft} onPress={() => router.push(blogRoutes.home)}>
            Back to Blog
          </Button>
        </YStack>
      </PageScroll>
    )
  }

  return (
    <PageScroll>
      <YStack width="100%" backgroundColor={ui.background} paddingBottom={bottomPad}>
        <YStack
          width="100%"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          paddingVertical="$3"
          paddingHorizontal={gutter}
        >
          <XStack
            maxWidth={860}
            width="100%"
            alignSelf="center"
            alignItems="center"
            gap="$2"
            flexWrap="wrap"
          >
            <AppLink href={commerceRoutes.home}>
              <Text fontSize={13} color={ui.textMuted}>
                Home
              </Text>
            </AppLink>
            <Icons.ChevronRight size={12} color={ui.textMuted} />
            <AppLink href={blogRoutes.home}>
              <Text fontSize={13} color={ui.textMuted}>
                Blog
              </Text>
            </AppLink>
            {content.cms_categories?.name ? (
              <>
                <Icons.ChevronRight size={12} color={ui.textMuted} />
                <Text fontSize={13} color={ui.textMuted}>
                  {content.cms_categories.name}
                </Text>
              </>
            ) : null}
            <Icons.ChevronRight size={12} color={ui.textMuted} />
            <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1} flexShrink={1}>
              {content.title}
            </Text>
          </XStack>
        </YStack>

        <YStack
          width="100%"
          maxWidth={860}
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingTop={isDesktop ? '$6' : '$4'}
          gap="$5"
        >
          <YStack gap="$3" width="100%">
            {content.cms_categories?.name ? (
              <Badge tone="brand" alignSelf="flex-start">
                {content.cms_categories.name}
              </Badge>
            ) : null}

            <Text
              fontSize={isDesktop ? 40 : 28}
              fontWeight="800"
              color={ui.text}
              letterSpacing={-0.5}
              lineHeight={isDesktop ? 48 : 34}
            >
              {content.title}
            </Text>

            {teaser ? (
              <Text fontSize={isDesktop ? 18 : 16} color={ui.textSecondary} lineHeight={26}>
                {teaser}
              </Text>
            ) : null}

            <XStack gap="$4" flexWrap="wrap" alignItems="center" marginTop="$1">
              <XStack gap="$2.5" alignItems="center">
                <Avatar name={authorName} src={content.author?.avatar_url} size={40} />
                <YStack>
                  <Text fontSize={14} fontWeight="700" color={ui.text}>
                    {authorName}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {formatBlogDate(content.published_at ?? content.created_at, 'long')}
                  </Text>
                </YStack>
              </XStack>
              <XStack gap="$3" alignItems="center">
                <XStack gap="$1.5" alignItems="center">
                  <Icons.Clock size={14} color={ui.textMuted} />
                  <Text fontSize={13} color={ui.textMuted}>
                    {readTime} min read
                  </Text>
                </XStack>
                <XStack gap="$1.5" alignItems="center">
                  <Icons.Eye size={14} color={ui.textMuted} />
                  <Text fontSize={13} color={ui.textMuted}>
                    {formatCount(content.view_count ?? 0)} views
                  </Text>
                </XStack>
              </XStack>
            </XStack>
          </YStack>

          {cover ? (
            <YStack
              width="100%"
              height={coverHeight}
              borderRadius={radius.card}
              overflow="hidden"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              style={getShadowStyle('sm')}
            >
              <CmsCoverImage url={cover} alt={content.title} width="100%" height={coverHeight} />
            </YStack>
          ) : null}

          {tags.length ? (
            <XStack gap="$2" flexWrap="wrap">
              {tags.map((tag) =>
                tag ? (
                  <Badge key={tag.id} tone="neutral" size="sm">
                    #{tag.name}
                  </Badge>
                ) : null,
              )}
            </XStack>
          ) : null}

          <YStack
            width="100%"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <BlogPostContent body={content.body} format={content.body_format} />
          </YStack>

          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap="$3"
            paddingVertical="$3"
            borderTopWidth={1}
            borderBottomWidth={1}
            borderColor={ui.borderSubtle}
          >
            <XStack gap="$2" flexWrap="wrap">
              <BlogLikeButton
                contentId={content.id}
                slug={content.slug}
                initialCount={content.like_count ?? 0}
              />
              <BlogShareButton title={content.title} slug={content.slug} />
            </XStack>
            <Button
              size="$3"
              tone="ghost"
              icon={Icons.ArrowLeft}
              onPress={() => router.push(blogRoutes.home)}
            >
              All Articles
            </Button>
          </XStack>

          {content.allow_comments !== false ? (
            <YStack
              width="100%"
              padding={isDesktop ? '$5' : '$4'}
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <BlogCommentSection
                contentId={content.id}
                slug={content.slug}
                commentCount={content.comment_count ?? 0}
              />
            </YStack>
          ) : null}

          {related.length ? (
            <YStack gap="$4" marginTop="$2" width="100%">
              <Text fontSize={22} fontWeight="800" color={ui.text}>
                Related Articles
              </Text>
              <BlogPostsGrid>
                {related.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </BlogPostsGrid>
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    </PageScroll>
  )
}
