import { useEffect, useState } from 'react'
import { Share } from 'react-native'

import { ProgramCardGrid } from '~/class/components/ProgramCardGrid'
import { fetchProgramsByIds, getProgramSlug, type Program } from '~/class/lib/programs'
import type { MediaTab } from '~/class/lib/media-tab'
import { useSavedPrograms } from '~/class/lib/saved-programs'
import { Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { getProgramShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type SavedProgramsRailProps = {
  mediaType?: MediaTab
}

/** Bookmarked programs — filtered to the active Video/Audio tab. */
export function SavedProgramsRail({ mediaType }: SavedProgramsRailProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const savedIds = useSavedPrograms()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || savedIds.length === 0) {
      setPrograms([])
      return
    }
    let active = true
    setLoading(true)
    void fetchProgramsByIds(savedIds.slice(0, 12))
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
  }, [user, savedIds, mediaType])

  async function handleShareSaved() {
    if (!programs.length) return
    const lines = programs.map(
      (program) => `• ${program.title}\n  ${getProgramShareUrl(getProgramSlug(program))}`,
    )
    const message = [`Saved programs on ${BRAND_NAME}`, '', ...lines].join('\n')
    try {
      await Share.share({ title: 'Saved programs', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Saved list copied' : 'Could not share', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  if (!user) return null
  if (!loading && programs.length === 0) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize={16} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
          Saved for later
        </Text>
        {programs.length > 0 ? (
          <Text
            fontSize={13}
            fontWeight="600"
            color={ui.brand}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => void handleShareSaved()}
          >
            Share
          </Text>
        ) : null}
      </XStack>
      {loading && programs.length === 0 ? (
        <Spinner size="small" color={ui.brand} />
      ) : (
        <ProgramCardGrid programs={programs} />
      )}
    </YStack>
  )
}
