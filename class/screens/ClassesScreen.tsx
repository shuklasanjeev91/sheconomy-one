import { ClassShell } from '~/class/components/ClassShell'
import { ProgramCard } from '~/class/components/ProgramCard'
import { ProgramCategoryRow } from '~/class/components/ProgramCategoryRow'
import {
  fetchProgramCategories,
  fetchPublishedPrograms,
  groupProgramsByCategory,
  type Program,
  type ProgramCategory,
} from '~/class/lib/programs'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useMedia } from '~/components/ui'
import { isClassAudioPath } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'one'

type MediaTab = 'video' | 'audio'

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
    void load()
  }, [load])

  const filteredPrograms = useMemo(() => {
    if (!selectedCategory) return programs
    return programs.filter((program) => program.category === selectedCategory)
  }, [programs, selectedCategory])

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

  return (
    <ClassShell>
      {categoryChips.length > 1 ? (
        media.gtMd ? (
          <XStack gap="$2" flexWrap="wrap" width="100%">
            {categoryChips.map((chip) => (
              <CategoryChip
                key={chip}
                label={chip}
                active={chip === 'All' ? !selectedCategory : selectedCategory === chip}
                onPress={() => setSelectedCategory(chip === 'All' ? null : chip)}
              />
            ))}
          </XStack>
        ) : (
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
        )
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
          borderRadius={16}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          width="100%"
        >
          <Icons.Radio size={40} color={ui.icon} />
          <Text fontSize={16} fontWeight="600" color={ui.text}>
            No {mediaTab} programs yet
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" paddingHorizontal="$4">
            Published {mediaTab} programs will appear here by category.
          </Text>
        </YStack>
      ) : selectedCategory ? (
        <XStack flexWrap="wrap" gap="$4" width="100%">
          {filteredPrograms.map((program) => (
            <ProgramCard key={program.id} program={program} width={cardWidth} />
          ))}
        </XStack>
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
      backgroundColor={active ? ui.text : ui.surfaceMuted}
      borderWidth={1}
      borderColor={active ? ui.text : ui.borderSubtle}
      cursor="pointer"
      onPress={onPress}
      pressStyle={{ opacity: 0.85 }}
      flexShrink={0}
    >
      <Text fontSize={13} fontWeight="600" color={active ? ui.surface : ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}