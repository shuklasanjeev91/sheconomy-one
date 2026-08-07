import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'
import { PageScroll } from '~/components/layout/PageScroll'
import { usePageSeo } from '~/components/seo/RouteSeo'
import {
  Badge,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  getContentCoverUrl,
  getContentTeaser,
  loadContents,
  type CmsContentDetail,
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

function cardWidth(isDesktop: boolean, isTablet: boolean) {
  if (Platform.OS === 'web') {
    if (isDesktop) return 'calc((100% - 32px) / 3)'
    if (isTablet) return 'calc((100% - 16px) / 2)'
    return '100%'
  }
  return '100%'
}

function MetaRow({ item }: { item: CmsContentDetail }) {
  const ui = useAppUi()
  return (
    <XStack gap="$3" alignItems="center" flexWrap="wrap">
      <XStack gap="$1.5" alignItems="center">
        <Icons.Heart size={14} color={ui.textMuted} />
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          {item.like_count ?? 0}
        </Text>
      </XStack>
      <XStack gap="$1.5" alignItems="center">
        <Icons.MessageSquare size={14} color={ui.textMuted} />
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          {item.comment_count ?? 0}
        </Text>
      </XStack>
      <Text fontSize={12} color={ui.textMuted}>
        {formatDate(item.published_at ?? item.created_at)}
      </Text>
    </XStack>
  )
}

function FeaturedPost({ item, onPress }: { item: CmsContentDetail; onPress: () => void }) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const cover = getContentCoverUrl(item)
  const teaser = getContentTeaser(item, isDesktop ? 220 : 140)

  return (
    <XStack
      width="100%"
      flexDirection={isDesktop ? 'row' : 'column'}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      cursor="pointer"
      style={getShadowStyle('md')}
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.95 }}
      onPress={onPress}
    >
      <YStack
        width={isDesktop ? '48%' : '100%'}
        height={isDesktop ? 320 : 200}
        backgroundColor={ui.roseSurface}
        flexShrink={0}
      >
        {cover ? (
          <CmsCoverImage url={cover} alt={item.title} height="100%" />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icons.FileText size={48} color={ui.brand} />
          </YStack>
        )}
      </YStack>
      <YStack flex={1} gap="$3" padding={isDesktop ? '$5' : '$4'} justifyContent="center" minWidth={0}>
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Badge tone="brand">Featured</Badge>
          {item.cms_categories?.name ? (
            <Badge tone="neutral">{item.cms_categories.name}</Badge>
          ) : null}
        </XStack>
        <Text
          fontSize={isDesktop ? 30 : 24}
          fontWeight="800"
          color={ui.text}
          letterSpacing={-0.5}
          numberOfLines={3}
        >
          {item.title}
        </Text>
        {teaser ? (
          <Text fontSize={15} color={ui.textSecondary} lineHeight={22} numberOfLines={isDesktop ? 4 : 3}>
            {teaser}
          </Text>
        ) : null}
        <MetaRow item={item} />
        <XStack alignItems="center" gap="$2" marginTop="$1">
          <Text fontSize={14} fontWeight="700" color={ui.brand}>
            Read article
          </Text>
          <Icons.ArrowRight size={16} color={ui.brand} />
        </XStack>
      </YStack>
    </XStack>
  )
}

function BlogCard({
  item,
  width,
  onPress,
}: {
  item: CmsContentDetail
  width: string | number
  onPress: () => void
}) {
  const ui = useAppUi()
  const cover = getContentCoverUrl(item)
  const teaser = getContentTeaser(item, 110)

  return (
    <YStack
      width={width as any}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      cursor="pointer"
      style={getShadowStyle('sm')}
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.94 }}
      onPress={onPress}
      minHeight={320}
    >
      <YStack height={168} backgroundColor={ui.surfaceMuted} width="100%">
        {cover ? (
          <CmsCoverImage url={cover} alt={item.title} height={168} />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.roseSurface}>
            <Icons.FileText size={32} color={ui.brand} />
          </YStack>
        )}
      </YStack>
      <YStack gap="$2.5" padding="$3.5" flex={1}>
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          {item.cms_categories?.name ? (
            <Badge tone="neutral" size="sm">
              {item.cms_categories.name}
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              Blog
            </Badge>
          )}
        </XStack>
        <Text fontSize={17} fontWeight="800" color={ui.text} numberOfLines={2} letterSpacing={-0.2}>
          {item.title}
        </Text>
        {teaser ? (
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={3} lineHeight={19} flex={1}>
            {teaser}
          </Text>
        ) : (
          <YStack flex={1} />
        )}
        <XStack alignItems="center" justifyContent="space-between" gap="$2" marginTop="$1">
          <MetaRow item={item} />
          <Icons.ChevronRight size={16} color={ui.brand} />
        </XStack>
      </YStack>
    </YStack>
  )
}

