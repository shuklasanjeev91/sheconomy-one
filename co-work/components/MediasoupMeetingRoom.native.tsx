// Keep first: WebRTC extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useKeepAwake } from 'expo-keep-awake'
import { MediaStream as RNMediaStream, RTCView } from 'react-native-webrtc'

import { Spinner, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { MeetingLifecycleBanner } from '~/co-work/components/MeetingLifecycleBanner'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { NativeMeetingVideoStageView } from '~/co-work/components/NativeMeetingVideoStageView'
import {
  NativeScreenCapturePicker,
  showIosBroadcastPicker,
} from '~/co-work/components/NativeScreenCapturePicker.native'
import {
  NativeVideoTileChrome,
  type NativeStageTileProps,
} from '~/co-work/components/NativeVideoTileChrome'
import { useMeetingLifecycle } from '~/co-work/hooks/useMeetingLifecycle.native'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.native'
import { useMediasoupGalleryTracks } from '~/co-work/hooks/useMediasoupGalleryTracks'
import {
  useMediasoupMeeting,
  type MediasoupMeeting,
  type MediasoupMeetingPlatform,
} from '~/co-work/hooks/useMediasoupMeeting'
import { androidPresentUnavailable, ANDROID_PRESENT_UNAVAILABLE_MESSAGE } from '~/co-work/lib/android-present-build'
import {
  applyPreferredCallAudioOutput,
  configureCallAudio,
  getActiveCallMediaMode,
  stopCallAudio,
  toggleCallSpeaker,
} from '~/co-work/lib/call-audio'
import type { MeetingMediaMode, MeetingRoomProps } from '~/co-work/lib/meeting-media-controls'
import { ensureNativeMicrophonePermission } from '~/co-work/lib/meeting-media-permissions'
import { softMediaToggleFailure } from '~/co-work/lib/meeting-mobile'
import {
  MEETING_SUBSCRIBE_ALL_BELOW,
  meetingCameraQualityForTile,
} from '~/co-work/lib/meeting-selective-subscribe'
import { shouldMirrorMeetingVideo } from '~/co-work/lib/meeting-video-mirror'
import { nextMeetingVideoSurfaceSize } from '~/co-work/lib/meeting-video-surface'
import type { MediasoupCredentials } from '~/co-work/lib/mediasoup/mediasoup-credentials'
import {
  mediasoupTrackKey,
  mediasoupViewingScreenShare,
  mediasoupVisibleUserIds,
  type MediasoupTrackRef,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { getIosPipVideoRef, registerIosPipVideoRef } from '~/lib/session/ios-pip-registry'
import { ensureWebRTCGlobals } from '~/lib/webrtc/ensure-globals'

function isAbortOrCancelError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? '')
  return /AbortError|NotAllowedError|cancelled|canceled/i.test(text)
}

function nativePlatform(mediaMode: MeetingMediaMode): MediasoupMeetingPlatform {
  return {
    native: true,
    handlerName: 'ReactNative106',
    prepare: ensureWebRTCGlobals,
    useVideoEffects: useMeetingVideoEffects,
    initialSpeakerOn: mediaMode !== 'audio',
    errorMessage: (kind, cause) => {
      if (kind === 'screen_share' && Platform.OS === 'ios' && isAbortOrCancelError(cause)) {
        return 'Screen share was cancelled. Choose SHEconomy → Start Broadcast in the system sheet.'
      }
      if (cause instanceof Error && cause.message === ANDROID_PRESENT_UNAVAILABLE_MESSAGE) {
        return cause.message
      }
      return softMediaToggleFailure(kind, cause)
    },
    beforeMicEnable: async () => {
      const permission = await ensureNativeMicrophonePermission()
      if (!permission.granted) {
        return (
          permission.message ??
          softMediaToggleFailure('microphone', undefined, {
            blockedInSettings: permission.blockedInSettings,
          })
        )
      }
      // Re-assert the call audio session before first publish after a muted join.
      await configureCallAudio(getActiveCallMediaMode()).catch(() => {})
      return null
    },
    beforeScreenShare: async () => {
      if (androidPresentUnavailable()) throw new Error(ANDROID_PRESENT_UNAVAILABLE_MESSAGE)
      if (Platform.OS !== 'ios') return
      if (Constants.isDevice === false) {
        throw new Error('Screen sharing requires a physical iPhone or iPad.')
      }
      // Show the ReplayKit picker first; getDisplayMedia then waits for Start Broadcast.
      await showIosBroadcastPicker()
    },
    setSpeaker: async (speakerOn) => (await toggleCallSpeaker(speakerOn)) === 'speaker',
  }
}

