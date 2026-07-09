import { ProgramCard } from '~/class/components/ProgramCard'
import type { Program, ProgramCategory } from '~/class/lib/programs'
import { HorizontalScrollRow } from '~/components/layout'
import { Text, XStack, YStack, useMedia } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramCategoryRowProps = {
  category: ProgramCategory
  programs: Program[]
  cardWidth?: number
}

export function ProgramCategoryRow({ category, programs, cardWidth }: ProgramCategoryRowProps) {
  const ui = useAppUi()
  const media = useMedia()

  if (!programs.length) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="baseline" justifyContent="space-between" paddingRight="$2">
        <Text fontSize={18} fontWeight="700" color={ui.text}>
          {category.name}
        </Text>
        <Text fontSize={13} color={ui.textMuted}>
          {programs.length} {programs.length === 1 ? 'program' : 'programs'}
        </Text>
      </XStack>

      {media.gtMd ? (
        <XStack flexWrap="wrap" gap="$4" width="100%">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} width={cardWidth} />
          ))}
        </XStack>
      ) : (
        <HorizontalScrollRow>
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} width={cardWidth} />
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )
}