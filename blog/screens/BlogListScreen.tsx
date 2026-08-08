import { useCallback, useEffect, useMemo, useState } from 'react'

import { BlogCard, blogCardColumnWidth } from '~/blog/components/BlogCard'
import { BlogCategoryFilter } from '~/blog/components/BlogCategoryFilter'
import { BlogFeaturedCard } from '~/blog/components/BlogFeaturedCard'
import { BlogPagination } from '~/blog/components/BlogPagination'
import { BlogSearch } from '~/blog/components/BlogSearch'
import { BlogFeaturedSkeleton, BlogListSkeleton } from '~/blog/components/BlogSkeletons'
import { BlogSortSelect } from '~/blog/components/BlogSortSelect'
import { BlogTagFilter } from '~/blog/components/BlogTagFilter'
import { parseBlogSort } from '~/blog/lib/blog-utils'
import { PageScroll } from '~/components/layout/PageScroll'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { AppBottomSheet, Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { loadCategories, loadContents, loadTags } from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

const POSTS_PER_PAGE = 9

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      borderRadius={radius.pill}
      backgroundColor={ui.roseSurface}
    >
      <Text fontSize={12} fontWeight="600" color={ui.brand}>
        {label}
      </Text>
      <XStack cursor="pointer" onPress={onRemove} pressStyle={{ opacity: 0.7 }}>
        <Icons.X size={12} color={ui.brand} />
      </XStack>
    </XStack>
  )
}