/** RTCView tile for one mediasoup camera or screen share. */
function NativeMediasoupVideoTile({
  trackRef,
  name,
  isScreen,
  width,
  height,
  radius,
  compact,
  floating = false,
  mirrorLocalVideo,
  hdVideo = true,
  activeSpeaker,
  localScreenShareActive = false,
  onPreferredLayer,
  onScreenAttached,
}: NativeStageTileProps<MediasoupTrackRef> & {
  onPreferredLayer: (userId: string, spatialLayer: number) => void
  onScreenAttached: (userId: string) => void
}) {
  const { blockVideoSurfaces, stopIncomingVideo } = useMeetingLiveSignals()
  const [surfacesAllowed, setSurfacesAllowed] = useState(!blockVideoSurfaces)
  useEffect(() => {
    if (blockVideoSurfaces) {
      setSurfacesAllowed(false)
      return
    }
    const timer = setTimeout(() => setSurfacesAllowed(true), 80)
    return () => clearTimeout(timer)
  }, [blockVideoSurfaces])

  // Android RTCView often never recovers from a 0×0 first layout ("Dropping frame - No surface").
  const [surfaceSize, setSurfaceSize] = useState<{ w: number; h: number } | null>(
    width > 1 && height > 1 ? nextMeetingVideoSurfaceSize(null, { w: width, h: height }) : null,
  )
  useEffect(() => {
    if (width > 1 && height > 1) {
      setSurfaceSize((prev) => nextMeetingVideoSurfaceSize(prev, { w: width, h: height }))
    }
  }, [width, height])

  const participant = trackRef.participant
  const stopRemoteCamera = stopIncomingVideo && !participant.isLocal && !isScreen
  const track = stopRemoteCamera ? null : (trackRef.publication?.track ?? null)
  const stream = useMemo(
    () => (track ? new RNMediaStream([track as never]) : null),
    [track],
  )
  useEffect(
    () => () => {
      stream?.release(false)
    },
    [stream],
  )

  const cameraQuality = meetingCameraQualityForTile({ width, height, hdVideo })
  useEffect(() => {
    if (isScreen || participant.isLocal || !trackRef.publication) return
    onPreferredLayer(participant.identity, Number(cameraQuality))
  }, [cameraQuality, isScreen, onPreferredLayer, participant.identity, participant.isLocal, trackRef.publication])

  const facing = (track as (MediaStreamTrack & { getSettings?: () => { facingMode?: string } }) | null)
    ?.getSettings?.()?.facingMode
  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: participant.isLocal,
    isScreenShare: isScreen,
    source: trackRef.source,
    cameraFacing: facing === 'environment' ? 'environment' : 'user',
  })
  const localScreenShare = isScreen && participant.isLocal
  const videoRef = useRef(null)
  // Android SurfaceView cannot be captured by MediaProjection — keep local tiles plain while sharing.
  const hideLocalSurface = localScreenShareActive && participant.isLocal
  const shouldRenderVideo =
    !localScreenShare &&
    !hideLocalSurface &&
    !blockVideoSurfaces &&
    surfacesAllowed &&
    !!stream &&
    !!surfaceSize

  // Size changes remount the surface, and a remounted surface has no frame yet.
  const rtcViewKey =
    stream && surfaceSize ? `${stream.id}-${surfaceSize.w}x${surfaceSize.h}-${mirrored ? 'm' : 'n'}` : null
  const needsScreenFrame = shouldRenderVideo && isScreen && !participant.isLocal
  useEffect(() => {
    if (!needsScreenFrame || !rtcViewKey) return
    const timer = setTimeout(() => onScreenAttached(participant.identity), 250)
    return () => clearTimeout(timer)
  }, [needsScreenFrame, onScreenAttached, participant.identity, rtcViewKey])

  // Camera only for PiP — screen-share PiP blanks the in-meeting stage on iPad.
  // No PiP while presenting: ReplayKit would record the floating window into the share.
  const pipAllowed = Platform.OS === 'ios' && !isScreen && !localScreenShareActive
  const isPipCandidate = pipAllowed && shouldRenderVideo && (activeSpeaker || participant.isLocal)
  useEffect(() => {
    if (!isPipCandidate) return
    registerIosPipVideoRef(videoRef)
    return () => {
      if (getIosPipVideoRef() === videoRef) registerIosPipVideoRef(null)
    }
  }, [isPipCandidate])

  return (
    <NativeVideoTileChrome
      identity={participant.identity}
      name={name}
      avatarUrl={participant.avatarUrl}
      isScreen={isScreen}
      micMuted={!isScreen && !participant.isMicrophoneEnabled}
      stopRemoteCamera={stopRemoteCamera}
      connecting={!!participant.isConnecting}
      screenPlaceholder={
        isScreen || hideLocalSurface
          ? localScreenShare || hideLocalSurface
            ? 'Sharing your screen'
            : 'Receiving screen…'
          : null
      }
      width={width}
      height={height}
      radius={radius}
      compact={compact}
      activeSpeaker={activeSpeaker}
      onSurfaceLayout={(layoutW, layoutH) =>
        setSurfaceSize((prev) => nextMeetingVideoSurfaceSize(prev, { w: layoutW, h: layoutH }))
      }
      video={
        shouldRenderVideo && stream && rtcViewKey && surfaceSize ? (
          <RTCView
            key={rtcViewKey}
            ref={videoRef}
            streamURL={stream.toURL()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: surfaceSize.w,
              height: surfaceSize.h,
              backgroundColor: '#0c080a',
            }}
            objectFit={isScreen ? 'contain' : 'cover'}
            mirror={mirrored}
            // Camera tiles stay at zOrder 0 so they don't punch through the meeting chrome.
            zOrder={isScreen || floating ? 1 : 0}
            iosPIP={
              Platform.OS === 'ios' && !isScreen
                ? { enabled: pipAllowed, startAutomatically: pipAllowed, preferredSize: { width: 9, height: 16 } }
                : undefined
            }
          />
        ) : null
      }
    />
  )
}

