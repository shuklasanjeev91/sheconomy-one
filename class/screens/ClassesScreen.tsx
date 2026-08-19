import { usePathname } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import { EnrolledProgramsRevisitRail } from '~/class/components/EnrolledProgramsRevisitRail'
import { ContinueLearningRail } from '~/class/components/ContinueLearningRail'
import { SavedProgramsRail } from '~/class/components/SavedProgramsRail'
import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import { ProgramCategoryRow } from '~/class/components/ProgramCategoryRow'
import {
  collectProgramLanguages,
  formatProgramLanguage,
} from '~/class/lib/languages'
import {
  fetchProgramCategories,
  fetchPublishedProgramLanguages,
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
import { CardGridSkeleton, Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { mediaTabFromPath } from '~/class/lib/media-tab'
import { useAppUi } from '~/lib/theme/useAppUi'

export function ClassesScreen() {
  const ui = useAppUi()
  const pathname = usePathname()
  const mediaTab = mediaTabFromPath(pathname)

  const [categories, setCategories] = useState<ProgramCategory[]>([])
  const [featured, setFeatured] = useState<Program[]>([])
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)

  useEffect(() => {
    setSelectedCategory(null)
    setSelectedLanguage(null)
  }, [mediaTab])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [categoryResult, featuredResult, languageResult] = await Promise.all([
        fetchProgramCategories(),
        fetchPublishedPrograms({ featuredOnly: true, mediaType: mediaTab, limit: 12 }),
        fetchPublishedProgramLanguages({ mediaType: mediaTab }),
      ])
      if (cancelled) return
      setCategories(categoryResult.categories)
      setFeatured(featuredResult.programs)
      setAvailableLanguages(languageResult.languages)
      setMetaError(categoryResult.error ?? featuredResult.error ?? languageResult.error)
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
      })
      return {
        items: result.programs,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        error: result.error,
      }
    },
    [mediaTab, selectedCategory, selectedLanguage],
  )

  const feed = usePaginatedFeed<Program>({
    fetchPage,
    cacheKey: `${mediaTab === 'audio' ? CACHE_KEYS.classesAudio : CACHE_KEYS.classesVideo}:${selectedCategory ?? 'all'}:${selectedLanguage ?? 'all'}`,
  })

  // Defense: only show programs that match the active Video/Audio tab.
  const programs = useMemo(
    () => feed.items.filter((program) => program.media_type === mediaTab),
    [feed.items, mediaTab],
  )
  const featuredForTab = useMemo(() => {
    const forTab = featured.filter((program) => program.media_type === mediaTab)
    if (!selectedLanguage) return forTab
    return forTab.filter(
      (program) => (program.language ?? 'en').trim().toLowerCase() === selectedLanguage,
    )
  }, [featured, mediaTab, selectedLanguage])
  const error = metaError ?? feed.error
  const languageCodes = useMemo(() => {
    if (availableLanguages.length > 0) return availableLanguages
    return collectProgramLanguages(programs)
  }, [availableLanguages, programs])

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

  const hasActiveFilters = Boolean(selectedCategory) || Boolean(selectedLanguage)
  const showLanguageFilter = languageCodes.length > 0

  return (
    <ClassShell refreshing={feed.isRefreshing} onRefresh={() => feed.refresh()}>
      <ContinueLearningRail mediaType={mediaTab} />
      <EnrolledProgramsRevisitRail mediaType={mediaTab} />
      <SavedProgramsRail mediaType={mediaTab} />

      {showLanguageFilter ? (
        <YStack gap="$2" width="100%">
          <Text fontSize={13} fontWeight="700" color={ui.textMuted} letterSpacing={0.2}>
            Language
          </Text>
          <XStack flexWrap="wrap" gap="$2" width="100%">
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
          </XStack>
        </YStack>
      ) : null}

      {categoryChips.length > 1 ? (
        <YStack gap="$2" width="100%">
          <Text fontSize={13} fontWeight="700" color={ui.textMuted} letterSpacing={0.2}>
            Category
          </Text>
          <XStack flexWrap="wrap" gap="$2" width="100%">
            {categoryChips.map((chip) => (
              <CategoryChip
                key={chip}
                label={chip}
                active={chip === 'All' ? !selectedCategory : selectedCategory === chip}
                onPress={() => setSelectedCategory(chip === 'All' ? null : chip)}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}

      {error ? (
        <Text color={ui.danger} fontSize={14}>
          {error}
        </Text>
      ) : null}

      {feed.isLoading && programs.length === 0 ? (
        <CardGridSkeleton count={4} />
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
            {hasActiveFilters ? 'No matching programs' : `No ${mediaTab} yet`}
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" paddingHorizontal="$4">
            {hasActiveFilters
              ? 'Try another language or category.'
              : `Published ${mediaTab} recordings will show here — tap one to play.`}
          </Text>
        </YStack>
      ) : hasActiveFilters ? (
        <YStack gap="$4" width="100%">
          <ProgramCardGrid programs={programs} />
          <LoadMoreSentinel
            hasMore={feed.hasMore}
            isLoadingMore={feed.isLoadingMore}
            onLoadMore={feed.loadMore}
          />
          {!feed.hasMore ? <LoadMoreEnd /> : null}
        </YStack>
      ) : (
        <YStack gap="$6" width="100%">
          {featuredForTab.length ? (
            <ProgramCategoryRow
              category={{
                id: 'featured',
                name: 'Featured',
                description: null,
                thumbnail_url: null,
              }}
              programs={featuredForTab}
            />
          ) : null}

          {grouped.map((row) => (
            <ProgramCategoryRow
              key={row.category.id}
              category={row.category}
              programs={row.programs}
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
