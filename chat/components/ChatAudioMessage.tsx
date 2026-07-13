import { useEffect, useMemo, useState } from 'react'

import { useAudioPlayback } from '~/chat/hooks/useAudioPlayback'
import { getChatMediaUrl } from '~/chat/lib/chats'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'

type ChatAudioMessageProps = {
  /** Storage path in `chat-files`, an absolute URL, or a local preview URI. */
  path: string
  tint: string
  trackColor: string
  fillColor: string
}

const LOCAL_URI = /^(https?:|blob:|file:|data:|content:)/i

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Voice-note bubble: play/pause with a progress bar and elapsed / total time. */
export function ChatAudioMessage({ path, tint, trackColor, fillColor }: ChatAudioMessageProps) {
  const [url, setUrl] = useState<string | null>(LOCAL_URI.test(path) ? path : null)

  useEffect(() => {
    let cancelled = false
    if (LOCAL_URI.test(path)) {
      setUrl(path)
      return
    }
    setUrl(null)
    getChatMediaUrl(path).then((resolved) => {
      if (!cancelled && resolved) setUrl(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const { isPlaying, positionMs, durationMs, toggle } = useAudioPlayback(url)

  const progress = useMemo(() => {
    if (!durationMs) return 0
    return Math.min(1, positionMs / durationMs)
  }, [positionMs, durationMs])

  const timeLabel = durationMs
    ? formatDuration(isPlaying || positionMs > 0 ? positionMs : durationMs)
    : '0:00'

  return (
    <XStack alignItems="center" gap={10} minWidth={168} paddingVertical={2}>
      <YStack
        width={34}
        height={34}
        borderRadius={17}
        alignItems="center"
        justifyContent="center"
        backgroundColor={fillColor}
        pressStyle={{ opacity: 0.75 }}
        onPress={url ? toggle : undefined}
        cursor="pointer"
      >
        {!url ? (
          <Spinner size="small" color={tint} />
        ) : isPlaying ? (
          <Icons.Pause size={18} color={tint} />
        ) : (
          <Icons.Play size={18} color={tint} />
        )}
      </YStack>

      <YStack flex={1} gap={6}>
        <YStack height={3} borderRadius={2} backgroundColor={trackColor} overflow="hidden">
          <YStack height={3} width={`${Math.max(4, progress * 100)}%`} backgroundColor={fillColor} />
        </YStack>
        <XStack alignItems="center" gap={6}>
          <Icons.Mic size={12} color={tint} />
          <Text fontSize={11} color={tint}>
            {timeLabel}
          </Text>
        </XStack>
      </YStack>
    </XStack>
  )
}
