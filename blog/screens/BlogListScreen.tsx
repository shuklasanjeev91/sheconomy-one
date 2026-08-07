import { useEffect, useMemo, useState } from 'react'
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

function BlogCard({
  item,
  isDesktop,
  onPress,
}: {
  item: CmsContentDetail
  isDesktop: boolean
  onPress: () => void
}) {
  const ui = useAppUi()
  const cover = getContentCoverUrl(item)
  const teaser = getContentTeaser(item, isDesktop ? 180 : 120)

  return (
    <YStack
      flex={isDesktop ? 1 : undefined}
      minWidth={isDesktop ? 280 : '100%'}
      maxWidth={isDesktop ? 360 : '100%'}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      cursor="pointer"
      style={getShadowStyle('sm')}
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.92 }}
      onPress={onPress}
    >
      <YStack height={180} backgroundColor={ui.surfaceMuted}>
        {cover ? (
          <CmsCoverImage url={cover} alt={item.title} height={180} />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icons.FileText size={36} color={ui.textMuted} />
          </YStack>
        )}
      </YStack>
      <YStack gap="$2" padding="$3.5">
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          {item.is_featured ? <Badge tone="brand">Featured</Badge> : null}
          {item.cms_categories?.name ? (
            <Badge tone="neutral">{item.cms_categories.name}</Badge>
          ) : null}
          <Text fontSize={12} color={ui.textMuted}>
            {formatDate(item.published_at ?? item.created_at)}
          </Text>
        </XStack>
        <Text fontSize={18} fontWeight="800" color={ui.text} numberOfLines={2}>
          {item.title}
        </Text>
        {teaser ? (
          <Text fontSize={14} color={ui.textSecondary} numberOfLines={3} lineHeight={20}>
            {teaser}
          </Text>
        ) : null}
        <XStack gap="$3" alignItems="center" marginTop="$1">
          <XStack gap="$1" alignItems="center">
            <Icons.Heart size={14} color={ui.textMuted} />
            <Text fontSize={12} color={ui.textMuted}>
              {item.like_count ?? 0}
            </Text>
          </XStack>
          <XStack gap="$1" alignItems="center">
            <Icons.MessageSquare size={14} color={ui.textMuted} />
            <Text fontSize={12} color={ui.textMuted}>
              {item.comment_count ?? 0}
            </Text>
          </XStack>
          <Text fontSize={13} fontWeight="700" color={ui.brand} marginLeft="auto">
            Read more
          </Text>
        </XStack>
      </YStack>
    </YStack>
  )
}

export function BlogListScreen() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

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

  function refresh(page = 1) {
    void dispatch(
      loadContents({
        page,
        limit: 12,
        type: 'post',
        status: 'published',
        order_by: 'published_at',
        ascending: false,
        search: search.trim() || undefined,
      }),
    )
  }

  const posts = items.filter((item) => item.status === 'published')

  return (
    <PageScroll onRefresh={async () => refresh(1)}>
      <YStack
        width="100%"
        maxWidth={1120}
        alignSelf="center"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={safeBottom + 40}
        gap="$5"
      >
        <YStack gap="$2">
          <Text fontSize={isDesktop ? 34 : 28} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            Blog
          </Text>
          <Text fontSize={15} color={ui.textSecondary} maxWidth={560}>
            Ideas, guides, and updates from women builders and sellers on SHEconomy.
          </Text>
        </YStack>

        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Input
            flex={1}
            minWidth={220}
            value={search}
            onChangeText={setSearch}
            placeholder="Search posts…"
            onSubmitEditing={() => refresh(1)}
          />
          <Button size="$3" onPress={() => refresh(1)}>
            Search
          </Button>
          {search ? (
            <Button
              size="$3"
              tone="outline"
              onPress={() => {
                setSearch('')
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
              }}
            >
              Clear
            </Button>
          ) : null}
        </XStack>

        {contentError ? <Text color={ui.error}>{contentError}</Text> : null}

        {isFetching && posts.length === 0 ? (
          <YStack minHeight={280} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading posts…</Text>
          </YStack>
        ) : posts.length === 0 ? (
          <YStack
            minHeight={240}
            alignItems="center"
            justifyContent="center"
            gap="$2"
            padding="$6"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
          >
            <Icons.FileText size={40} color={ui.textMuted} />
            <Text fontSize={18} fontWeight="700" color={ui.text}>
              No posts yet
            </Text>
            <Text color={ui.textMuted} textAlign="center">
              Published blog posts will appear here.
            </Text>
          </YStack>
        ) : (
          <XStack gap="$4" flexWrap="wrap">
            {posts.map((item) => (
              <BlogCard
                key={item.id}
                item={item}
                isDesktop={isDesktop}
                onPress={() => router.push(blogRoutes.post(item.slug))}
              />
            ))}
          </XStack>
        )}

        {contentMeta.totalPages > 1 ? (
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={ui.textMuted}>
              Page {contentMeta.page} of {contentMeta.totalPages}
            </Text>
            <XStack gap="$2">
              <Button
                size="$2"
                tone="outline"
                disabled={!contentMeta.hasPrevPage || isFetching}
                onPress={() => refresh(contentMeta.page - 1)}
              >
                Previous
              </Button>
              <Button
                size="$2"
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
    </PageScroll>
  )
}
