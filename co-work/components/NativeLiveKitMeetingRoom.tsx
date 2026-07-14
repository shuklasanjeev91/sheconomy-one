import { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { ConnectionState, RoomEvent, Track, type Participant } from 'livekit-client'

import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useTracks,
  type TrackReference,
} from '@livekit/react-native'

import { Avatar, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import {
  NativeScreenCapturePicker,
  useLiveKitMediaControls,
} from '~/co-work/hooks/useLiveKitMediaControls'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { chunkGalleryRows, meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { ensureLiveKitGlobals } from '~/lib/livekit/ensure-globals'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { useAppLayout } from '~/hooks/useAppLayout'

// Runs when this module is first evaluated (meeting entry), not at app cold start.
ensureLiveKitGlobals()

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
const HEADER_CLEARANCE = 92
const CONTROLS_CLEARANCE = 118

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
    let cancelled = false
    void fetchLiveKitConfig()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting video config')
        }
      })
    return () => {
      cancelled = true
    }
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

type StageTile = {
  key: string
  name: string
  trackRef: TrackReference | null
  videoOff: boolean
  isScreen: boolean
  isLocal: boolean
}

function participantDisplayName(participant: Participant) {
  return participant.name?.trim() || participant.identity || 'Participant'
}

function isCameraOff(participant: Participant, trackRef: TrackReference | null) {
  if (!participant.isCameraEnabled) return true
  if (!trackRef) return true
  return !!trackRef.publication?.isMuted
}

function buildStageTiles(
  participants: Participant[],
  tracks: ReturnType<typeof useTracks>,
  localIdentity: string | undefined,
): StageTile[] {
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

  const cameraTiles: StageTile[] = participants.map((participant) => {
    const trackRef = cameras.get(participant.identity) ?? null
    return {
      key: `camera-${participant.identity}`,
      name: participantDisplayName(participant),
      trackRef,
      videoOff: isCameraOff(participant, trackRef),
      isScreen: false,
      isLocal: participant.identity === localIdentity,
    }
  })

  // Keep local near the start so 1:1 matches Meet (you | them) reading order.
  cameraTiles.sort((a, b) => Number(b.isLocal) - Number(a.isLocal))

  const screenTiles: StageTile[] = screenShares.map((trackRef) => ({
    key: `screen-${trackRef.publication.trackSid ?? trackRef.participant.identity}`,
    name: `${participantDisplayName(trackRef.participant)} · Screen`,
    trackRef,
    videoOff: false,
    isScreen: true,
    isLocal: trackRef.participant.identity === localIdentity,
  }))

  return [...screenTiles, ...cameraTiles]
}

function NativeParticipantTile({
  tile,
  solo,
  radius,
  mirror,
}: {
  tile: StageTile
  solo: boolean
  radius: number
  mirror?: boolean
}) {
  const showVideo = !!tile.trackRef && !tile.videoOff

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
      borderRadius={solo ? radius : 16}
      overflow="hidden"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.12)"
      backgroundColor="#1a1216"
      position="relative"
    >
      {showVideo && tile.trackRef ? (
        <VideoTrack
          trackRef={tile.trackRef}
          style={{ width: '100%', height: '100%' }}
          objectFit={tile.isScreen ? 'contain' : 'cover'}
          mirror={mirror ?? (tile.isLocal && !tile.isScreen)}
          zOrder={tile.isLocal ? 1 : 0}
        />
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2" backgroundColor="#141014">
          <Avatar name={tile.name} size={solo ? '$10' : '$8'} />
          <Text fontSize={12} color="rgba(255,255,255,0.45)" fontWeight="600">
            Camera off
          </Text>
        </YStack>
      )}

      <YStack
        position="absolute"
        left={10}
        bottom={10}
        paddingHorizontal={12}
        paddingVertical={5}
        borderRadius={999}
        backgroundColor="rgba(12, 8, 10, 0.75)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.12)"
        maxWidth="90%"
      >
        <Text fontSize={12} fontWeight="700" color="#fff" numberOfLines={1}>
          {tile.isLocal ? `${tile.name} (You)` : tile.name}
        </Text>
      </YStack>
    </YStack>
  )
}

