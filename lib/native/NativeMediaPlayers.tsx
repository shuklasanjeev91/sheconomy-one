import { useAudioPlayer } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'

import { Button, YStack } from '~/components/ui'

export function NativeVideoFile({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri)

  return (
    <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} overflow="hidden" backgroundColor="#000">
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
