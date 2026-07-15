import { ClassShell } from '~/class/components/ClassShell'
import { ContinueLearningRail } from '~/class/components/ContinueLearningRail'
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
  groupProgramsByCategory,
  type Program,
  type ProgramCategory,
} from '~/class/lib/programs'
import { PushPermissionBanner } from '~/components/notifications/PushPermissionBanner'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useMedia } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { isClassAudioPath } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'one'

type MediaTab = 'video' | 'audio'
type ProgramSort = 'default' | 'popular' | 'newest' | 'az'

function mediaTabFromPath(pathname: string): MediaTab {
  return isClassAudioPath(pathname) ? 'audio' : 'video'
}

export function ClassesScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const pathname = usePathname()
  const mediaTab = mediaTabFromPath(pathname)
  const cardWidth = media.gtLg ? 320 : media.gtMd ? 300 : 260

  const [categories, setCategories] = useState<ProgramCategory[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [featured, setFeatured] = useState<Program[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [sort, setSort] = useState<ProgramSort>('default')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [categoryResult, programResult, featuredResult] = await Promise.all([
        fetchProgramCategories(),
        fetchPublishedPrograms({ mediaType: mediaTab }),
        fetchPublishedPrograms({ featuredOnly: true, mediaType: mediaTab, limit: 12 }),
      ])

      if (categoryResult.error) {
        setError(categoryResult.error)
      } else {
        setCategories(categoryResult.categories)
      }

      if (programResult.error) {
        setError(programResult.error)
        setPrograms([])
      } else {
        setPrograms(programResult.programs)
      }

      setFeatured(featuredResult.programs)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load classes')
      setPrograms([])
      setFeatured([])
    } finally {
      setIsLoading(false)
    }
  }, [mediaTab])

  useEffect(() => {
    setSelectedCategory(null)
    setSelectedLanguage(null)
    setSort('default')
    void load()
  }, [load])

  const languageCodes = useMemo(() => collectProgramLanguages(programs), [programs])

  const filteredPrograms = useMemo(() => {
    const next = programs.filter((program) => {
      if (selectedCategory && program.category !== selectedCategory) return false
      if (selectedLanguage) {
        const code = (program.language ?? 'en').trim().toLowerCase() || 'en'
        if (code !== selectedLanguage) return false
      }
      return true
    })

    if (sort === 'popular') {
      return [...next].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    }
    if (sort === 'newest') {
      return [...next].sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0
        return bTime - aTime
      })
    }
    if (sort === 'az') {
      return [...next].sort((a, b) => a.title.localeCompare(b.title))
    }
    return next
  }, [programs, selectedCategory, selectedLanguage, sort])

  const grouped = useMemo(
    () => groupProgramsByCategory(filteredPrograms, categories),
    [categories, filteredPrograms],
  )

  const categoryChips = useMemo(() => {
    const names = new Set<string>()
    for (const program of programs) {
      if (program.category?.trim()) names.add(program.category.trim())
    }
    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))]
  }, [programs])

  const hasActiveFilters =
    Boolean(selectedCategory) || Boolean(selectedLanguage) || sort !== 'default'

  return (
    <ClassShell>
      <PushPermissionBanner />
      <ContinueLearningRail />
      <SavedProgramsRail />

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

      {languageCodes.length > 1 ? (
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

      {isLoading ? (
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
            No {mediaTab} programs yet
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" paddingHorizontal="$4">
            Published {mediaTab} programs will appear here by category.
          </Text>
        </YStack>
      ) : hasActiveFilters ? (
        filteredPrograms.length === 0 ? (
          <YStack alignItems="center" gap="$2" paddingVertical="$8" width="100%">
            <Icons.Filter size={36} color={ui.textMuted} />
            <Text fontSize={15} fontWeight="700" color={ui.text}>
              No matching programs
            </Text>
            <Text fontSize={13} color={ui.textSecondary}>
              Try another language or category.
            </Text>
          </YStack>
        ) : (
          <XStack flexWrap="wrap" gap="$4" width="100%">
            {filteredPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} width={cardWidth} />
            ))}
          </XStack>
        )
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
