import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  getClassAutoplaySync,
  loadClassAutoplay,
  setClassAutoplay,
  subscribeClassAutoplay,
} from '~/class/lib/autoplay-preference'
import {
  formatProgramDuration,
  getProgramSlug,
  getProgramThumbnailUrl,
  type Program,
} from '~/class/lib/programs'
import { classRoutes } from '~/lib/routes'
import { Image, Spinner, Switch, Text, XStack, YStack } from '~/components/ui'
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
      maxHeight={520}
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
        <YStack gap="$2" maxHeight={440} overflow="scroll">
          {items.map((item, index) => {
            const href = playlistId
              ? classRoutes.program(getProgramSlug(item), { playlist: playlistId })
              : classRoutes.program(getProgramSlug(item))
            const thumb = getProgramThumbnailUrl(item)
            return (
              <AppLink key={item.id} href={href}>
                <XStack
                  gap="$3"
                  alignItems="center"
                  padding="$2"
                  borderRadius={10}
                  hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                  pressStyle={{ opacity: 0.92 }}
                  cursor="pointer"
                >
                  <Text
                    fontSize={12}
                    fontWeight="700"
                    color={ui.textMuted}
                    width={18}
                    textAlign="center"
                  >
                    {index + 1}
                  </Text>
                  <YStack
                    width={120}
                    aspectRatio={16 / 9}
                    borderRadius={8}
                    overflow="hidden"
                    backgroundColor={ui.imagePlaceholder}
                    flexShrink={0}
                  >
                    {thumb ? (
                      <Image
                        src={thumb}
                        width="100%"
                        height="100%"
                        objectFit="cover"
                        alt={item.title}
                      />
                    ) : null}
                  </YStack>
                  <YStack flex={1} gap="$1" minWidth={0}>
                    <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
                      {[item.category, item.duration ? formatProgramDuration(item.duration) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </YStack>
                </XStack>
              </AppLink>
            )
          })}
        </YStack>
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
