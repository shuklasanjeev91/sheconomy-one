import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import type { Program, ProgramCategory } from '~/class/lib/programs'
import { Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramCategoryRowProps = {
  category: ProgramCategory
  programs: Program[]
}

export function ProgramCategoryRow({ category, programs }: ProgramCategoryRowProps) {
  const ui = useAppUi()

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

      <ProgramCardGrid programs={programs} />
    </YStack>
  )
}
