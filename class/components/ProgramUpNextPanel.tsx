import { useEffect, useMemo, useState } from 'react'

import { ProgramCard } from '~/class/components/ProgramCard'
import {
  getClassAutoplaySync,
  loadClassAutoplay,
  setClassAutoplay,
  subscribeClassAutoplay,
} from '~/class/lib/autoplay-preference'
import { getProgramSlug, type Program } from '~/class/lib/programs'
import { classRoutes } from '~/lib/routes'
import { Spinner, Switch, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramUpNextPanelProps = {
  currentProgramId: string
  queue: Program[]
  isLoading?: boolean
  title?: string
  /** When set, queue item links keep the playlist context. */
  playlistId?: string | null
  autoplayEnabled: boolean
  onAutoplayChange: (enabled: boolean) => void
}

export function ProgramUpNextPanel({
  currentProgramId,
  queue,
  isLoading = false,
  title = 'Up next',
  playlistId = null,
  autoplayEnabled,
  onAutoplayChange,
}: ProgramUpNextPanelProps) {
  const ui = useAppUi()

  const items = useMemo(() => {
    if (playlistId) {
      const index = queue.findIndex((item) => item.id === currentProgramId)
      if (index >= 0) return queue.slice(index + 1)
    }
    return queue.filter((item) => item.id !== currentProgramId)
  }, [currentProgramId, playlistId, queue])

  if (!isLoading && items.length === 0) return null

  return (
    <YStack
      width="100%"
      gap="$3"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          {title}
        </Text>
        <XStack alignItems="center" gap="$2">
          <Text fontSize={12} color={ui.textMuted}>
            Autoplay
          </Text>
          <Switch
            checked={autoplayEnabled}
            onCheckedChange={(checked) => onAutoplayChange(Boolean(checked))}
          />
        </XStack>
      </XStack>

      {isLoading && items.length === 0 ? (
        <YStack paddingVertical="$4" alignItems="center">
          <Spinner size="small" color={ui.brand} />
        </YStack>
      ) : (
        <XStack gap="$3" flexWrap="wrap" width="100%" alignItems="stretch">
          {items.map((item) => {
            const href = playlistId
              ? classRoutes.program(getProgramSlug(item), { playlist: playlistId })
              : classRoutes.program(getProgramSlug(item))
            const alone = items.length === 1
            return (
              <YStack
                key={item.id}
                flexBasis={alone ? '100%' : '47%'}
                flexGrow={alone ? 0 : 1}
                flexShrink={1}
                maxWidth={alone ? '100%' : '48.5%'}
                minWidth={alone ? undefined : 140}
              >
                <ProgramCard program={item} width="100%" href={href} />
              </YStack>
            )
          })}
        </XStack>
      )}
    </YStack>
  )
}

/** Hook for autoplay preference used by ProgramScreen. */
export function useClassAutoplay() {
  const [enabled, setEnabled] = useState(getClassAutoplaySync())

  useEffect(() => {
    void loadClassAutoplay().then(setEnabled)
    return subscribeClassAutoplay(setEnabled)
  }, [])

  return {
    enabled,
    setEnabled: (next: boolean) => {
      setEnabled(next)
      void setClassAutoplay(next)
    },
  }
}