export function BlogListScreen() {
  const dispatch = useAppDispatch()
  const ui = useAppUi()
  const { isDesktop, isTablet, safeBottom, gutter } = useAppLayout()
  const cardWidth = blogCardColumnWidth(isDesktop, isTablet)

  const { items, contentMeta, isFetching, categories, tags, contentError } = useAppSelector(
    (s) => s.cms,
  )

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [sort, setSort] = useState('published_at:desc')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { order_by, ascending } = useMemo(() => parseBlogSort(sort), [sort])

  usePageSeo(
    useMemo(
      () => ({
        title: 'Blog | SHEconomy',
        description: 'Insights, stories, and resources for women building a new economy.',
        type: 'website' as const,
      }),
      [],
    ),
  )

  useEffect(() => {
    void dispatch(loadCategories())
    void dispatch(loadTags())
  }, [dispatch])

  useEffect(() => {
    void dispatch(
      loadContents({
        replaceFilters: true,
        type: 'post',
        status: 'published',
        search: search.trim() || undefined,
        category_id: categoryId || undefined,
        tag_ids: activeTags.length ? activeTags : undefined,
        order_by,
        ascending,
        page,
        limit: POSTS_PER_PAGE,
        author_id: undefined,
        vendor_id: undefined,
        is_featured: undefined,
      }),
    )
  }, [dispatch, search, categoryId, activeTags, order_by, ascending, page])

  const handleSearch = useCallback((val: string) => {
    setSearch(val)
    setPage(1)
  }, [])

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id)
    setPage(1)
  }, [])

  const handleTagToggle = useCallback((tagId: string) => {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
    setPage(1)
  }, [])

  const handleSort = useCallback((val: string) => {
    setSort(val)
    setPage(1)
  }, [])

  const handleClearAll = useCallback(() => {
    setSearch('')
    setCategoryId('')
    setActiveTags([])
    setSort('published_at:desc')
    setPage(1)
  }, [])

  const hasFilters =
    !!search || !!categoryId || activeTags.length > 0 || sort !== 'published_at:desc'

  const featuredPost =
    !hasFilters && page === 1 ? (items.find((p) => p.is_featured) ?? null) : null
  const regularPosts = featuredPost ? items.filter((p) => p.id !== featuredPost.id) : items

  const filterPanel = (
    <YStack gap="$5">
      <BlogCategoryFilter
        categories={categories}
        activeCategory={categoryId}
        onSelect={handleCategorySelect}
      />
      <BlogTagFilter tags={tags} activeTags={activeTags} onToggle={handleTagToggle} />
      {hasFilters ? (
        <Button size="$3" tone="outline" icon={Icons.X} onPress={handleClearAll}>
          Clear all filters
        </Button>
      ) : null}
    </YStack>
  )

  return (
    <PageScroll
      onRefresh={async () => {
        setPage(1)
        void dispatch(
          loadContents({
            replaceFilters: true,
            type: 'post',
            status: 'published',
            search: search.trim() || undefined,
            category_id: categoryId || undefined,
            tag_ids: activeTags.length ? activeTags : undefined,
            order_by,
            ascending,
            page: 1,
            limit: POSTS_PER_PAGE,
          }),
        )
      }}
    >
      <YStack
        width="100%"
        minHeight="100%"
        backgroundColor={ui.background}
        paddingBottom={safeBottom + 48}
      >
        <YStack
          width="100%"
          maxWidth={1120}
          alignSelf="center"
          paddingHorizontal={gutter}
          paddingTop={isDesktop ? '$8' : '$5'}
          gap="$5"
        >
          {/* Header — matches sheconomy_web blogs */}
          <YStack alignItems="center" gap="$2" marginBottom="$2">
            <Text
              fontSize={isDesktop ? 42 : 30}
              fontWeight="800"
              color={ui.brand}
              textAlign="center"
              letterSpacing={-0.6}
            >
              SHEconomy Blog
            </Text>
            <Text
              fontSize={isDesktop ? 17 : 15}
              color={ui.textSecondary}
              textAlign="center"
              maxWidth={560}
              lineHeight={24}
            >
              Insights, stories, and resources for women building a new economy
            </Text>
            <YStack
              width={96}
              height={4}
              borderRadius={999}
              backgroundColor={ui.brand}
              marginTop="$2"
            />
          </YStack>

          {/* Search + filters toggle */}
          <XStack gap="$3" flexWrap="wrap" alignItems="center" justifyContent="center">
            <BlogSearch value={search} onSearch={handleSearch} />
            {!isDesktop ? (
              <Button
                size="$3"
                tone="outline"
                icon={Icons.SlidersHorizontal}
                onPress={() => setFiltersOpen(true)}
              >
                Filters
                {categoryId || activeTags.length
                  ? ` (${(categoryId ? 1 : 0) + activeTags.length})`
                  : ''}
              </Button>
            ) : null}
          </XStack>

          <YStack gap="$2" alignItems="center">
            <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
              Sort by
            </Text>
            <BlogSortSelect value={sort} onSort={handleSort} />
          </YStack>

          {/* Desktop filters */}
          {isDesktop ? (
            <YStack gap="$4">
              <BlogCategoryFilter
                categories={categories}
                activeCategory={categoryId}
                onSelect={handleCategorySelect}
              />
              <BlogTagFilter tags={tags} activeTags={activeTags} onToggle={handleTagToggle} />
            </YStack>
          ) : null}

          {/* Active filter chips */}
          {hasFilters ? (
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <Text fontSize={13} color={ui.textMuted}>
                Showing:
              </Text>
              {search ? (
                <FilterChip label={`“${search}”`} onRemove={() => handleSearch('')} />
              ) : null}
              {categoryId ? (
                <FilterChip
                  label={categories.find((c) => c.id === categoryId)?.name || 'Category'}
                  onRemove={() => handleCategorySelect('')}
                />
              ) : null}
              {activeTags.map((tid) => {
                const tag = tags.find((t) => t.id === tid)
                return tag ? (
                  <FilterChip
                    key={tid}
                    label={`#${tag.name}`}
                    onRemove={() => handleTagToggle(tid)}
                  />
                ) : null
              })}
              <Button size="$2" tone="ghost" onPress={handleClearAll}>
                Clear all
              </Button>
            </XStack>
          ) : null}

          {contentError ? <Text color={ui.error}>{contentError}</Text> : null}

          {/* Featured */}
          {featuredPost ? (
            <YStack marginBottom="$2">
              {isFetching && items.length === 0 ? (
                <BlogFeaturedSkeleton />
              ) : (
                <BlogFeaturedCard post={featuredPost} />
              )}
            </YStack>
          ) : null}

          {/* Grid */}
          {isFetching && items.length === 0 ? (
            <BlogListSkeleton count={POSTS_PER_PAGE} />
          ) : regularPosts.length === 0 ? (
            <YStack
              alignItems="center"
              justifyContent="center"
              gap="$3"
              paddingVertical="$10"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Icons.Search size={40} color={ui.textMuted} />
              <Text fontSize={20} fontWeight="700" color={ui.text}>
                No articles found
              </Text>
              <Text color={ui.textMuted} textAlign="center" maxWidth={360}>
                {hasFilters
                  ? 'Try adjusting your search or filters'
                  : 'Blog posts will appear here once published'}
              </Text>
              {hasFilters ? (
                <Button size="$3" tone="outline" onPress={handleClearAll}>
                  Clear filters
                </Button>
              ) : null}
            </YStack>
          ) : (
            <YStack gap="$6">
              <XStack gap="$4" flexWrap="wrap" width="100%" alignItems="stretch">
                {regularPosts.map((post) => (
                  <YStack
                    key={post.id}
                    width={cardWidth as any}
                    flexShrink={0}
                    maxWidth="100%"
                  >
                    <BlogCard post={post} />
                  </YStack>
                ))}
              </XStack>
              <BlogPagination
                meta={contentMeta}
                onPageChange={(p) => {
                  setPage(p)
                }}
              />
            </YStack>
          )}

          {isFetching && items.length > 0 ? (
            <XStack
              alignSelf="center"
              alignItems="center"
              gap="$2"
              paddingHorizontal="$4"
              paddingVertical="$2.5"
              borderRadius={radius.pill}
              backgroundColor={ui.surface}
              borderWidth={1}
              borderColor={ui.borderSubtle}
            >
              <Spinner size="small" />
              <Text fontSize={13} color={ui.textMuted}>
                Loading…
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </YStack>

      <AppBottomSheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters" scrollable>
        <YStack padding="$4">{filterPanel}</YStack>
      </AppBottomSheet>
    </PageScroll>
  )
}
