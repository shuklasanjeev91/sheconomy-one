import { usePathname } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import { ContinueLearningRail } from '~/class/components/ContinueLearningRail'
import { MyPlaylistsRail } from '~/class/components/MyPlaylistsRail'
import { SavedProgramsRail } from '~/class/components/SavedProgramsRail'
import { ProgramCard } from '~/class/components/ProgramCard'
import { ProgramCategoryRow } from '~/class/components/ProgramCategoryRow'
import {
  collectProgramLanguages,
  formatProgramLanguage,
} from '~/class/lib/languages'
import {
  fetchProgramCategories,
  fetchPublishedPrograms,
  fetchPublishedProgramsPage,
  groupProgramsByCategory,
  PROGRAM_PAGE_SIZE,
  type Program,
  type ProgramCategory,
} from '~/class/lib/programs'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useMedia } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { mediaTabFromPath, type MediaTab } from '~/class/lib/media-tab'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramSort = 'default' | 'popular' | 'newest' | 'az'

export function ClassesScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const pathname = usePathname()
  const mediaTab = mediaTabFromPath(pathname)
  const cardWidth = media.gtLg ? 320 : media.gtMd ? 300 : media.gtSm ? 240 : 168

  const [categories, setCategories] = useState<ProgramCategory[]>([])
  const [featured, setFeatured] = useState<Program[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [sort, setSort] = useState<ProgramSort>('default')

  useEffect(() => {
    setSelectedCategory(null)
    setSelectedLanguage(null)
    setSort('default')
  }, [mediaTab])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [categoryResult, featuredResult] = await Promise.all([
        fetchProgramCategories(),
        fetchPublishedPrograms({ featuredOnly: true, mediaType: mediaTab, limit: 12 }),
      ])
      if (cancelled) return
      setCategories(categoryResult.categories)
      setFeatured(featuredResult.programs)
      setMetaError(categoryResult.error ?? featuredResult.error)
    })()
    return () => {
      cancelled = true
    }
  }, [mediaTab])

  const fetchPage = useCallback(
    async (page: number) => {
      const result = await fetchPublishedProgramsPage(page, PROGRAM_PAGE_SIZE, {
        mediaType: mediaTab,
        category: selectedCategory ?? undefined,
        language: selectedLanguage ?? undefined,
        sort,
      })
      return {
        items: result.programs,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        error: result.error,
      }
    },
    [mediaTab, selectedCategory, selectedLanguage, sort],
  )

  const feed = usePaginatedFeed<Program>({
    fetchPage,
    cacheKey: `${mediaTab === 'audio' ? CACHE_KEYS.classesAudio : CACHE_KEYS.classesVideo}:${selectedCategory ?? 'all'}:${selectedLanguage ?? 'all'}:${sort}`,
  })

  const programs = feed.items
  const error = metaError ?? feed.error
  const languageCodes = useMemo(() => collectProgramLanguages(programs), [programs])

  const grouped = useMemo(
    () => groupProgramsByCategory(programs, categories),
    [categories, programs],
  )

  const categoryChips = useMemo(() => {
    const names = new Set<string>()
    for (const category of categories) {
      if (category.name?.trim()) names.add(category.name.trim())
    }
    for (const program of programs) {
      if (program.category?.trim()) names.add(program.category.trim())
    }
    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))]
  }, [categories, programs])

  const hasActiveFilters =
    Boolean(selectedCategory) || Boolean(selectedLanguage) || sort !== 'default'

  return (
    <ClassShell refreshing={feed.isRefreshing} onRefresh={() => feed.refresh()}>
      <ContinueLearningRail />
      <SavedProgramsRail />
      <MyPlaylistsRail mediaType={mediaTab} />

      <HorizontalScrollRow gap="$2">
        {(
          [
            { id: 'default', label: 'For you' },
            { id: 'popular', label: 'Popular' },
            { id: 'newest', label: 'Newest' },
            { id: 'az', label: 'A–Z' },
          ] as const
        ).map((option) => (
          <CategoryChip
            key={option.id}
            label={option.label}
            active={sort === option.id}
            onPress={() => setSort(option.id)}
          />
        ))}
      </HorizontalScrollRow>

      {languageCodes.length > 1 || selectedLanguage ? (
        <HorizontalScrollRow gap="$2">
          <CategoryChip
            label="All languages"
            active={!selectedLanguage}
            onPress={() => setSelectedLanguage(null)}
          />
          {languageCodes.map((code) => (
            <CategoryChip
              key={code}
              label={formatProgramLanguage(code)}
              active={selectedLanguage === code}
              onPress={() => setSelectedLanguage(code)}
            />
          ))}
        </HorizontalScrollRow>
      ) : null}

      {categoryChips.length > 1 ? (
        <HorizontalScrollRow gap="$2">
          {categoryChips.map((chip) => (
            <CategoryChip
              key={chip}
              label={chip}
              active={chip === 'All' ? !selectedCategory : selectedCategory === chip}
              onPress={() => setSelectedCategory(chip === 'All' ? null : chip)}
            />
          ))}
        </HorizontalScrollRow>
      ) : null}

      {error ? (
        <Text color={ui.danger} fontSize={14}>
          {error}
        </Text>
      ) : null}

      {feed.isLoading && programs.length === 0 ? (
        <YStack alignItems="center" paddingVertical="$10" width="100%">
          <Spinner size="large" />
        </YStack>
      ) : programs.length === 0 ? (
        <YStack
          alignItems="center"
          gap="$3"
          paddingVertical="$10"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          width="100%"
          style={getShadowStyle('sm')}
        >
          <Icons.Radio size={44} color={ui.brand} opacity={0.85} />
          <Text fontSize={16} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
            {hasActiveFilters ? 'No matching videos' : `No ${mediaTab} yet`}
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" paddingHorizontal="$4">
            {hasActiveFilters
              ? 'Try another language or category.'
              : `Published ${mediaTab} recordings will show here — tap one to play.`}
          </Text>
        </YStack>
      ) : hasActiveFilters ? (
        <YStack gap="$4" width="100%">
          <XStack flexWrap="wrap" gap="$4" width="100%">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} width={cardWidth} />
            ))}
          </XStack>
          <LoadMoreSentinel
            hasMore={feed.hasMore}
            isLoadingMore={feed.isLoadingMore}
            onLoadMore={feed.loadMore}
          />
          {!feed.hasMore ? <LoadMoreEnd /> : null}
        </YStack>
      ) : (
        <YStack gap="$6" width="100%">
          {featured.length ? (
            <ProgramCategoryRow
              category={{
                id: 'featured',
                name: 'Featured',
                description: null,
                thumbnail_url: null,
              }}
              programs={featured}
              cardWidth={cardWidth}
            />
          ) : null}

          {grouped.map((row) => (
            <ProgramCategoryRow
              key={row.category.id}
              category={row.category}
              programs={row.programs}
              cardWidth={cardWidth}
            />
          ))}

          <LoadMoreSentinel
            hasMore={feed.hasMore}
            isLoadingMore={feed.isLoadingMore}
            onLoadMore={feed.loadMore}
          />
          {!feed.hasMore ? <LoadMoreEnd /> : null}
        </YStack>
      )}
    </ClassShell>
  )
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical={8}
      borderRadius={999}
      backgroundColor={active ? ui.brand : ui.surfaceMuted}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.borderSubtle}
      cursor="pointer"
      onPress={onPress}
      pressStyle={{ opacity: 0.85 }}
      flexShrink={0}
    >
      <Text fontSize={13} fontWeight="600" color={active ? '#ffffff' : ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}
