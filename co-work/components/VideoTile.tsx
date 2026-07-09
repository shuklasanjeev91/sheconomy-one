import { Platform } from 'react-native'
import { useEffect, useRef } from 'react'

import { Avatar, Text, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type VideoTileProps = {
  stream?: MediaStream | null
  name: string
  avatarUrl?: string | null
  muted?: boolean
  videoOff?: boolean
  handRaised?: boolean
  isSelf?: boolean
  isScreen?: boolean
  large?: boolean
}

export function VideoTile({
  stream,
  name,
  avatarUrl,
  muted,
  videoOff,
  handRaised,
  isSelf,
  isScreen,
  large,
}: VideoTileProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || !videoRef.current) return
    videoRef.current.srcObject = stream ?? null
  }, [stream])

  const showVideo = Platform.OS === 'web' && stream && !videoOff

  return (
    <YStack
      flex={large ? 1 : undefined}
      minWidth={large ? undefined : 160}
      width={large ? '100%' : 200}
      aspectRatio={16 / 9}
      borderRadius={coworkUi.radius.tile}
      overflow="hidden"
      backgroundColor={coworkUi.tileBg}
      borderWidth={handRaised ? 2 : 1}
      borderColor={handRaised ? coworkUi.brand : coworkUi.tileBorder}
      position="relative"
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{ width: '100%', height: '100%', objectFit: isScreen ? 'contain' : 'cover' }}
        />
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2" backgroundColor={coworkUi.surfaceMuted}>
          <Avatar name={name} src={avatarUrl ?? undefined} size={large ? '$8' : '$6'} />
          {videoOff ? (
            <Text fontSize={11} color={coworkUi.textMuted}>
              Camera off
            </Text>
          ) : null}
        </YStack>
      )}

      <YStack
        position="absolute"
        left={10}
        bottom={10}
        paddingHorizontal={12}
        paddingVertical={5}
        borderRadius={coworkUi.radius.chip}
        backgroundColor="rgba(28, 15, 20, 0.72)"
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
      >
        <Text fontSize={12} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
          {isSelf ? `${name} (You)` : name}
          {muted ? ' · Muted' : ''}
          {handRaised ? ' · ✋' : ''}
        </Text>
      </YStack>
    </YStack>
  )
}