function NativeMediasoupVideoStage({ meeting }: { meeting: MediasoupMeeting }) {
  const { room } = meeting
  const layoutState = useMediasoupGalleryTracks({
    trackRefs: meeting.trackRefs,
    localUserId: meeting.localUserId,
    activeSpeakerIdentity: meeting.activeSpeakerIdentity,
    mediaConnected: meeting.snapshot.connection === 'connected',
  })
  const remotePeerCount = meeting.snapshot.peers.length
  const onVisibleIdentities = useCallback(
    (identities: Set<string>) =>
      room?.setVisibleUserIds(
        mediasoupVisibleUserIds(identities, remotePeerCount, MEETING_SUBSCRIBE_ALL_BELOW),
      ),
    [remotePeerCount, room],
  )
  const onPreferredLayer = useCallback(
    (userId: string, spatialLayer: number) => room?.setPreferredVideoLayer(userId, spatialLayer),
    [room],
  )
  const onScreenAttached = useCallback((userId: string) => room?.requestScreenKeyFrame(userId), [room])
  const renderTile = useCallback(
    (props: NativeStageTileProps<MediasoupTrackRef>) => (
      <NativeMediasoupVideoTile
        {...props}
        onPreferredLayer={onPreferredLayer}
        onScreenAttached={onScreenAttached}
      />
    ),
    [onPreferredLayer, onScreenAttached],
  )
  const toggleScreenShare = meeting.media?.toggleScreenShare
  const onStopScreenShare = useCallback(() => {
    void Promise.resolve(toggleScreenShare?.()).catch(() => {})
  }, [toggleScreenShare])
  return (
    <NativeMeetingVideoStageView
      layoutState={layoutState}
      activeSpeakerIdentity={meeting.activeSpeakerIdentity}
      onVisibleIdentities={onVisibleIdentities}
      tileKey={mediasoupTrackKey}
      renderTile={renderTile}
      onStopScreenShare={onStopScreenShare}
    />
  )
}

