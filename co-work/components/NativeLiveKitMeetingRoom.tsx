import { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { ConnectionState, RoomEvent, Track } from 'livekit-client'

import { ensureLiveKitNativeGlobals } from '~/lib/livekit/register-native-globals'

ensureLiveKitNativeGlobals()

import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
  type TrackReference,
} from '@livekit/react-native'

import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import {
  NativeScreenCapturePicker,
  useLiveKitMediaControls,
} from '~/co-work/hooks/useLiveKitMediaControls.native'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { bindRemoteScreenShareQuality } from '~/co-work/lib/livekit-screen-share'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { useAppLayout } from '~/hooks/useAppLayout'

type NativeLiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

const STAGE_GAP = 10
const HEADER_CLEARANCE = 88
const CONTROLS_CLEARANCE = 108
const PIP_WIDTH = 132
const PIP_HEIGHT = 74

export function NativeLiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  enabled,
  mediaMode = 'meeting',
  onDisconnected,
  overlay,
}: NativeLiveKitMeetingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<
    ReturnType<typeof fetchLiveKitCredentials>
  > | null>(null)
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
          Co-Work video is not available right now. Please try again later or contact support if this
          continues.
        </Text>
      </ScreenFill>
    )
  }

  if (error) {
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a" gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Could not join video room
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          {error}
        </Text>
        {overlay?.(null)}
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

  return (
    <ScreenFill backgroundColor="#0c080a" position="relative">
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio
        video={mediaMode !== 'audio'}
        options={getLiveKitRoomOptions('native')}
        onDisconnected={onDisconnected}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <NativeLiveKitMeetingContent overlay={overlay} mediaMode={mediaMode} />
      </LiveKitRoom>
    </ScreenFill>
  )
}

function NativeLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
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

    const reinforceCallMedia = async () => {
      if (mediaMode === 'audio') {
        if (room.localParticipant.isCameraEnabled) {
          await room.localParticipant.setCameraEnabled(false)
        }
        if (!room.localParticipant.isMicrophoneEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          })
        }
        return
      }
      if (mediaMode === 'video' && !room.localParticipant.isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(true)
      }
    }

    const unbindScreenShare = bindRemoteScreenShareQuality(room)

    const onConnected = () => {
      void reinforceVoiceProcessing()
      void reinforceCallMedia()
    }

    room.on(RoomEvent.Connected, onConnected)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      unbindScreenShare()
    }
  }, [liveKit.room, mediaMode])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" backgroundColor="#0c080a">
      <NativeMeetingVideoStage />
      <NativeScreenCapturePicker />
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents="box-none"
        zIndex={100}
      >
        {overlay?.(liveKit)}
      </YStack>
    </YStack>
  )
}

function NativeMeetingVideoStage() {
  const { ui: coworkUi } = useCoWorkTheme()
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop } = useAppLayout()
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const layoutState = useMemo(
    () => composeMeetingStageTracks(tracks, localParticipant.identity),
    [tracks, localParticipant.identity],
  )

  const stageTracks = layoutState.stageTracks.filter(isTrackReference) as TrackReference[]
  const pipTrack =
    layoutState.pipTrack && isTrackReference(layoutState.pipTrack)
      ? (layoutState.pipTrack as TrackReference)
      : null
  const hasScreenShare = layoutState.hasScreenShare

  const useWideLayout = isDesktop || isTablet || width >= 768
  const topInset = Math.max(safeTop, 12) + HEADER_CLEARANCE
  const bottomInset = CONTROLS_CLEARANCE
  const horizontalPad = useWideLayout ? 20 : 12
  const stageWidth = Math.max(width - horizontalPad * 2, 160)
  const stageHeight = Math.max(height - topInset - bottomInset, 180)

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
      {stageTracks.length === 0 && !pipTrack ? (
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
        <YStack flex={1} width="100%" height="100%" position="relative">
          <XStack
            flex={1}
            width="100%"
            flexWrap={hasScreenShare ? 'nowrap' : 'wrap'}
            alignContent={hasScreenShare || stageTracks.length <= 1 ? 'stretch' : 'center'}
            justifyContent="center"
            gap={STAGE_GAP}
          >
            {stageTracks.map((trackRef, index) => {
              const isScreen =
                trackRef.source === Track.Source.ScreenShare ||
                trackRef.publication.source === Track.Source.ScreenShare
              const name =
                trackRef.participant.name || trackRef.participant.identity || 'Participant'

              // Screen-share focus: first tile fills the stage; extras stack below if any.
              const tileWidth = hasScreenShare
                ? stageWidth
                : stageTracks.length <= 1
                  ? stageWidth
                  : Math.floor((stageWidth - STAGE_GAP) / 2)
              const tileHeight = hasScreenShare
                ? index === 0
                  ? stageHeight
                  : Math.floor(stageHeight / 3)
                : stageTracks.length <= 1
                  ? stageHeight
                  : Math.floor((stageHeight - STAGE_GAP) / Math.ceil(stageTracks.length / 2))

              return (
                <NativeVideoTile
                  key={
                    trackRef.publication.trackSid ??
                    `${trackRef.participant.identity}-${trackRef.source}`
                  }
                  trackRef={trackRef}
                  name={name}
                  isScreen={isScreen}
                  width={tileWidth}
                  height={Math.max(tileHeight, 120)}
                  radius={hasScreenShare && index === 0 ? coworkUi.radius.tile : 14}
                />
              )
            })}
          </XStack>

          {pipTrack ? (
            <YStack
              position="absolute"
              right={0}
              bottom={0}
              width={PIP_WIDTH}
              height={PIP_HEIGHT}
              borderRadius={12}
              overflow="hidden"
              borderWidth={2}
              borderColor={coworkUi.brand}
              backgroundColor="#1a1216"
              zIndex={20}
            >
              <NativeVideoTile
                trackRef={pipTrack}
                name={
                  pipTrack.participant.name ||
                  pipTrack.participant.identity ||
                  'You'
                }
                isScreen={false}
                width={PIP_WIDTH}
                height={PIP_HEIGHT}
                radius={10}
                compact
              />
            </YStack>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}

function NativeVideoTile({
  trackRef,
  name,
  isScreen,
  width,
  height,
  radius,
  compact,
}: {
  trackRef: TrackReference
  name: string
  isScreen: boolean
  width: number
  height: number
  radius: number
  compact?: boolean
}) {
  return (
    <YStack
      width={width}
      height={height}
      maxWidth="100%"
      borderRadius={radius}
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
        left={compact ? 6 : 10}
        bottom={compact ? 6 : 10}
        paddingHorizontal={compact ? 8 : 12}
        paddingVertical={compact ? 3 : 5}
        borderRadius={999}
        backgroundColor="rgba(12, 8, 10, 0.72)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.12)"
        maxWidth="90%"
      >
        <Text fontSize={compact ? 10 : 12} fontWeight="700" color="#fff" numberOfLines={1}>
          {name}
          {isScreen ? ' · Screen' : ''}
        </Text>
      </YStack>
    </YStack>
  )
}
