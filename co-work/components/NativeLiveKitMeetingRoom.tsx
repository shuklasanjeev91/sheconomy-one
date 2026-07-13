import { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { ConnectionState, RoomEvent, Track } from 'livekit-client'

import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useTracks,
  type TrackReference,
} from '@livekit/react-native'

import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import {
  NativeScreenCapturePicker,
  useLiveKitMediaControls,
} from '~/co-work/hooks/useLiveKitMediaControls'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { useAppLayout } from '~/hooks/useAppLayout'

type NativeLiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

const STAGE_GAP = 10
const HEADER_CLEARANCE = 88
const CONTROLS_CLEARANCE = 108

export function NativeLiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  enabled,
  onDisconnected,
  overlay,
}: NativeLiveKitMeetingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof fetchLiveKitCredentials>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void AudioSession.startAudioSession()
    return () => {
      void AudioSession.stopAudioSession()
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void fetchLiveKitConfig().then(setConfig)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !roomId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const liveKitConfig = await fetchLiveKitConfig()
        if (cancelled) return
        setConfig(liveKitConfig)
        if (!liveKitConfig.enabled) {
          throw new Error('Video meetings are temporarily unavailable. Please try again later.')
        }
        const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName)
        if (cancelled) return
        setCredentials(creds)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [displayName, enabled, meetingId, roomId])

  if (!roomId) {
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a">
        <Text color={coworkUi.danger}>Meeting room is not ready. Refresh and try again.</Text>
      </ScreenFill>
    )
  }

  if (config && !config.enabled) {
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a" gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Co-Work video not configured
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          Co-Work video is not available right now. Please try again later or contact support if this continues.
        </Text>
      </ScreenFill>
    )
  }

  if (loading || !credentials) {
    return (
      <ScreenCenter backgroundColor="#0c080a">
        <Spinner size="large" color={coworkUi.brand} />
        <Text color="rgba(255,255,255,0.7)" marginTop="$3">
          Joining Co-Work room…
        </Text>
      </ScreenCenter>
    )
  }

  if (error) {
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a">
        <Text color={coworkUi.danger}>{error}</Text>
      </ScreenFill>
    )
  }

  return (
    <ScreenFill backgroundColor="#0c080a" position="relative">
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio
        video
        options={getLiveKitRoomOptions()}
        onDisconnected={onDisconnected}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <NativeLiveKitMeetingContent overlay={overlay} />
      </LiveKitRoom>
    </ScreenFill>
  )
}

function NativeLiveKitMeetingContent({
  overlay,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}) {
  const liveKit = useLiveKitMediaControls()

  useEffect(() => {
    const room = liveKit.room
    if (!room) return

    const reinforceVoiceProcessing = async () => {
      if (!room.localParticipant.isMicrophoneEnabled) return
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
    }

    room.on(RoomEvent.Connected, reinforceVoiceProcessing)
    if (room.state === ConnectionState.Connected) {
      void reinforceVoiceProcessing()
    }

    return () => {
      room.off(RoomEvent.Connected, reinforceVoiceProcessing)
    }
  }, [liveKit.room])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" backgroundColor="#0c080a">
      <NativeMeetingVideoStage />
      <NativeScreenCapturePicker />
      <YStack position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="box-none" zIndex={100}>
        {overlay?.(liveKit)}
      </YStack>
    </YStack>
  )
}

function collectStageTracks(tracks: ReturnType<typeof useTracks>): TrackReference[] {
  const screenShares: TrackReference[] = []
  const cameras = new Map<string, TrackReference>()

  for (const track of tracks) {
    if (!isTrackReference(track) || track.publication?.kind !== 'video') continue

    if (track.source === Track.Source.ScreenShare || track.publication.source === Track.Source.ScreenShare) {
      screenShares.push(track)
      continue
    }

    cameras.set(track.participant.identity, track)
  }

  return [...screenShares, ...cameras.values()]
}

function NativeMeetingVideoStage() {
  const { ui: coworkUi } = useCoWorkTheme()
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop } = useAppLayout()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  const videoTracks = useMemo(() => collectStageTracks(tracks), [tracks])
  const isLandscape = width > height
  const useWideLayout = isDesktop || isTablet || width >= 768
  const layout = useMemo(
    () =>
      meetingGalleryLayout(Math.max(videoTracks.length, 1), {
        isDesktop: useWideLayout,
        isLandscape,
      }),
    [videoTracks.length, useWideLayout, isLandscape],
  )

  const topInset = Math.max(safeTop, 12) + HEADER_CLEARANCE
  // Meeting chrome is chromeless — no app tab bar. Leave room for the control dock only.
  const bottomInset = CONTROLS_CLEARANCE
  const horizontalPad = useWideLayout ? 20 : 12
  const stageWidth = Math.max(width - horizontalPad * 2, 160)
  const stageHeight = Math.max(height - topInset - bottomInset, 180)
  const solo = videoTracks.length <= 1

  const cellWidth = solo
    ? stageWidth
    : Math.floor((stageWidth - STAGE_GAP * (layout.columns - 1)) / layout.columns)
  const cellHeight = solo
    ? stageHeight
    : Math.floor((stageHeight - STAGE_GAP * (layout.rows - 1)) / layout.rows)

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor="#0c080a"
      paddingTop={topInset}
      paddingBottom={bottomInset}
      paddingHorizontal={horizontalPad}
    >
      {videoTracks.length === 0 ? (
        <YStack
          flex={1}
          width="100%"
          alignItems="center"
          justifyContent="center"
          borderRadius={coworkUi.radius.tile}
          backgroundColor="#1a1216"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.08)"
        >
          <Text color="rgba(255,255,255,0.65)" fontSize={15} fontWeight="600">
            Waiting for video…
          </Text>
          <Text color="rgba(255,255,255,0.4)" fontSize={13} marginTop="$2">
            Turn on your camera or wait for others to join
          </Text>
        </YStack>
      ) : (
        <XStack
          flex={1}
          width="100%"
          flexWrap="wrap"
          alignContent={solo ? 'stretch' : 'center'}
          justifyContent="center"
          gap={STAGE_GAP}
        >
          {videoTracks.map((trackRef) => {
            const name =
              trackRef.participant.name ||
              trackRef.participant.identity ||
              'Participant'
            const isScreen =
              trackRef.source === Track.Source.ScreenShare ||
              trackRef.publication.source === Track.Source.ScreenShare

            return (
              <YStack
                key={trackRef.publication.trackSid ?? `${trackRef.participant.identity}-${trackRef.source}`}
                width={cellWidth}
                height={cellHeight}
                maxWidth="100%"
                borderRadius={solo ? coworkUi.radius.tile : 14}
                overflow="hidden"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                backgroundColor="#1a1216"
                position="relative"
              >
                <VideoTrack
                  trackRef={trackRef}
                  style={{ width: '100%', height: '100%' }}
                  objectFit={isScreen ? 'contain' : 'cover'}
                />
                <YStack
                  position="absolute"
                  left={10}
                  bottom={10}
                  paddingHorizontal={12}
                  paddingVertical={5}
                  borderRadius={999}
                  backgroundColor="rgba(12, 8, 10, 0.72)"
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.12)"
                  maxWidth="90%"
                >
                  <Text fontSize={12} fontWeight="700" color="#fff" numberOfLines={1}>
                    {name}
                    {isScreen ? ' · Screen' : ''}
                  </Text>
                </YStack>
              </YStack>
            )
          })}
        </XStack>
      )}
    </YStack>
  )
}
