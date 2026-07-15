import { useAudioPlayer } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect } from 'react'
import { Image } from 'react-native'

import { Button, YStack } from '~/components/ui'

type NativeVideoFileProps = {
  uri: string
  posterUri?: string | null
  autoPlay?: boolean
}

export function NativeVideoFile({ uri, posterUri = null, autoPlay = false }: NativeVideoFileProps) {
  const player = useVideoPlayer(uri)

  useEffect(() => {
    if (!autoPlay) return
    try {
      player.play()
    } catch {
      // Autoplay may be blocked until user gesture on some devices.
    }
  }, [autoPlay, player])

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

export function NativeAudioFile({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri)

  return (
    <YStack width="100%" borderRadius={12} overflow="hidden" padding="$2">
      <Button size="$3" onPress={() => player.play()}>
        Play audio
      </Button>
    </YStack>
  )
}
