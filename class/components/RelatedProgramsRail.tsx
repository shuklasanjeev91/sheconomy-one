import { useEffect, useState } from 'react'

import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import { fetchPublishedPrograms, type Program } from '~/class/lib/programs'
import { Spinner, Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type RelatedProgramsRailProps = {
  program: Program
}

/** Same-category recommendations under a program detail — responsive grid. */
export function RelatedProgramsRail({ program }: RelatedProgramsRailProps) {
  const ui = useAppUi()
  const [items, setItems] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchPublishedPrograms({
      category: program.category || undefined,
      mediaType: program.media_type === 'audio' ? 'audio' : 'video',
      limit: 10,
    })
      .then((result) => {
        if (!active) return
        setItems(result.programs.filter((item) => item.id !== program.id).slice(0, 8))
      })
      .catch(() => {
        if (active) setItems([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [program.category, program.id, program.media_type])

  if (!loading && items.length === 0) return null

  return (
    <YStack gap="$3" width="100%">
      <Text fontSize={16} fontWeight="700" color={ui.text}>
        More like this
      </Text>
      {loading && items.length === 0 ? (
        <Spinner size="small" color={ui.brand} />
      ) : (
        <ProgramCardGrid programs={items} />
      )}
    </YStack>
  )
}
