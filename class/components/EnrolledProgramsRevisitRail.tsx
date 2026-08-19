import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import { fetchEnrolledPrograms, type Program } from '~/class/lib/programs'
import type { MediaTab } from '~/class/lib/media-tab'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type EnrolledProgramsRevisitRailProps = {
  mediaType?: MediaTab
}

/** Enrolled programs on the Class catalog — filtered to the active Video/Audio tab. */
export function EnrolledProgramsRevisitRail({ mediaType }: EnrolledProgramsRevisitRailProps) {
  const ui = useAppUi()
  const { user } = useSupabase()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setPrograms([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { programs: rows } = await fetchEnrolledPrograms(user.id)
    const filtered = mediaType
      ? rows.filter((program) => program.media_type === mediaType)
      : rows
    setPrograms(filtered.slice(0, 8))
    setLoading(false)
  }, [mediaType, user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.classEnrollments], () => {
    void reload()
  })

  if (!user) return null
  if (!loading && programs.length === 0) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
            Your enrollments
          </Text>
          <Text fontSize={13} color={ui.textMuted}>
            Programs you joined — continue where you left off.
          </Text>
        </YStack>
        <AppLink href={mediaType === 'audio' ? classRoutes.audio : classRoutes.home}>
          <Text fontSize={13} fontWeight="600" color={ui.brand}>
            Browse all
          </Text>
        </AppLink>
      </XStack>

      {loading && programs.length === 0 ? (
        <Spinner size="small" color={ui.brand} />
      ) : (
        <ProgramCardGrid programs={programs} />
      )}
    </YStack>
  )
}