export function BlogListScreen() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const ui = useAppUi()
  const { isDesktop, isTablet, safeBottom, gutter } = useAppLayout()

  const { items, contentMeta, isFetching, contentError } = useAppSelector((s) => s.cms)
  const [search, setSearch] = useState('')

  usePageSeo(
    useMemo(
      () => ({
        title: 'Blog',
        description: 'Stories, updates, and guides from SHEconomy.',
        type: 'website' as const,
      }),
      [],
    ),
  )

  useEffect(() => {
    void dispatch(
      loadContents({
        page: 1,
        limit: 12,
        type: 'post',
        status: 'published',
        order_by: 'published_at',
        ascending: false,
        search: undefined,
      }),
    )
  }, [dispatch])

  function refresh(page = 1, nextSearch = search) {
    void dispatch(
      loadContents({
        page,
        limit: 12,
        type: 'post',
        status: 'published',
        order_by: 'published_at',
        ascending: false,
        search: nextSearch.trim() || undefined,
      }),
    )
  }

  const posts = useMemo(
    () => items.filter((item) => item.status === 'published' && item.type === 'post'),
    [items],
  )
  const featured = posts.find((p) => p.is_featured) ?? null
  const gridPosts = featured ? posts.filter((p) => p.id !== featured.id) : posts
  const width = cardWidth(isDesktop, isTablet)

  function openPost(item: CmsContentDetail) {
    router.push(blogRoutes.post(item.slug))
  }

  return (
    <PageScroll onRefresh={async () => refresh(1)}>
      <YStack width="100%" backgroundColor={ui.background}>
        <YStack
          width="100%"
          backgroundColor={ui.roseSurface}
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          paddingHorizontal={gutter}
          paddingTop={isDesktop ? '$7' : '$5'}
          paddingBottom={isDesktop ? '$6' : '$4'}
        >
          <YStack width="100%" maxWidth={1120} alignSelf="center" gap="$4">
            <YStack gap="$2" maxWidth={640}>
              <Text
                fontSize={12}
                fontWeight="700"
                color={ui.brand}
                letterSpacing={1}
                textTransform="uppercase"
              >
                SHEconomy Journal
              </Text>
              <Text
                fontSize={isDesktop ? 40 : 30}
                fontWeight="800"
                color={ui.text}
                letterSpacing={-0.8}
              >
                Blog
              </Text>
              <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
                Browse all posts. Tap any story to read the full article, then like and comment.
              </Text>
            </YStack>

            <XStack
              gap="$2"
              flexWrap="wrap"
              alignItems="center"
              padding="$2"
              borderRadius={radius.card}
              backgroundColor={ui.surface}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              style={getShadowStyle('sm')}
              maxWidth={560}
              width="100%"
            >
              <Icons.Search size={18} color={ui.textMuted} />
              <Input
                flex={1}
                minWidth={160}
                value={search}
                onChangeText={setSearch}
                placeholder="Search blog posts…"
                borderWidth={0}
                backgroundColor="transparent"
                onSubmitEditing={() => refresh(1)}
              />
              <Button size="$3" onPress={() => refresh(1)}>
                Search
              </Button>
              {search.trim() ? (
                <Button
                  size="$3"
                  tone="outline"
                  onPress={() => {
                    setSearch('')
                    refresh(1, '')
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </XStack>
          </YStack>
        </YStack>

        <YStack
          width="100%"
          maxWidth={1120}
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingTop={isDesktop ? '$6' : '$4'}
          paddingBottom={safeBottom + 48}
          gap="$5"
        >
          {contentError ? <Text color={ui.error}>{contentError}</Text> : null}

          {isFetching && posts.length === 0 ? (
            <YStack minHeight={300} alignItems="center" justifyContent="center" gap="$2">
              <Spinner size="large" />
              <Text color={ui.textMuted}>Loading blog posts…</Text>
            </YStack>
          ) : posts.length === 0 ? (
            <YStack
              minHeight={260}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              padding="$6"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Icons.FileText size={42} color={ui.textMuted} />
              <Text fontSize={18} fontWeight="700" color={ui.text}>
                No blog posts yet
              </Text>
              <Text color={ui.textMuted} textAlign="center" maxWidth={360}>
                When an admin publishes a post in CMS, it will show up here.
              </Text>
            </YStack>
          ) : (
            <>
              {featured && !search.trim() ? (
                <YStack gap="$3">
                  <Text fontSize={13} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
                    FEATURED
                  </Text>
                  <FeaturedPost item={featured} onPress={() => openPost(featured)} />
                </YStack>
              ) : null}

              <YStack gap="$3">
                <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
                  <Text fontSize={18} fontWeight="800" color={ui.text}>
                    {search.trim() ? 'Search results' : 'All posts'}
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    {contentMeta.total} {contentMeta.total === 1 ? 'post' : 'posts'}
                  </Text>
                </XStack>

                <XStack gap="$4" flexWrap="wrap" width="100%">
                  {(search.trim() ? posts : gridPosts).map((item) => (
                    <BlogCard
                      key={item.id}
                      item={item}
                      width={width}
                      onPress={() => openPost(item)}
                    />
                  ))}
                </XStack>
              </YStack>
            </>
          )}

          {contentMeta.totalPages > 1 ? (
            <XStack
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap="$3"
              paddingTop="$2"
            >
              <Text fontSize={13} color={ui.textMuted}>
                Page {contentMeta.page} of {contentMeta.totalPages}
              </Text>
              <XStack gap="$2">
                <Button
                  size="$3"
                  tone="outline"
                  disabled={!contentMeta.hasPrevPage || isFetching}
                  onPress={() => refresh(contentMeta.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="$3"
                  tone="outline"
                  disabled={!contentMeta.hasNextPage || isFetching}
                  onPress={() => refresh(contentMeta.page + 1)}
                >
                  Next
                </Button>
              </XStack>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    </PageScroll>
  )
}
