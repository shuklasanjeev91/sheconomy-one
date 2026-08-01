import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { ConnectionState, RoomEvent, Track } from 'livekit-client'

import { ensureLiveKitNativeGlobals } from '~/lib/livekit/register-native-globals'

ensureLiveKitNativeGlobals()

import {
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native'

import { Avatar, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useParticipantHandRaised } from '~/co-work/components/MeetingLiveSignalsContext'
import {
  buildParticipantMetadata,
  getParticipantAvatarUrl,
  isCameraTileOff,
  participantDisplayName,
} from '~/co-work/lib/participant-avatar'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import {
  applyPreferredCallAudioOutput,
  bindIosCallAudioManagement,
  configureLiveKitCallAudio,
  stopLiveKitCallAudio,
} from '~/co-work/lib/livekit-call-audio'
import { reinforceCallMediaOnConnect } from '~/co-work/lib/livekit-call-media'
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
import { ensureLiveKitGlobals } from '~/lib/livekit/ensure-globals'
import { useAppLayout } from '~/hooks/useAppLayout'

// Register WebRTC globals once this meeting module loads (lazy join path).
ensureLiveKitGlobals()

type NativeLiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  avatarUrl?: string | null
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
  avatarUrl,
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
  const [audioReady, setAudioReady] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setAudioReady(false)
    setAudioError(null)
    void (async () => {
      try {
        await configureLiveKitCallAudio(mediaMode)
        if (!cancelled) {
          setAudioReady(true)
          setAudioError(null)
        }
      } catch (err) {
        if (!cancelled) {
          // Do not join with a broken session — remote audio often goes silent.
          setAudioReady(false)
          setAudioError(
            err instanceof Error
              ? err.message
              : 'Could not start call audio. Check microphone permissions and try again.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
      stopLiveKitCallAudio()
      setAudioReady(false)
    }
  }, [mediaMode])

  useEffect(() => {
    if (!enabled) return
    void fetchLiveKitConfig().then(setConfig)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !roomId || !audioReady) return
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
        const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName, avatarUrl)
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
  }, [audioReady, avatarUrl, displayName, enabled, meetingId, roomId])

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

  if (audioError) {
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a" gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Could not start call audio
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          {audioError}
        </Text>
        <Text
          color={coworkUi.brand}
          fontWeight="600"
          onPress={() => {
            setAudioError(null)
            setAudioReady(false)
            void configureLiveKitCallAudio(mediaMode)
              .then(() => setAudioReady(true))
              .catch((err) =>
                setAudioError(
                  err instanceof Error
                    ? err.message
                    : 'Could not start call audio. Check microphone permissions and try again.',
                ),
              )
          }}
        >
          Try again
        </Text>
        {overlay?.(null)}
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

  if (!audioReady || loading || !credentials) {
    return (
      <ScreenFill backgroundColor="#0c080a" position="relative">
        <ScreenCenter backgroundColor="#0c080a">
          <Spinner size="large" color={coworkUi.brand} />
          <Text color="rgba(255,255,255,0.7)" marginTop="$3">
            {!audioReady ? 'Starting call audio…' : 'Joining Co-Work room…'}
          </Text>
        </ScreenCenter>
        {/* Keep host controls / leave visible while credentials load — avoids a
            chromeless dark void that reads as a blank crash on iPad. */}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="box-none"
          zIndex={100}
        >
          {overlay?.(null)}
        </YStack>
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
        video={mediaMode !== 'audio'}
        options={getLiveKitRoomOptions('native')}
        onDisconnected={onDisconnected}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <NativeLiveKitMeetingContent overlay={overlay} mediaMode={mediaMode} avatarUrl={avatarUrl} />
      </LiveKitRoom>
    </ScreenFill>
  )
}

function NativeLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
  avatarUrl,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
  avatarUrl?: string | null
}) {
  const preferSpeaker = mediaMode !== 'audio'
  const liveKit = useLiveKitMediaControls(preferSpeaker)
  const micForcedRef = useRef(false)

  useEffect(() => {
    const room = liveKit.room
    if (!room) return

    const unbindIos = bindIosCallAudioManagement(preferSpeaker)
    const unbindScreenShare = bindRemoteScreenShareQuality(room)

    const boostRemoteAudio = (publication: { setVolume?: (v: number) => void; kind?: string }) => {
      try {
        if (publication.kind === 'audio' || publication.setVolume) {
          publication.setVolume?.(1)
        }
      } catch {
        // Older publications may not expose setVolume.
      }
    }

    const syncAvatarMetadata = async () => {
      if (!avatarUrl) return
      try {
        await room.localParticipant.setMetadata(buildParticipantMetadata({ avatarUrl }))
      } catch {
        // Best-effort; token metadata usually already includes the avatar.
      }
    }

    const onConnected = () => {
      const forceMic = !micForcedRef.current
      micForcedRef.current = true
      void (async () => {
        await reinforceCallMediaOnConnect(room, mediaMode, { forceMicEnable: forceMic })
        try {
          await applyPreferredCallAudioOutput(mediaMode)
        } catch {
          // Routing is best-effort; AEC still works on the default path.
        }
        await syncAvatarMetadata()
      })()
    }

    const onTrackSubscribed = (
      track: { kind?: string },
      publication: { setVolume?: (v: number) => void; kind?: string },
    ) => {
      if (track.kind === 'audio' || publication.kind === 'audio') {
        boostRemoteAudio(publication)
      }
    }

    room.on(RoomEvent.Connected, onConnected)
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed as never)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed as never)
      unbindScreenShare()
      unbindIos()
    }
  }, [avatarUrl, liveKit.room, mediaMode, preferSpeaker])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" backgroundColor="#0c080a">
      {mediaMode === 'audio' ? null : <NativeMeetingVideoStage />}
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

  const stageTracks = layoutState.stageTracks
  const pipTrack = layoutState.pipTrack
  const hasScreenShare = layoutState.hasScreenShare
  // Three equal full-width rows — only for the 3-person gallery case.
  const isThreeStack = !hasScreenShare && stageTracks.length === 3

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
          {isThreeStack ? (
            <YStack flex={1} width="100%" height="100%" gap={STAGE_GAP}>
              {stageTracks.map((trackRef) => {
                const isScreen =
                  trackRef.source === Track.Source.ScreenShare ||
                  (isTrackReference(trackRef) &&
                    trackRef.publication.source === Track.Source.ScreenShare)
                const name = participantDisplayName(trackRef.participant)
                const tileHeight = Math.max(Math.floor((stageHeight - STAGE_GAP * 2) / 3), 100)

                return (
                  <YStack key={
                    (isTrackReference(trackRef) ? trackRef.publication.trackSid : null) ??
                    `${trackRef.participant.identity}-${trackRef.source}`
                  } flex={1} width="100%" minHeight={0}>
                    <NativeVideoTile
                      trackRef={trackRef}
                      name={name}
                      isScreen={isScreen}
                      width={stageWidth}
                      height={tileHeight}
                      radius={14}
                      fill
                    />
                  </YStack>
                )
              })}
            </YStack>
          ) : (
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
                  (isTrackReference(trackRef) &&
                    trackRef.publication.source === Track.Source.ScreenShare)
                const name = participantDisplayName(trackRef.participant)

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
                      (isTrackReference(trackRef) ? trackRef.publication.trackSid : null) ??
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
          )}

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
                name={participantDisplayName(pipTrack.participant)}
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
  fill,
}: {
  trackRef: import('@livekit/components-core').TrackReferenceOrPlaceholder
  name: string
  isScreen: boolean
  width: number
  height: number
  radius: number
  compact?: boolean
  /** When true, tile stretches to fill a flex parent (used by the 3-person stack). */
  fill?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const avatarUrl = getParticipantAvatarUrl(trackRef.participant)
  const handRaised = useParticipantHandRaised(trackRef.participant.identity)
  const cameraOff =
    !isScreen &&
    isCameraTileOff({
      source: trackRef.source,
      publication: isTrackReference(trackRef) ? trackRef.publication : null,
      isPlaceholder: !isTrackReference(trackRef),
    })

  // Android RTCView often never recovers from a 0×0 first layout ("Dropping frame - No surface").
  // Gate the VideoTrack until we have real pixel size, then mount with explicit dimensions.
  const [surfaceSize, setSurfaceSize] = useState<{ w: number; h: number } | null>(
    width > 1 && height > 1 ? { w: Math.floor(width), h: Math.floor(height) } : null,
  )

  useEffect(() => {
    if (width > 1 && height > 1) {
      setSurfaceSize({ w: Math.floor(width), h: Math.floor(height) })
    }
  }, [width, height])

  const trackSid = isTrackReference(trackRef) ? trackRef.publication.trackSid : null
  const showVideo = isTrackReference(trackRef) && !cameraOff && !!surfaceSize

  return (
    <YStack
      width={fill ? '100%' : width}
      height={fill ? '100%' : height}
      flex={fill ? 1 : undefined}
      maxWidth="100%"
      borderRadius={radius}
      overflow="hidden"
      borderWidth={handRaised && !isScreen ? 2 : 1}
      borderColor={handRaised && !isScreen ? coworkUi.brandLight : 'rgba(255,255,255,0.12)'}
      backgroundColor="#1a1216"
      position="relative"
      collapsable={false}
      onLayout={(event) => {
        const { width: layoutW, height: layoutH } = event.nativeEvent.layout
        if (layoutW > 1 && layoutH > 1) {
          const next = { w: Math.floor(layoutW), h: Math.floor(layoutH) }
          setSurfaceSize((prev) =>
            prev && prev.w === next.w && prev.h === next.h ? prev : next,
          )
        }
      }}
    >
      {showVideo && surfaceSize ? (
        <VideoTrack
          // Remount when track or size changes so EGL surface attaches cleanly.
          key={`${trackSid ?? 'track'}-${surfaceSize.w}x${surfaceSize.h}-${isScreen ? 'ss' : 'cam'}`}
          trackRef={trackRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: surfaceSize.w,
            height: surfaceSize.h,
          }}
          objectFit={isScreen ? 'contain' : 'cover'}
          mirror={false}
          zOrder={isScreen ? 0 : compact ? 1 : 0}
        />
      ) : (
        <YStack flex={1} width="100%" height="100%" alignItems="center" justifyContent="center" gap={compact ? 4 : 8}>
          {isScreen ? (
            <Text fontSize={compact ? 11 : 13} color="rgba(255,255,255,0.6)" fontWeight="600" textAlign="center" paddingHorizontal="$3">
              Receiving screen…
            </Text>
          ) : (
            <>
              <Avatar name={name} src={avatarUrl ?? undefined} size={compact ? '$5' : '$8'} />
              {!compact ? (
                <Text fontSize={12} color="rgba(255,255,255,0.55)" fontWeight="600">
                  Camera off
                </Text>
              ) : null}
            </>
          )}
        </YStack>
      )}
      {handRaised && !isScreen ? (
        <YStack
          position="absolute"
          top={compact ? 6 : 10}
          right={compact ? 6 : 10}
          width={compact ? 28 : 34}
          height={compact ? 28 : 34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(12, 8, 10, 0.78)"
          borderWidth={1}
          borderColor={coworkUi.brandLight}
          zIndex={4}
        >
          <Text fontSize={compact ? 14 : 16}>✋</Text>
        </YStack>
      ) : null}
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
        zIndex={5}
      >
        <Text fontSize={compact ? 10 : 12} fontWeight="700" color="#fff" numberOfLines={1}>
          {name}
          {isScreen ? ' · Screen' : ''}
          {handRaised && !isScreen ? ' · ✋' : ''}
        </Text>
      </YStack>
    </YStack>
  )
}
