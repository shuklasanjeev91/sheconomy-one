import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import {
  clearRecentlyViewedPrograms,
  useRecentlyViewedPrograms,
} from '~/class/lib/recently-viewed-programs'
import { fetchProgramsByIds, type Program } from '~/class/lib/programs'
import type { MediaTab } from '~/class/lib/media-tab'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type ContinueLearningRailProps = {
  mediaType?: MediaTab
}

/** Resume recently viewed programs — filtered to the active Video/Audio tab. */
export function ContinueLearningRail({ mediaType }: ContinueLearningRailProps) {
  const ui = useAppUi()
  const { user } = useSupabase()
  const recentIds = useRecentlyViewedPrograms()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || recentIds.length === 0) {
      setPrograms([])
      return
    }
    let active = true
    setLoading(true)
    void fetchProgramsByIds(recentIds.slice(0, 12))
      .then((result) => {
        if (!active) return
        const next = mediaType
          ? result.programs.filter((program) => program.media_type === mediaType)
          : result.programs
        setPrograms(next.slice(0, 8))
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
  }, [user, recentIds, mediaType])

  if (!user) return null
  if (!loading && programs.length === 0) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize={16} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
          {mediaType === 'audio' ? 'Continue listening' : 'Continue watching'}
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
          <AppLink href={mediaType === 'audio' ? classRoutes.audio : classRoutes.home}>
            <Text fontSize={13} fontWeight="600" color={ui.brand}>
              Browse all
            </Text>
          </AppLink>
        </XStack>
      </XStack>

      {loading && programs.length === 0 ? (
        <XStack paddingVertical="$2">
          <Spinner size="small" color={ui.brand} />
        </XStack>
      ) : (
        <ProgramCardGrid programs={programs} />
      )}
    </YStack>
  )
}
