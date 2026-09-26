import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { Avatar, Text, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  meetingVideoMirrorTransform,
  shouldMirrorMeetingVideo,
} from '~/co-work/lib/meeting-video-mirror'

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
  /** Self-view mirror preference — default ON. */
  mirrorLocalVideo?: boolean
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
  mirrorLocalVideo = true,
}: VideoTileProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [RtcView, setRtcView] = useState<React.ComponentType<{
    streamURL: string
    style?: object
    objectFit?: string
    mirror?: boolean
  }> | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: !!isSelf,
    isScreenShare: !!isScreen,
  })

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    void import('@livekit/react-native-webrtc')
      .then((module) => {
        if (!cancelled) setRtcView(() => module.default)
      })
      .catch(() => {
        // Video tile falls back to avatar when the native RTC view cannot load.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!videoRef.current) return
      videoRef.current.srcObject = stream ?? null
      return
    }

    if (!stream) {
      setStreamUrl(null)
      return
    }

    try {
      const url = (stream as MediaStream & { toURL?: () => string }).toURL?.()
      setStreamUrl(url ?? null)
    } catch {
      setStreamUrl(null)
    }
  }, [stream])

  const showWebVideo = Platform.OS === 'web' && stream && !videoOff
  const showNativeVideo =
    Platform.OS !== 'web' && streamUrl && !videoOff && RtcView && !(isSelf && isScreen)

  return (
    <YStack
      flex={large ? 1 : undefined}
      minWidth={large ? 0 : 160}
      minHeight={large ? 0 : undefined}
      width={large ? '100%' : 200}
      height={large ? '100%' : undefined}
      aspectRatio={large ? undefined : 16 / 9}
      borderRadius={coworkUi.radius.tile}
      overflow="hidden"
      backgroundColor={coworkUi.tileBg}
      borderWidth={handRaised ? 2 : 1}
      borderColor={handRaised ? coworkUi.brand : coworkUi.tileBorder}
      position="relative"
    >
      {showWebVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{
            width: '100%',
            height: '100%',
          objectFit: 'cover',
            transform: meetingVideoMirrorTransform(mirrored),
          }}
        />
      ) : showNativeVideo ? (
        <RtcView
          streamURL={streamUrl}
          objectFit="cover"
          mirror={mirrored}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2" backgroundColor={coworkUi.surfaceMuted}>
          <Avatar name={name} src={avatarUrl ?? undefined} size={large ? '$8' : '$6'} />
          {videoOff ? (
            <Text fontSize={11} color={coworkUi.textMuted}>
              Camera off
            </Text>
          ) : isSelf && isScreen ? (
            <Text fontSize={12} color={coworkUi.textMuted} textAlign="center" paddingHorizontal="$3">
              Sharing your screen
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
