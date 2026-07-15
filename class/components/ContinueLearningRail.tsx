import { useEffect, useState } from 'react'
import { Link } from 'one'

import { ProgramCard } from '~/class/components/ProgramCard'
import {
  clearRecentlyViewedPrograms,
  useRecentlyViewedPrograms,
} from '~/class/lib/recently-viewed-programs'
import { fetchProgramsByIds, type Program } from '~/class/lib/programs'
import { HorizontalScrollRow } from '~/components/layout'
import { Spinner, Text, XStack, YStack, useMedia } from '~/components/ui'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Resume recently viewed programs — AsyncStorage so it works offline on all platforms. */
export function ContinueLearningRail() {
  const ui = useAppUi()
  const media = useMedia()
  const { user } = useSupabase()
  const recentIds = useRecentlyViewedPrograms()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)
  const cardWidth = media.gtLg ? 300 : media.gtMd ? 280 : 240

  useEffect(() => {
    if (!user || recentIds.length === 0) {
      setPrograms([])
      return
    }
    let active = true
    setLoading(true)
    void fetchProgramsByIds(recentIds.slice(0, 8))
      .then((result) => {
        if (!active) return
        setPrograms(result.programs)
      })
      .catch(() => {
        if (active) setPrograms([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, recentIds])

  if (!user) return null
  if (!loading && programs.length === 0) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize={16} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
          Continue learning
        </Text>
        <XStack alignItems="center" gap="$3">
          <Text
            fontSize={13}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => clearRecentlyViewedPrograms()}
          >
            Clear
          </Text>
          <Link href={classRoutes.home}>
            <Text fontSize={13} fontWeight="600" color={ui.brand}>
              Browse all
            </Text>
          </Link>
        </XStack>
      </XStack>

      {loading && programs.length === 0 ? (
        <XStack paddingVertical="$2">
          <Spinner size="small" color={ui.brand} />
        </XStack>
      ) : (
        <HorizontalScrollRow gap="$3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} width={cardWidth} />
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )
}