function NativeMeetingVideoStage() {
  const { ui: coworkUi } = useCoWorkTheme()
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop } = useAppLayout()
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  const tiles = useMemo(
    () => buildStageTiles(participants, tracks, localParticipant?.identity),
    [participants, tracks, localParticipant?.identity],
  )

  const useWideLayout = isDesktop || isTablet || width >= 768
  const topInset = Math.max(safeTop, 12) + HEADER_CLEARANCE
  // Meeting chrome is chromeless — no app tab bar. Leave room for the control dock only.
  const bottomInset = CONTROLS_CLEARANCE
  const horizontalPad = useWideLayout ? 16 : 10
  const stageWidth = Math.max(width - horizontalPad * 2, 1)
  const stageHeight = Math.max(height - topInset - bottomInset, 1)

  const screenTile = tiles.find((tile) => tile.isScreen)
  const cameraTiles = tiles.filter((tile) => !tile.isScreen)
  const localCamera = cameraTiles.find((tile) => tile.isLocal) ?? null
  const remoteCameras = cameraTiles.filter((tile) => !tile.isLocal)

  // WhatsApp / Meet / Zoom 1:1 — remote fills the stage, local floats as PiP.
  const isDualCall = !screenTile && remoteCameras.length === 1 && !!localCamera
  const dualPrimary = isDualCall ? remoteCameras[0] : null
  const dualPip = isDualCall ? localCamera : null

  const galleryTiles = isDualCall ? [] : tiles
  const layout = useMemo(
    () =>
      meetingGalleryLayout(Math.max(galleryTiles.length, 1), {
        width: stageWidth,
        height: stageHeight,
      }),
    [galleryTiles.length, stageWidth, stageHeight],
  )

  const solo = galleryTiles.length <= 1
  const rows = useMemo(
    () => chunkGalleryRows(galleryTiles, layout.columns),
    [galleryTiles, layout.columns],
  )

  // Screen share: dominant top tile, cameras in a compact strip below (Meet/Zoom style).
  const screenFocus = !!screenTile && cameraTiles.length > 0

  const pipWidth = Math.min(useWideLayout ? 240 : 148, Math.floor(stageWidth * (useWideLayout ? 0.28 : 0.4)))
  const pipHeight = Math.round(pipWidth * (9 / 16))

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor="#0c080a"
      paddingTop={topInset}
      paddingBottom={bottomInset}
      paddingHorizontal={horizontalPad}
      position="relative"
    >
      {tiles.length === 0 ? (
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
            Waiting for participants…
          </Text>
          <Text color="rgba(255,255,255,0.4)" fontSize={13} marginTop="$2">
            Others will appear here when they join
          </Text>
        </YStack>
      ) : isDualCall && dualPrimary && dualPip ? (
        <>
          <YStack flex={1} width="100%" height="100%" minHeight={0}>
            <NativeParticipantTile tile={dualPrimary} solo radius={coworkUi.radius.tile} />
          </YStack>
          <YStack
            position="absolute"
            right={0}
            bottom={8}
            width={pipWidth}
            height={pipHeight}
            zIndex={20}
            borderRadius={16}
            overflow="hidden"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.2)"
            backgroundColor="#1a1216"
            elevation={8}
            shadowColor="#000"
            shadowOpacity={0.35}
            shadowRadius={12}
            shadowOffset={{ width: 0, height: 4 }}
          >
            <NativeParticipantTile tile={dualPip} solo={false} radius={16} mirror />
          </YStack>
        </>
      ) : screenFocus && screenTile ? (
        <YStack flex={1} width="100%" gap={STAGE_GAP} minHeight={0}>
          <YStack flex={3} minHeight={0} width="100%">
            <NativeParticipantTile tile={screenTile} solo={false} radius={coworkUi.radius.tile} />
          </YStack>
          <XStack flex={1} width="100%" gap={STAGE_GAP} minHeight={96}>
            {cameraTiles.map((tile) => (
              <NativeParticipantTile
                key={tile.key}
                tile={tile}
                solo={false}
                radius={coworkUi.radius.tile}
              />
            ))}
          </XStack>
        </YStack>
      ) : (
        <YStack flex={1} width="100%" height="100%" gap={STAGE_GAP} minHeight={0}>
          {rows.map((row, rowIndex) => {
            const incomplete = row.length < layout.columns
            const tileWidth =
              (stageWidth - STAGE_GAP * Math.max(layout.columns - 1, 0)) / layout.columns
            return (
              <XStack
                key={`row-${rowIndex}`}
                flex={1}
                width="100%"
                gap={STAGE_GAP}
                minHeight={0}
                justifyContent={incomplete ? 'center' : 'flex-start'}
              >
                {row.map((tile) => (
                  <YStack
                    key={tile.key}
                    flex={incomplete ? undefined : 1}
                    width={incomplete ? tileWidth : undefined}
                    minWidth={0}
                    minHeight={0}
                  >
                    <NativeParticipantTile tile={tile} solo={solo} radius={coworkUi.radius.tile} />
                  </YStack>
                ))}
              </XStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
