import { useEventListener } from 'expo'
import { useAudioPlayer } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef } from 'react'
import { Image } from 'react-native'

import { Button, YStack } from '~/components/ui'

type NativeVideoFileProps = {
  uri: string
  posterUri?: string | null
  autoPlay?: boolean
  onEnded?: () => void
}

export function NativeVideoFile({
  uri,
  posterUri = null,
  autoPlay = false,
  onEnded,
}: NativeVideoFileProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false
  })
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    if (!autoPlay) return
    try {
      player.play()
    } catch {
      // Autoplay may be blocked until user gesture on some devices.
    }
  }, [autoPlay, player])

  useEventListener(player, 'playToEnd', () => {
    onEndedRef.current?.()
  })

  return (
    <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} overflow="hidden" backgroundColor="#000">
      {posterUri && !autoPlay ? (
        <Image
          source={{ uri: posterUri }}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          resizeMode="cover"
        />
      ) : null}
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls
        contentFit="contain"
      />
    </YStack>
  )
}

type NativeAudioFileProps = {
  uri: string
  autoPlay?: boolean
  onEnded?: () => void
}

export function NativeAudioFile({ uri, autoPlay = false, onEnded }: NativeAudioFileProps) {
  const player = useAudioPlayer(uri)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const wasPlayingRef = useRef(false)

  useEffect(() => {
    if (!autoPlay) return
    try {
      player.play()
    } catch {
      // ignore
    }
  }, [autoPlay, player])

  useEffect(() => {
    const interval = setInterval(() => {
      const playing = Boolean((player as { playing?: boolean }).playing)
      const currentTime = Number((player as { currentTime?: number }).currentTime ?? 0)
      const duration = Number((player as { duration?: number }).duration ?? 0)
      if (playing) wasPlayingRef.current = true
      if (
        wasPlayingRef.current &&
        !playing &&
        duration > 0 &&
        currentTime >= Math.max(0, duration - 0.35)
      ) {
        wasPlayingRef.current = false
        onEndedRef.current?.()
      }
    }, 400)
    return () => clearInterval(interval)
  }, [player])

  return (
    <YStack width="100%" borderRadius={12} overflow="hidden" padding="$2">
      <Button size="$3" onPress={() => player.play()}>
        Play audio
      </Button>
    </YStack>
  )
}
