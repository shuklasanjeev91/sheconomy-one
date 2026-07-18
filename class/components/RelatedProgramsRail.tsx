import { useEffect, useState } from 'react'

import { ProgramCard } from '~/class/components/ProgramCard'
import { fetchPublishedPrograms, type Program } from '~/class/lib/programs'
import { HorizontalScrollRow } from '~/components/layout'
import { Spinner, Text, YStack, useMedia } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type RelatedProgramsRailProps = {
  program: Program
}

/** Same-category recommendations under a program detail — web + native. */
export function RelatedProgramsRail({ program }: RelatedProgramsRailProps) {
  const ui = useAppUi()
  const media = useMedia()
  const [items, setItems] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)
  const cardWidth = media.gtLg ? 280 : media.gtSm ? 220 : 168

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
        <HorizontalScrollRow gap="$3">
          {items.map((item) => (
            <ProgramCard key={item.id} program={item} width={cardWidth} />
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )
}
