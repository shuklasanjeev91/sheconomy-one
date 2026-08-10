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
import { useBlogCoverSize } from '~/blog/lib/useBlogCoverSize'
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
  Separator,
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
  const { isDesktop, isTablet, safeBottom, gutter, mobileTabBarOffset } = useAppLayout()
  const { isAuthenticated } = useAuth()
  const slug = (slugProp || '').trim()
  const articleMax = isDesktop ? 760 : isTablet ? 680 : 640
  const coverSize = useBlogCoverSize(articleMax)

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
      <YStack 
        width="100%" 
        backgroundColor={ui.background} 
        paddingBottom={bottomPad}
      >
        {/* Enhanced Breadcrumb */}
        <YStack
          width="100%"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          paddingVertical="$3"
          paddingHorizontal={gutter}
        >
          <XStack
            maxWidth={articleMax}
            width="100%"
            alignSelf="center"
            alignItems="center"
            gap="$2"
            flexWrap="wrap"
          >
            <AppLink href={commerceRoutes.home}>
              <Text fontSize={13} color={ui.textMuted} hoverColor={ui.text}>
                Home
              </Text>
            </AppLink>
            <Icons.ChevronRight size={12} color={ui.textMuted} />
            <AppLink href={blogRoutes.home}>
              <Text fontSize={13} color={ui.textMuted} hoverColor={ui.text}>
                Blog
              </Text>
            </AppLink>
            {content.cms_categories?.name ? (
              <>
                <Icons.ChevronRight size={12} color={ui.textMuted} />
                <Text fontSize={13} color={ui.textSecondary} numberOfLines={1}>
                  {content.cms_categories.name}
                </Text>
              </>
            ) : null}
          </XStack>
        </YStack>

        {/* Article column */}
        <YStack
          width="100%"
          maxWidth={articleMax}
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingTop={isDesktop ? '$8' : '$6'}
          gap="$5"
        >
          {/* Header Section */}
          <YStack gap="$4" width="100%">
            {/* Category Badges */}
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              {content.cms_categories?.name ? (
                <Badge 
                  tone="brand" 
                  size="sm"
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                  }}
                >
                  {content.cms_categories.name}
                </Badge>
              ) : null}
              {content.is_featured ? (
                <Badge 
                  tone="neutral" 
                  size="sm"
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                  }}
                >
                  Featured
                </Badge>
              ) : null}
            </XStack>

            {/* Title */}
            <Text
              fontSize={isDesktop ? 40 : 28}
              fontWeight="800"
              color={ui.text}
              letterSpacing={-0.5}
              lineHeight={isDesktop ? 48 : 36}
            >
              {content.title}
            </Text>

            {/* Teaser */}
            {teaser ? (
              <Text 
                fontSize={isDesktop ? 20 : 16} 
                color={ui.textSecondary} 
                lineHeight={28}
                fontWeight="400"
              >
                {teaser}
              </Text>
            ) : null}

            {/* Author & Metadata */}
            <XStack
              gap="$4"
              flexWrap="wrap"
              alignItems="center"
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor={ui.borderSubtle}
              paddingBottom="$4"
            >
              <XStack gap="$3" alignItems="center" flex={1} minWidth={200}>
                <Avatar 
                  name={authorName} 
                  src={content.author?.avatar_url} 
                  size={48}
                  style={{
                    borderWidth: 2,
                    borderColor: ui.borderSubtle,
                  }}
                />
                <YStack flex={1} minWidth={0}>
                  <Text 
                    fontSize={15} 
                    fontWeight="700" 
                    color={ui.text}
                    numberOfLines={1}
                  >
                    {authorName}
                  </Text>
                  <XStack gap="$2" alignItems="center">
                    <Text fontSize={13} color={ui.textMuted}>
                      {formatBlogDate(content.published_at ?? content.created_at, 'long')}
                    </Text>
                    <Text fontSize={13} color={ui.textMuted}>·</Text>
                    <XStack gap="$1" alignItems="center">
                      <Icons.Clock size={14} color={ui.textMuted} />
                      <Text fontSize={13} color={ui.textMuted}>
                        {readTime} min read
                      </Text>
                    </XStack>
                  </XStack>
                </YStack>
              </XStack>
              
              {/* Stats */}
              <XStack gap="$4" alignItems="center" flexWrap="wrap">
                <XStack gap="$1.5" alignItems="center">
                  <Icons.Eye size={16} color={ui.textMuted} />
                  <Text fontSize={14} color={ui.textMuted}>
                    {formatCount(content.view_count ?? 0)}
                  </Text>
                </XStack>
                {content.like_count !== undefined && (
                  <XStack gap="$1.5" alignItems="center">
                    <Icons.Heart size={16} color={ui.textMuted} />
                    <Text fontSize={14} color={ui.textMuted}>
                      {formatCount(content.like_count)}
                    </Text>
                  </XStack>
                )}
                {content.comment_count !== undefined && (
                  <XStack gap="$1.5" alignItems="center">
                    <Icons.MessageCircle size={16} color={ui.textMuted} />
                    <Text fontSize={14} color={ui.textMuted}>
                      {formatCount(content.comment_count)}
                    </Text>
                  </XStack>
                )}
              </XStack>
            </XStack>
          </YStack>

          {/* Cover Image - Enhanced */}
          {cover ? (
            <YStack
              width="100%"
              maxWidth={coverSize.width}
              height={coverSize.height}
              alignSelf="center"
              borderRadius={radius.card}
              overflow="hidden"
              backgroundColor={ui.surfaceMuted}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              style={{
                ...getShadowStyle('md'),
                position: 'relative',
              }}
            >
              <CmsCoverImage
                url={cover}
                alt={content.title}
                width="100%"
                height={coverSize.height}
                style={{
                  objectFit: 'cover',
                }}
              />
              {/* Optional overlay gradient */}
              <YStack
                position="absolute"
                bottom={0}
                left={0}
                right={0}
                height="30%"
                style={{
                  background: `linear-gradient(transparent, ${ui.background}80)`,
                }}
              />
            </YStack>
          ) : null}

          {/* Tags */}
          {tags.length ? (
            <XStack gap="$2" flexWrap="wrap" paddingVertical="$2">
              {tags.map((tag) =>
                tag ? (
                  <Badge 
                    key={tag.id} 
                    tone="neutral" 
                    size="sm"
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 12,
                      borderRadius: 20,
                    }}
                  >
                    #{tag.name}
                  </Badge>
                ) : null,
              )}
            </XStack>
          ) : null}

          <Separator />

          {/* Article body - Enhanced */}
          <YStack
            width="100%"
            maxWidth="100%"
            overflow="hidden"
            paddingVertical="$2"
            gap="$3"
          >
            <Text
              fontSize={11}
              fontWeight="700"
              color={ui.textMuted}
              letterSpacing={1.2}
              textTransform="uppercase"
            >
              Article
            </Text>
            <BlogPostContent body={content.body} format={content.body_format} />
          </YStack>

          {/* Divider */}
          <Separator />

          {/* Action Bar - Enhanced */}
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap="$4"
            paddingVertical="$4"
          >
            <XStack gap="$3" flexWrap="wrap">
              <BlogLikeButton
                contentId={content.id}
                slug={content.slug}
                initialCount={content.like_count ?? 0}
              />
              <BlogShareButton title={content.title} slug={content.slug} />
            </XStack>
            <Button
              size="$3"
              tone="outline"
              icon={Icons.ArrowLeft}
              onPress={() => router.push(blogRoutes.home)}
            >
              All Articles
            </Button>
          </XStack>

          {/* Comments Section - Enhanced */}
          {content.allow_comments !== false ? (
            <YStack
              width="100%"
              padding={isDesktop ? '$6' : '$5'}
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              style={{
                ...getShadowStyle('sm'),
                marginTop: '$4',
              }}
            >
              <XStack alignItems="center" gap="$2" marginBottom="$4">
                <Icons.MessageCircle size={20} color={ui.text} />
                <Text fontSize={18} fontWeight="700" color={ui.text}>
                  Comments
                </Text>
                {content.comment_count !== undefined && content.comment_count > 0 && (
                  <Badge 
                    tone="neutral" 
                    size="sm"
                    style={{
                      paddingVertical: 2,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                    }}
                  >
                    {content.comment_count}
                  </Badge>
                )}
              </XStack>
              <BlogCommentSection
                contentId={content.id}
                slug={content.slug}
                commentCount={content.comment_count ?? 0}
              />
            </YStack>
          ) : null}
        </YStack>

        {/* Related Articles - Enhanced */}
        {related.length ? (
          <YStack
            width="100%"
            maxWidth={1120}
            alignSelf="center"
            paddingHorizontal={gutter}
            paddingTop="$10"
            paddingBottom="$6"
            gap="$5"
          >
            <YStack gap="$2">
              <Text fontSize={24} fontWeight="800" color={ui.text}>
                Related Articles
              </Text>
              <Text fontSize={15} color={ui.textSecondary}>
                Continue your learning journey with these related posts
              </Text>
            </YStack>
            <BlogPostsGrid>
              {related.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </BlogPostsGrid>
          </YStack>
        ) : null}
      </YStack>
    </PageScroll>
  )
}