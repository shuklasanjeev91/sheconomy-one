import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import { ContinueLearningRail } from '~/class/components/ContinueLearningRail'
import { MyPlaylistsRail } from '~/class/components/MyPlaylistsRail'
import { ProgramCard } from '~/class/components/ProgramCard'
import { SavedProgramsRail } from '~/class/components/SavedProgramsRail'
import { fetchEnrolledPrograms, type Program } from '~/class/lib/programs'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack, useMedia } from '~/components/ui'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Distinct `/class` learn hub — continue, enrolled, playlists (not the full video catalog). */
export function ClassHubScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const { user } = useSupabase()
  const [enrolled, setEnrolled] = useState<Program[]>([])
  const [loadingEnrolled, setLoadingEnrolled] = useState(false)
  const cardWidth = media.gtLg ? 300 : media.gtMd ? 280 : 240

  useEffect(() => {
    if (!user?.id) {
      setEnrolled([])
      return
    }
    let active = true
    setLoadingEnrolled(true)
    void fetchEnrolledPrograms(user.id).then((result) => {
      if (!active) return
      setEnrolled(result.programs)
      setLoadingEnrolled(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  return (
    <ClassShell>
      <YStack gap="$2" paddingBottom="$2">
        <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
          Learn
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          Pick up where you left off, or open the video catalog to browse.
        </Text>
        <XStack gap="$2" flexWrap="wrap" paddingTop="$2">
          <AppLink href={classRoutes.video} asChild>
            <Button tone="primary" size="$3" borderRadius={999} icon={<Icons.Play size={14} />}>
              Browse video
            </Button>
          </AppLink>
          <AppLink href={classRoutes.audio} asChild>
            <Button tone="outline" size="$3" borderRadius={999}>
              Audio
            </Button>
          </AppLink>
          <AppLink href={classRoutes.playlists} asChild>
            <Button tone="outline" size="$3" borderRadius={999}>
              Playlists
            </Button>
          </AppLink>
        </XStack>
      </YStack>

      <ContinueLearningRail />

      <YStack gap="$2">
        <Text fontSize={17} fontWeight="800" color={ui.text}>
          Enrolled programs
        </Text>
        {!user ? (
          <Text fontSize={13} color={ui.textMuted}>
            Sign in to see programs you’re enrolled in.
          </Text>
        ) : loadingEnrolled ? (
          <Spinner size="small" />
        ) : enrolled.length === 0 ? (
          <Text fontSize={13} color={ui.textMuted}>
            Enroll from a program page to build your learning list.
          </Text>
        ) : (
          <HorizontalScrollRow gap="$3">
            {enrolled.map((program) => (
              <ProgramCard key={program.id} program={program} width={cardWidth} />
            ))}
          </HorizontalScrollRow>
        )}
      </YStack>

      <SavedProgramsRail />
      <MyPlaylistsRail mediaType="video" />
    </ClassShell>
  )
}