function NativeMediasoupMeetingContent({
  credentials,
  displayName,
  avatarUrl,
  mediaMode,
  initialAudio,
  initialVideo,
  onConnected,
  onDisconnected,
  overlay,
}: MeetingRoomProps & {
  credentials: MediasoupCredentials
  mediaMode: MeetingMediaMode
  initialAudio: boolean
  initialVideo: boolean
}) {
  useKeepAwake('sheconomy-meeting-native', { suppressDeactivateWarnings: true })
  const platform = useMemo(() => nativePlatform(mediaMode), [mediaMode])
  const meeting = useMediasoupMeeting({
    credentials,
    displayName,
    avatarUrl,
    mediaMode,
    initialAudio,
    initialVideo,
    onConnected,
    onDisconnected,
    platform,
  })
  const { blockVideoSurfaces } = useMeetingLiveSignals()
  const { ui: coworkUi } = useCoWorkTheme()
  const connection = meeting.snapshot.connection
  useEffect(() => {
    if (connection !== 'connected') return
    // Routing is best-effort; AEC still works on the default path.
    void applyPreferredCallAudioOutput(mediaMode).catch(() => {})
  }, [connection, mediaMode])

  const lifecycle = useMeetingLifecycle({
    room: meeting.room,
    connection,
    mediaMode,
    screenSharing: meeting.snapshot.local.screenSharing,
    viewingScreenShare: mediasoupViewingScreenShare(meeting.snapshot),
    cameraEnabled: meeting.snapshot.local.cameraEnabled,
  })

  const lifecycleNotice =
    lifecycle.notice ?? (connection === 'connecting' ? 'Connecting audio and video…' : null)

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" backgroundColor={coworkUi.pageBg}>
      {mediaMode === 'audio' ? null : <NativeMediasoupVideoStage meeting={meeting} />}
      <MeetingLifecycleBanner notice={lifecycleNotice} topOffset={90} />
      <NativeScreenCapturePicker />
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents={blockVideoSurfaces ? 'auto' : 'box-none'}
        zIndex={blockVideoSurfaces ? 200_000 : 100}
        elevation={blockVideoSurfaces ? 48 : 0}
        collapsable={false}
      >
        {overlay?.(meeting.media)}
      </YStack>
    </YStack>
  )
}

export function MediasoupMeetingRoom({
  credentials,
  mediaMode = 'meeting',
  initialAudio = true,
  initialVideo = true,
  overlay,
  ...props
}: MeetingRoomProps & { credentials: MediasoupCredentials }) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [audioReady, setAudioReady] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [audioAttempt, setAudioAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setAudioReady(false)
    setAudioError(null)
    void configureCallAudio(mediaMode)
      .then(() => {
        if (!cancelled) setAudioReady(true)
      })
      .catch((error) => {
        // Do not join with a broken session — remote audio often goes silent.
        if (!cancelled) {
          setAudioError(
            error instanceof Error
              ? error.message
              : 'Could not start call audio. Check microphone permissions and try again.',
          )
        }
      })
    return () => {
      cancelled = true
      stopCallAudio()
    }
  }, [audioAttempt, mediaMode])

  if (audioError) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg} gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Could not start call audio
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          {audioError}
        </Text>
        <Text color={coworkUi.brandLight} fontWeight="600" onPress={() => setAudioAttempt((value) => value + 1)}>
          Try again
        </Text>
        {overlay?.(null)}
      </ScreenFill>
    )
  }

  if (!audioReady) {
    return (
      <ScreenFill backgroundColor={coworkUi.pageBg} position="relative">
        <ScreenCenter backgroundColor={coworkUi.pageBg}>
          <Spinner size="large" color={coworkUi.brandLight} />
          <Text color={coworkUi.textSecondary} marginTop="$3">
            Starting call audio…
          </Text>
        </ScreenCenter>
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="box-none" zIndex={100}>
          {overlay?.(null)}
        </YStack>
      </ScreenFill>
    )
  }

  return (
    <ScreenFill backgroundColor={coworkUi.pageBg} position="relative">
      <NativeMediasoupMeetingContent
        {...props}
        credentials={credentials}
        mediaMode={mediaMode}
        initialAudio={initialAudio}
        initialVideo={initialVideo}
        overlay={overlay}
      />
    </ScreenFill>
  )
}
