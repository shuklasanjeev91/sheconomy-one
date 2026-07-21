import type { Href } from 'one'

import { ProgramCard } from '~/class/components/ProgramCard'
import type { Program } from '~/class/lib/programs'
import { XStack, useMedia } from '~/components/ui'

type ProgramCardGridProps = {
  programs: Program[]
  /** Optional per-program href override (e.g. playlist context). */
  hrefForProgram?: (program: Program) => Href
}

type ColumnLayout = {
  columns: 1 | 2 | 3 | 4
  basis: `${number}%` | '100%'
  maxWidth: `${number}%` | '100%'
  minWidth: number
}

/** Phone → 1, tablet → 2, desktop → 3, wide → 4. */
export function useProgramCardColumns(): ColumnLayout {
  const media = useMedia()

  if (media.gtLg) {
    return { columns: 4, basis: '22%', maxWidth: '24.5%', minWidth: 200 }
  }
  if (media.gtMd) {
    return { columns: 3, basis: '29%', maxWidth: '32%', minWidth: 0 }
  }
  if (media.gtSm) {
    return { columns: 2, basis: '44%', maxWidth: '48.5%', minWidth: 0 }
  }
  return { columns: 1, basis: '100%', maxWidth: '100%', minWidth: 0 }
}

/** Responsive program card grid — 1 / 2 / 3 / 4 columns by screen size. */
export function ProgramCardGrid({ programs, hrefForProgram }: ProgramCardGridProps) {
  const { columns, basis, maxWidth, minWidth } = useProgramCardColumns()

  if (!programs.length) return null

  return (
    <XStack gap="$4" flexWrap="wrap" width="100%" alignItems="stretch">
      {programs.map((program) => (
        <XStack
          key={program.id}
          flexBasis={basis}
          flexGrow={columns === 1 ? 0 : 1}
          flexShrink={1}
          minWidth={minWidth}
          maxWidth={maxWidth}
          width={columns === 1 ? '100%' : undefined}
        >
          <ProgramCard
            program={program}
            width="100%"
            href={hrefForProgram?.(program)}
          />
        </XStack>
      ))}
    </XStack>
  )
}
