// Keep first: `livekit-client` extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView as NativeScrollView, useWindowDimensions } from 'react-native'
import { ConnectionState, DisconnectReason, RoomEvent, Track, VideoQuality } from 'livekit-client'
import type { RemoteTrackPublication } from 'livekit-client'
import {
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/react-native'

import { Avatar, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  useParticipantHandRaised,
  useParticipantMeetingRole,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import {
  buildParticipantMetadata,
  getParticipantAvatarUrl,
  isCameraTileOff,
  participantDisplayName,
} from '~/co-work/lib/participant-avatar'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { MeetingLifecycleBanner } from '~/co-work/components/MeetingLifecycleBanner'
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
import { useMeetingLifecycle } from '~/co-work/hooks/useMeetingLifecycle.native'
import { useMeetingActiveSpeaker } from '~/co-work/hooks/useMeetingActiveSpeaker'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { bindRemoteScreenShareQuality } from '~/co-work/lib/livekit-screen-share'
import { resolveNativeVideoStreamAttachId } from '~/co-work/lib/native-video-stream-ready'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'
import { shouldMirrorMeetingVideo } from '~/co-work/lib/meeting-video-mirror'
import {
  getIosPipVideoRef,
  registerIosPipVideoRef,
} from '~/lib/session/ios-pip-registry'
import {
  capFilmstripTracks,
  meetingGalleryLayout,
  paginateMeetingGallery,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import {
  meetingStageContentBox,
  resolveMeetingChromeLayout,
} from '~/co-work/lib/meeting-orientation-layout'
import {
  applyMeetingUiChromeLayout,
  resolveMeetingUiChromePadding,
} from '~/co-work/lib/meeting-ui-chrome'
import { applyMeetingSelectiveCameraSubscribe } from '~/co-work/lib/meeting-selective-subscribe'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { ensureLiveKitGlobals } from '~/lib/livekit/ensure-globals'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

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
  initialAudio?: boolean
  initialVideo?: boolean
  onConnected?: () => void
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

const STAGE_GAP = 10

export function NativeLiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  avatarUrl,
  enabled,
  mediaMode = 'meeting',
  initialAudio = true,
  initialVideo = true,
  onConnected,
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
  const [retryKey, setRetryKey] = useState(0)

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
        // Token / config failures stay on this screen — do not escalate to the
        // parent "Unable to reconnect" full-page via onDisconnected.
        setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [audioReady, avatarUrl, displayName, enabled, meetingId, retryKey, roomId])

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
    const friendlyError = /non-2xx|Edge Function/i.test(error)
      ? 'Could not join the video room. Check your connection and try again.'
      : error
    return (
      <ScreenFill padding="$4" backgroundColor="#0c080a" gap="$3" position="relative">
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
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          padding="$6"
          gap="$3"
          zIndex={120}
          pointerEvents="box-none"
        >
          <YStack
            maxWidth={420}
            width="100%"
            gap="$3"
            padding="$5"
            borderRadius={16}
            backgroundColor="rgba(36,17,24,0.96)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.12)"
            pointerEvents="auto"
          >
            <Text color={coworkUi.danger} fontWeight="800" fontSize={18}>
              Could not join video room
            </Text>
            <Text color={coworkUi.textSecondary} lineHeight={22}>
              {friendlyError}
            </Text>
            <Text
              color={coworkUi.brand}
              fontWeight="700"
              onPress={() => {
                setError(null)
                setCredentials(null)
                setRetryKey((value) => value + 1)
              }}
            >
              Try again
            </Text>
          </YStack>
        </YStack>
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
        audio={initialAudio}
        video={mediaMode !== 'audio' && initialVideo}
        options={getLiveKitRoomOptions('native')}
        onConnected={onConnected}
        onDisconnected={(reason) => {
          if (reason === DisconnectReason.CLIENT_INITIATED) return
          onDisconnected()
        }}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <NativeLiveKitMeetingContent
          overlay={overlay}
          mediaMode={mediaMode}
          avatarUrl={avatarUrl}
          initialAudio={initialAudio}
        />
      </LiveKitRoom>
    </ScreenFill>
  )
}

function NativeLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
  avatarUrl,
  initialAudio = true,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
  avatarUrl?: string | null
  initialAudio?: boolean
}) {
  const preferSpeaker = mediaMode !== 'audio'
  const liveKit = useLiveKitMediaControls(preferSpeaker)
  const micForcedRef = useRef(false)
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  const hasRemoteScreenShare = tracks.some(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.participant.identity !== liveKit.room.localParticipant.identity,
  )
  const viewingScreenShare = hasRemoteScreenShare && !liveKit.screenSharing

  const { notice: lifecycleNotice } = useMeetingLifecycle({
    room: liveKit.room,
    mediaMode,
    screenSharing: liveKit.screenSharing,
    viewingScreenShare,
    cameraEnabled: liveKit.videoEnabled,
    speakerOn: liveKit.speakerOn,
  })

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
      const forceMic = !micForcedRef.current && initialAudio
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
  }, [avatarUrl, initialAudio, liveKit.room, mediaMode, preferSpeaker])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" backgroundColor="#0c080a">
      {mediaMode === 'audio' ? null : <NativeMeetingVideoStage />}
      <MeetingLifecycleBanner notice={lifecycleNotice} topOffset={90} />
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
  const { state, dispatch } = useMeetingMachine()
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const chrome = useMemo(() => {
    const base = resolveMeetingChromeLayout({
      width,
      height,
      safeTop,
      safeBottom,
      safeLeft,
      safeRight,
      isTablet,
      isDesktop,
      isNative: true,
    })
    return applyMeetingUiChromeLayout(
      base,
      resolveMeetingUiChromePadding({
        chrome: base,
        uiMode: state.uiMode,
        controlsVisible: state.controlsVisible,
        safeTop,
        safeBottom,
      }),
    )
  }, [
    height,
    isDesktop,
    isTablet,
    safeBottom,
    safeLeft,
    safeRight,
    safeTop,
    state.controlsVisible,
    state.uiMode,
    width,
  ])
  const { localParticipant } = useLocalParticipant()
  const room = useRoomContext()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const activeSpeakerIdentity = useMeetingActiveSpeaker({
    room,
    tracks,
    enabled: state.viewMode === 'speaker' || state.viewMode === 'screen-share',
  })
  const layoutState = useMemo(
    () =>
      composeMeetingStageTracks(
        tracks,
        localParticipant.identity,
        state.viewMode,
        activeSpeakerIdentity,
        state.hideSelfView,
      ),
    [activeSpeakerIdentity, localParticipant.identity, state.hideSelfView, state.viewMode, tracks],
  )

  const [page, setPage] = useState(0)
  const pageSize = resolveMeetingGalleryPageSize({
    basePageSize: chrome.pageSize,
    denseGallery: state.denseGallery,
    breakpoint: chrome.breakpoint,
  })
  const paged = useMemo(
    () => paginateMeetingGallery(layoutState.stageTracks, page, pageSize),
    [layoutState.stageTracks, page, pageSize],
  )
  useEffect(() => {
    if (paged.page !== page) setPage(paged.page)
  }, [page, paged.page])
  const stageTracks = paged.items
  const filmstripCapped = useMemo(
    () => capFilmstripTracks(layoutState.filmstripTracks),
    [layoutState.filmstripTracks],
  )
  const filmstripTracks = filmstripCapped.visible
  const hasScreenShare = layoutState.hasScreenShare
  const isLocalScreenSharing = layoutState.isLocalScreenSharing
  const previousScreenShare = useRef(false)

  useEffect(() => {
    const identities = new Set<string>()
    for (const track of stageTracks) identities.add(track.participant.identity)
    for (const track of filmstripTracks) identities.add(track.participant.identity)
    for (const track of layoutState.stageTracks) {
      if (track.participant.isSpeaking) identities.add(track.participant.identity)
    }
    applyMeetingSelectiveCameraSubscribe(room, identities)
  }, [filmstripTracks, layoutState.stageTracks, room, stageTracks])

  useEffect(() => {
    if (hasScreenShare && !previousScreenShare.current) {
      dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
    } else if (!hasScreenShare && state.viewMode === 'screen-share') {
      dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
    }
    previousScreenShare.current = hasScreenShare
  }, [dispatch, hasScreenShare, state.viewMode])

  const showFilmstrip = layoutState.filmstripTracks.length > 0
  const speakerMode = state.viewMode === 'speaker'
  // Speaker view always keeps a filmstrip of the other participants (side on
  // wide layouts, bottom strip on portrait phones).
  const filmstripBeside = speakerMode ? chrome.filmstripBeside || width >= 700 : chrome.filmstripBeside
  const filmstripExpanded = showFilmstrip && !state.participantStripMinimized
  const screenLayout = state.viewMode === 'screen-share' && hasScreenShare
  const { width: mainWidth, height: mainHeight } = meetingStageContentBox({
    viewportWidth: width,
    viewportHeight: height,
    chrome: speakerMode
      ? {
          ...chrome,
          filmstripBeside,
          filmstripWidth: filmstripBeside ? Math.max(chrome.filmstripWidth, 112) : chrome.filmstripWidth,
          filmstripHeight: filmstripBeside ? chrome.filmstripHeight : Math.max(chrome.filmstripHeight, 92),
        }
      : chrome,
    filmstripExpanded,
  })
  const gallery = meetingGalleryLayout(stageTracks.length, {
    width: mainWidth,
    height: mainHeight,
    preferWide: chrome.galleryPreferWide,
  })

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor="#0c080a"
      paddingTop={chrome.stagePaddingTop}
      paddingBottom={chrome.stagePaddingBottom}
      paddingLeft={chrome.stagePaddingLeft}
      paddingRight={chrome.stagePaddingRight}
    >
      {stageTracks.length === 0 ? (
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
            {isLocalScreenSharing ? 'You’re presenting' : 'Waiting for video…'}
          </Text>
          <Text color="rgba(255,255,255,0.4)" fontSize={13} marginTop="$2">
            {isLocalScreenSharing
              ? 'Your screen is visible to other participants'
              : 'Turn on your camera or wait for others to join'}
          </Text>
        </YStack>
      ) : (
        <YStack flex={1} width="100%" height="100%" position="relative">
          <XStack
            width={mainWidth}
            height={mainHeight}
            flexWrap={screenLayout ? 'nowrap' : 'wrap'}
            alignContent={screenLayout || stageTracks.length <= 1 ? 'stretch' : 'center'}
            justifyContent="center"
            gap={STAGE_GAP}
          >
            {stageTracks.map((trackRef, index) => {
              const isScreen =
                trackRef.source === Track.Source.ScreenShare ||
                (isTrackReference(trackRef) &&
                  trackRef.publication.source === Track.Source.ScreenShare)
              const name = participantDisplayName(trackRef.participant)

              // Screen-share focus fills the stage. Camera galleries share one
              // responsive layout with web: 2×2 for three/four on portrait devices.
              const tileWidth = screenLayout
                ? mainWidth
                : Math.floor(
                    (mainWidth - STAGE_GAP * Math.max(gallery.columns - 1, 0)) /
                      gallery.columns,
                  )
              const tileHeight = screenLayout
                ? index === 0
                  ? mainHeight
                  : Math.floor(mainHeight / 3)
                : Math.floor(
                    (mainHeight - STAGE_GAP * Math.max(gallery.rows - 1, 0)) /
                      gallery.rows,
                  )

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
                  height={Math.max(tileHeight, chrome.policy === 'landscape-phone' ? 72 : 100)}
                  radius={screenLayout && index === 0 ? coworkUi.radius.tile : 14}
                  mirrorLocalVideo={state.mirrorLocalVideo}
                  activeSpeaker={
                    !isScreen &&
                    (trackRef.participant.isSpeaking ||
                      trackRef.participant.identity === activeSpeakerIdentity)
                  }
                />
              )
            })}
          </XStack>

          {filmstripExpanded ? (
            <NativeScrollView
              style={{
                position: 'absolute',
                right: 0,
                bottom: filmstripBeside ? undefined : 0,
                top: filmstripBeside ? 0 : undefined,
                width: filmstripBeside ? chrome.filmstripWidth : '100%',
                height: filmstripBeside ? mainHeight : chrome.filmstripHeight,
              }}
              horizontal={!filmstripBeside}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <XStack flexDirection={filmstripBeside ? 'column' : 'row'} gap="$2">
                {filmstripTracks.map((trackRef) => (
                  <NativeVideoTile
                    key={`${trackRef.participant.identity}-${trackRef.source}-strip`}
                    trackRef={trackRef}
                    name={participantDisplayName(trackRef.participant)}
                    isScreen={false}
                    width={chrome.pipWidth}
                    height={chrome.pipHeight}
                    radius={10}
                    compact
                    mirrorLocalVideo={state.mirrorLocalVideo}
                    activeSpeaker={trackRef.participant.isSpeaking}
                  />
                ))}
                {filmstripCapped.overflow > 0 ? (
                  <YStack
                    width={chrome.pipWidth}
                    height={chrome.pipHeight}
                    borderRadius={10}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="rgba(255,255,255,0.12)"
                  >
                    <Text color="#fff" fontWeight="800" fontSize={16}>
                      +{filmstripCapped.overflow}
                    </Text>
                  </YStack>
                ) : null}
              </XStack>
            </NativeScrollView>
          ) : null}
          {showFilmstrip ? (
            <YStack
              position="absolute"
              right={filmstripBeside ? 4 : 8}
              bottom={
                filmstripBeside ? 4 : filmstripExpanded ? chrome.filmstripHeight + 4 : 8
              }
              width={44}
              height={44}
              zIndex={25}
              alignItems="center"
              justifyContent="center"
              borderRadius={999}
              backgroundColor="rgba(12,8,10,0.9)"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.18)"
              accessibilityRole="button"
              accessibilityLabel={
                state.participantStripMinimized
                  ? 'Maximize participant filmstrip'
                  : 'Minimize participant filmstrip'
              }
              onPress={() => dispatch({ type: 'TOGGLE_PARTICIPANT_STRIP' })}
            >
              <Text
                color="#fff"
                fontSize={20}
                fontWeight="800"
                lineHeight={24}
              >
                {state.participantStripMinimized ? '+' : '−'}
              </Text>
            </YStack>
          ) : null}
          {paged.pageCount > 1 ? (
            <XStack position="absolute" bottom={4} alignSelf="center" gap="$2" alignItems="center">
              <Text
                color={paged.page === 0 ? 'rgba(255,255,255,0.35)' : '#fff'}
                fontWeight="700"
                onPress={paged.page === 0 ? undefined : () => setPage((value) => value - 1)}
              >
                Previous
              </Text>
              <Text color="#fff" fontSize={12}>{paged.page + 1} / {paged.pageCount}</Text>
              <Text
                color={paged.page === paged.pageCount - 1 ? 'rgba(255,255,255,0.35)' : '#fff'}
                fontWeight="700"
                onPress={paged.page === paged.pageCount - 1 ? undefined : () => setPage((value) => value + 1)}
              >
                Next
              </Text>
            </XStack>
          ) : null}
        </YStack>
      )}
      {(() => {
        const label = screenShareRoleLabel(
          isLocalScreenSharing ? 'sharing' : hasScreenShare ? 'viewing' : 'none',
        )
        return label ? (
          <YStack
            position="absolute"
            top={chrome.stagePaddingTop + 8}
            alignSelf="center"
            zIndex={30}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={999}
            backgroundColor={
              isLocalScreenSharing ? 'rgba(5,150,105,0.94)' : 'rgba(37,99,235,0.92)'
            }
            borderWidth={1}
            borderColor={
              isLocalScreenSharing ? 'rgba(167,243,208,0.48)' : 'rgba(147,197,253,0.5)'
            }
            pointerEvents="none"
          >
            <Text color="#ecfdf5" fontSize={12} fontWeight="700">
              {label}
            </Text>
          </YStack>
        ) : null
      })()}
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
  mirrorLocalVideo,
  activeSpeaker,
}: {
  trackRef: import('@livekit/components-core').TrackReferenceOrPlaceholder
  name: string
  isScreen: boolean
  width: number
  height: number
  radius: number
  compact?: boolean
  mirrorLocalVideo: boolean
  activeSpeaker: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const avatarUrl = getParticipantAvatarUrl(trackRef.participant)
  const handRaised = useParticipantHandRaised(trackRef.participant.identity)
  const meetingRole = useParticipantMeetingRole(trackRef.participant.identity)
  const micMuted = !isScreen && trackRef.participant.isMicrophoneEnabled === false
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

  const publication = isTrackReference(trackRef) ? trackRef.publication : null
  const mediaTrack = publication?.track ?? null
  const trackSid = publication?.trackSid ?? null

  // LiveKit often creates RemoteVideoTrack before MediaStream attaches (especially
  // Android→iOS screen share). LiveKit's VideoTrack only syncs mediaStream on
  // track identity change — mounting RTCView with empty toURL() permanently blanks.
  // Wait for mediaStream.id, then remount VideoTrack with that token.
  const [streamAttachId, setStreamAttachId] = useState<string | null>(
    () => resolveNativeVideoStreamAttachId(mediaTrack),
  )
  useEffect(() => {
    if (!mediaTrack) {
      setStreamAttachId(null)
      return
    }
    const readId = () => resolveNativeVideoStreamAttachId(mediaTrack)
    const immediate = readId()
    if (immediate) {
      setStreamAttachId(immediate)
      return
    }
    setStreamAttachId(null)
    const poll = setInterval(() => {
      const next = readId()
      if (!next) return
      setStreamAttachId(next)
      clearInterval(poll)
    }, 150)
    const stop = setTimeout(() => clearInterval(poll), 30_000)
    return () => {
      clearInterval(poll)
      clearTimeout(stop)
    }
  }, [mediaTrack, trackSid])

  // Only treat the surface as ready once MediaStream exists — never use track.sid alone.
  const mediaReadyToken = streamAttachId
  const trackDims = (() => {
    try {
      const settings = mediaTrack?.mediaStreamTrack?.getSettings?.()
      const w = Number(settings?.width) || 0
      const h = Number(settings?.height) || 0
      if (w > 1 && h > 1) return `${w}x${h}`
    } catch {
      // ignore
    }
    return isScreen ? '1280x720' : 'pending'
  })()
  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: trackRef.participant.isLocal,
    isScreenShare: isScreen,
    source: trackRef.source,
  })

  // Screen share: if the track is subscribed but the surface briefly reports 0×0,
  // still force a mount after a short delay so Android/iOS don't stay on "Receiving…".
  const [forceScreenSurface, setForceScreenSurface] = useState(false)
  useEffect(() => {
    if (!isScreen || !mediaTrack || (surfaceSize && surfaceSize.w > 1 && surfaceSize.h > 1)) {
      setForceScreenSurface(false)
      return
    }
    const timer = setTimeout(() => setForceScreenSurface(true), 400)
    return () => clearTimeout(timer)
  }, [isScreen, mediaTrack, surfaceSize])

  const effectiveSurface =
    surfaceSize ??
    (forceScreenSurface && isScreen
      ? { w: Math.max(Math.floor(width), 2), h: Math.max(Math.floor(height), 2) }
      : null)
  const shouldRenderVideo =
    !!mediaTrack &&
    !!mediaReadyToken &&
    !!effectiveSurface &&
    (isScreen || !cameraOff)

  const videoRef = useRef(null)
  // Camera only for PiP — screen-share RTCPIPView blanks the in-meeting stage on iPad.
  const isPipCandidate =
    Platform.OS === 'ios' &&
    shouldRenderVideo &&
    !isScreen &&
    (activeSpeaker || trackRef.participant.isLocal)

  useEffect(() => {
    if (!isPipCandidate) return
    registerIosPipVideoRef(videoRef)
    return () => {
      if (getIosPipVideoRef() === videoRef) {
        registerIosPipVideoRef(null)
      }
    }
  }, [isPipCandidate])

  // Keep remote screen-share subscribed at full quality while this tile is mounted.
  useEffect(() => {
    if (!isScreen || trackRef.participant.isLocal || !publication) return
    const remote = publication as RemoteTrackPublication
    try {
      if (!remote.isSubscribed) remote.setSubscribed(true)
      remote.setVideoDimensions({ width: 1280, height: 720 })
      remote.setVideoQuality(VideoQuality.HIGH)
      remote.setEnabled(true)
    } catch {
      // soft-fail
    }
  }, [isScreen, publication, mediaReadyToken, trackRef.participant.isLocal])

  return (
    <YStack
      width={width}
      height={height}
      maxWidth="100%"
      borderRadius={radius}
      overflow="hidden"
      borderWidth={(handRaised || activeSpeaker) && !isScreen ? 2 : 1}
      borderColor={
        (handRaised || activeSpeaker) && !isScreen
          ? coworkUi.brandLight
          : 'rgba(255,255,255,0.12)'
      }
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
      {shouldRenderVideo && effectiveSurface && isTrackReference(trackRef) ? (
        <VideoTrack
          // Remount when MediaStream attaches (stream id), size, or mirror changes.
          key={`${trackSid ?? 'track'}-${mediaReadyToken}-${effectiveSurface.w}x${effectiveSurface.h}-${trackDims}-${isScreen ? 'ss' : 'cam'}-${mirrored ? 'm' : 'u'}`}
          ref={videoRef}
          trackRef={trackRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: effectiveSurface.w,
            height: effectiveSurface.h,
            backgroundColor: '#0c080a',
          }}
          // cover + elevated zOrder: Android MediaProjection and iOS receivers both
          // blank with contain / zOrder 0 on cross-platform screen share.
          objectFit="cover"
          mirror={mirrored}
          zOrder={isScreen ? 2 : compact ? 1 : 0}
          iosPIP={
            Platform.OS === 'ios' && !isScreen
              ? {
                  enabled: true,
                  startAutomatically: true,
                  preferredSize: { width: 9, height: 16 },
                }
              : undefined
          }
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
      {!isScreen && (meetingRole === 'host' || meetingRole === 'co_host') && !compact ? (
        <YStack position="absolute" top={10} left={10} zIndex={5}>
          <MeetingRoleBadge role={meetingRole} size="sm" />
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
        <XStack alignItems="center" gap={6} maxWidth="100%">
          {micMuted ? <Icons.MicOff size={compact ? 11 : 13} color="#fda4af" /> : null}
          <Text fontSize={compact ? 10 : 12} fontWeight="700" color="#fff" numberOfLines={1} flexShrink={1}>
            {cameraOff && !isScreen ? name : name}
            {isScreen ? ' · Screen' : ''}
            {handRaised && !isScreen ? ' · ✋' : ''}
          </Text>
        </XStack>
      </YStack>
    </YStack>
  )
}
