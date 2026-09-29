// Keep first: `livekit-client` extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
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
  useMeetingLiveSignals,
  useParticipantHandRaised,
  useParticipantMeetingRole,
  useParticipantNonverbal,
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
import {
  describeLiveKitConnectError,
  isLiveKitRoomConnectError,
} from '~/co-work/lib/livekit-connect-error'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { bindRemoteScreenShareQuality } from '~/co-work/lib/livekit-screen-share'
import { resolveNativeVideoStreamAttachId } from '~/co-work/lib/native-video-stream-ready'
import {
  meetingVideoTrackRemountKey,
  nextMeetingVideoSurfaceSize,
} from '~/co-work/lib/meeting-video-surface'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import {
  MEETING_FLOATING_DRAG_SLOP,
  meetingFloatingCornerForPoint,
  meetingFloatingCornerOrigin,
  meetingFloatingTileSize,
  type MeetingFloatingCorner,
} from '~/co-work/lib/meeting-floating-tile'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'
import { shouldMirrorMeetingVideo } from '~/co-work/lib/meeting-video-mirror'
import { meetingNonverbalEmoji } from '~/co-work/lib/meeting-nonverbal'
import {
  meetingTileActionLabel,
  meetingTileMenuActions,
} from '~/co-work/lib/meeting-tile-actions'
import {
  getIosPipVideoRef,
  registerIosPipVideoRef,
} from '~/lib/session/ios-pip-registry'
import {
  chunkGalleryRows,
  meetingGalleryLayout,
  meetingGalleryScrollLayout,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import {
  meetingStageContentBox,
  resolveMeetingUiLayout,
} from '~/co-work/lib/meeting-orientation-layout'
import {
  applyMeetingUiLayout,
  resolveMeetingUiPadding,
} from '~/co-work/lib/meeting-ui-overlay'
import {
  applyMeetingSelectiveCameraSubscribe,
  meetingCameraQualityForTile,
} from '~/co-work/lib/meeting-selective-subscribe'
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
const FILMSTRIP_GAP = 8
/** Filmstrip tiles subscribed before the first viewability callback fires. */
const FILMSTRIP_INITIAL_VISIBLE = 8
/** Gallery rows kept subscribed above/below the visible rows while scrolling. */
const GALLERY_ROW_OVERSCAN = 1

type StageTrackRef = import('@livekit/components-core').TrackReferenceOrPlaceholder

function stageTrackKey(trackRef: StageTrackRef) {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

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

  const handleRoomError = useCallback(
    (cause: Error) => {
      if (!credentials || !isLiveKitRoomConnectError(cause)) return
      void describeLiveKitConnectError(cause, credentials).then(setError)
    },
    [credentials],
  )

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
        onError={handleRoomError}
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
    let reinforcedForConnection = false

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
      // Only reinforce once per Connected session — re-running on avatar/mediaMode
      // dep changes republished the mic and looked like auto mute/unmute.
      if (reinforcedForConnection) {
        void syncAvatarMetadata()
        return
      }
      reinforcedForConnection = true
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

        // Dev helper: auto-start screen share when a global flag is set.
        try {
          // Only run in development builds.
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (typeof __DEV__ !== 'undefined' && __DEV__ && (globalThis as any).__AUTO_SCREEN_SHARE) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const flag = (globalThis as any).__AUTO_SCREEN_SHARE
            if (flag && typeof liveKit?.toggleScreenShare === 'function') {
              await liveKit.toggleScreenShare()
            }
            // Clear the flag so it doesn't re-run on reconnects.
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              delete (globalThis as any).__AUTO_SCREEN_SHARE
            } catch {}
          }
        } catch {
          // Ignore dev-only failures.
        }
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

    const onDisconnected = () => {
      reinforcedForConnection = false
      micForcedRef.current = false
    }

    room.on(RoomEvent.Connected, onConnected)
    room.on(RoomEvent.Disconnected, onDisconnected)
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed as never)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      room.off(RoomEvent.Disconnected, onDisconnected)
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
      <NativeMeetingOverlayHost overlay={overlay} liveKit={liveKit} />
    </YStack>
  )
}

function NativeMeetingOverlayHost({
  overlay,
  liveKit,
}: {
  overlay?: NativeLiveKitMeetingRoomProps['overlay']
  liveKit: LiveKitMediaControls
}) {
  const { blockVideoSurfaces } = useMeetingLiveSignals()
  return (
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
      {overlay?.(liveKit)}
    </YStack>
  )
}

function NativeMeetingVideoStage() {
  const { ui: coworkUi } = useCoWorkTheme()
  const { state, dispatch } = useMeetingMachine()
  const {
    stageTrailingInset,
    spotlightUserId,
    pinnedUserIds,
    setStageHandlesTaps,
    triggerStageTap,
  } = useMeetingLiveSignals()
  useEffect(() => {
    setStageHandlesTaps(true)
    return () => setStageHandlesTaps(false)
  }, [setStageHandlesTaps])
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const [hdVideoPref, setHdVideoPref] = useState(true)
  useEffect(() => {
    void import('~/co-work/lib/meeting-media-prefs').then(({ loadMeetingMediaPrefs }) =>
      loadMeetingMediaPrefs().then((prefs) => setHdVideoPref(prefs.hdVideo !== false)),
    )
  }, [])
  const layout = useMemo(() => {
    const base = resolveMeetingUiLayout({
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
    return applyMeetingUiLayout(
      base,
      resolveMeetingUiPadding({
        layout: base,
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
    // Gallery uses speaking for highlight + ordering; speaker/share for focus tile.
    enabled: true,
  })
  const layoutState = useMemo(
    () =>
      composeMeetingStageTracks(
        tracks,
        localParticipant.identity,
        state.viewMode,
        activeSpeakerIdentity,
        {
          hideSelfView: state.hideSelfView,
          hideNonVideoParticipants: state.hideNonVideoParticipants,
          activeSpeakersOnly: state.activeSpeakersOnly,
          spotlightIdentity: spotlightUserId,
          pinnedIdentities: pinnedUserIds,
        },
      ),
    [
      activeSpeakerIdentity,
      localParticipant.identity,
      pinnedUserIds,
      spotlightUserId,
      state.activeSpeakersOnly,
      state.hideNonVideoParticipants,
      state.hideSelfView,
      state.viewMode,
      tracks,
    ],
  )

  const [screenShareBannerVisible, setScreenShareBannerVisible] = useState(false)
  const pageSize = resolveMeetingGalleryPageSize({
    basePageSize: layout.pageSize,
    denseGallery: state.denseGallery,
    breakpoint: layout.breakpoint,
  })
  const pipTrack = layoutState.pipTrack
  const [pipSwapped, setPipSwapped] = useState(false)
  useEffect(() => {
    if (!pipTrack) setPipSwapped(false)
  }, [pipTrack])
  const stageTracks = useMemo(
    () => (pipTrack && pipSwapped ? [pipTrack] : layoutState.stageTracks),
    [layoutState.stageTracks, pipSwapped, pipTrack],
  )
  const floatingTrack = pipTrack ? (pipSwapped ? layoutState.stageTracks[0] : pipTrack) : undefined
  const filmstripTracks = layoutState.filmstripTracks
  // Virtualized gallery: only rows scrolled into view get camera subscriptions.
  const [galleryVisibleRowRange, setGalleryVisibleRowRange] = useState<{
    first: number
    last: number
  } | null>(null)
  const onGalleryViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const indices = viewableItems
        .map((token) => token.index)
        .filter((index): index is number => typeof index === 'number')
      if (indices.length === 0) return
      setGalleryVisibleRowRange({ first: Math.min(...indices), last: Math.max(...indices) })
    },
  ).current
  const galleryViewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current
  // Virtualized filmstrip: only tiles scrolled into view get camera subscriptions.
  const [filmstripVisibleIds, setFilmstripVisibleIds] = useState<string[] | null>(null)
  const onFilmstripViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setFilmstripVisibleIds(
        viewableItems
          .map((token) => (token.item as StageTrackRef | undefined)?.participant.identity)
          .filter((identity): identity is string => !!identity),
      )
    },
  ).current
  const filmstripViewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current
  const hasScreenShare = layoutState.hasScreenShare
  const isLocalScreenSharing = layoutState.isLocalScreenSharing
  const previousScreenShare = useRef(false)

  useEffect(() => {
    if (hasScreenShare && !previousScreenShare.current) {
      dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
      setScreenShareBannerVisible(true)
    } else if (!hasScreenShare && state.viewMode === 'screen-share') {
      dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
      setScreenShareBannerVisible(false)
    } else if (!hasScreenShare) {
      setScreenShareBannerVisible(false)
    }
    previousScreenShare.current = hasScreenShare
  }, [dispatch, hasScreenShare, state.viewMode])

  useEffect(() => {
    if (!hasScreenShare || !screenShareBannerVisible) return
    const timer = setTimeout(() => setScreenShareBannerVisible(false), 4500)
    return () => clearTimeout(timer)
  }, [hasScreenShare, screenShareBannerVisible])

  const showFilmstrip = layoutState.filmstripTracks.length > 0
  const speakerMode = state.viewMode === 'speaker'
  // Speaker view always keeps a filmstrip of the other participants (side on
  // wide layouts, bottom strip on portrait phones).
  const filmstripBeside = speakerMode
    ? layout.filmstripBeside || width >= 700 || state.sideBySideShare
    : layout.filmstripBeside || state.sideBySideShare
  const filmstripExpanded = showFilmstrip && !state.participantStripMinimized
  const screenLayout = state.viewMode === 'screen-share' && hasScreenShare
  const galleryMode = state.viewMode === 'gallery' || (!screenLayout && !speakerMode)
  const { width: mainWidth, height: mainHeight } = meetingStageContentBox({
    viewportWidth: width,
    viewportHeight: height,
    layout: speakerMode
      ? {
          ...layout,
          filmstripBeside,
          filmstripWidth: filmstripBeside ? Math.max(layout.filmstripWidth, 112) : layout.filmstripWidth,
          filmstripHeight: filmstripBeside ? layout.filmstripHeight : Math.max(layout.filmstripHeight, 92),
        }
      : layout,
    filmstripExpanded,
    stageTrailingInset,
  })
  const gallery = meetingGalleryLayout(stageTracks.length, {
    width: mainWidth,
    height: mainHeight,
    preferWide: layout.galleryPreferWide,
  })
  const minTileHeight = layout.policy === 'landscape-phone' ? 72 : 100
  const galleryScroll = meetingGalleryScrollLayout(stageTracks.length, {
    width: mainWidth,
    height: mainHeight,
    preferWide: layout.galleryPreferWide,
    screenSize: pageSize,
    gap: STAGE_GAP,
    minRowHeight: minTileHeight,
  })
  const galleryScrolls = galleryMode && galleryScroll.scrolls
  const galleryRows = useMemo(
    () => (galleryScrolls ? chunkGalleryRows(stageTracks, galleryScroll.columns) : []),
    [galleryScroll.columns, galleryScrolls, stageTracks],
  )
  const galleryRowSize = galleryScroll.rowHeight + STAGE_GAP
  const galleryTileWidth = Math.floor(
    (mainWidth - STAGE_GAP * Math.max(galleryScroll.columns - 1, 0)) / galleryScroll.columns,
  )

  useEffect(() => {
    const identities = new Set<string>()
    if (galleryScrolls) {
      const first = Math.max(0, (galleryVisibleRowRange?.first ?? 0) - GALLERY_ROW_OVERSCAN)
      const last = Math.min(
        galleryRows.length - 1,
        (galleryVisibleRowRange?.last ?? galleryScroll.visibleRows) + GALLERY_ROW_OVERSCAN,
      )
      for (let row = first; row <= last; row += 1) {
        for (const track of galleryRows[row] ?? []) identities.add(track.participant.identity)
      }
    } else {
      for (const track of stageTracks) identities.add(track.participant.identity)
    }
    const filmstripIdentities =
      filmstripVisibleIds ??
      filmstripTracks
        .slice(0, FILMSTRIP_INITIAL_VISIBLE)
        .map((track) => track.participant.identity)
    for (const identity of filmstripIdentities) identities.add(identity)
    for (const track of stageTracks) {
      if (track.participant.isSpeaking) identities.add(track.participant.identity)
    }
    if (floatingTrack) identities.add(floatingTrack.participant.identity)
    applyMeetingSelectiveCameraSubscribe(room, identities)
  }, [
    filmstripTracks,
    filmstripVisibleIds,
    floatingTrack,
    galleryRows,
    galleryScroll.visibleRows,
    galleryScrolls,
    galleryVisibleRowRange,
    room,
    stageTracks,
  ])

  const renderGalleryRow = (rowTracks: StageTrackRef[]) => (
    <XStack
      width={mainWidth}
      height={galleryRowSize}
      paddingBottom={STAGE_GAP}
      justifyContent="center"
      gap={STAGE_GAP}
    >
      {rowTracks.map((trackRef) => (
        <NativeVideoTile
          key={
            (isTrackReference(trackRef) ? trackRef.publication.trackSid : null) ??
            stageTrackKey(trackRef)
          }
          trackRef={trackRef}
          name={participantDisplayName(trackRef.participant)}
          isScreen={false}
          localScreenShareActive={isLocalScreenSharing}
          width={galleryTileWidth}
          height={galleryScroll.rowHeight}
          radius={14}
          mirrorLocalVideo={state.mirrorLocalVideo}
          hdVideo={hdVideoPref}
          activeSpeaker={
            trackRef.participant.isSpeaking ||
            trackRef.participant.identity === activeSpeakerIdentity
          }
        />
      ))}
    </XStack>
  )

  return (
    <Pressable
      onPress={triggerStageTap}
      accessible={false}
      style={{ flex: 1, width: '100%', height: '100%' }}
    >
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor="#0c080a"
      paddingTop={layout.stagePaddingTop}
      paddingBottom={layout.stagePaddingBottom}
      paddingLeft={layout.stagePaddingLeft}
      paddingRight={layout.stagePaddingRight + stageTrailingInset}
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
          {galleryScrolls ? (
            <FlatList
              key={`gallery-scroll-${galleryScroll.columns}`}
              data={galleryRows}
              keyExtractor={(_, rowIndex) => `gallery-row-${rowIndex}`}
              renderItem={({ item }) => renderGalleryRow(item)}
              style={{ width: mainWidth, height: mainHeight }}
              showsVerticalScrollIndicator
              indicatorStyle="white"
              nestedScrollEnabled
              getItemLayout={(_, rowIndex) => ({
                length: galleryRowSize,
                offset: galleryRowSize * rowIndex,
                index: rowIndex,
              })}
              initialNumToRender={galleryScroll.visibleRows + 1}
              maxToRenderPerBatch={2}
              windowSize={3}
              onViewableItemsChanged={onGalleryViewableChanged}
              viewabilityConfig={galleryViewabilityConfig}
            />
          ) : (
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
                    localScreenShareActive={isLocalScreenSharing}
                    width={tileWidth}
                    height={Math.max(tileHeight, minTileHeight)}
                    radius={screenLayout && index === 0 ? coworkUi.radius.tile : 14}
                    mirrorLocalVideo={state.mirrorLocalVideo}
                    hdVideo={hdVideoPref}
                    activeSpeaker={
                      !isScreen &&
                      (trackRef.participant.isSpeaking ||
                        trackRef.participant.identity === activeSpeakerIdentity)
                    }
                  />
                )
              })}
            </XStack>
          )}

          {floatingTrack ? (
            <NativeFloatingVideoTile
              trackRef={floatingTrack}
              areaWidth={mainWidth}
              areaHeight={mainHeight}
              onSwap={() => setPipSwapped((swapped) => !swapped)}
              localScreenShareActive={isLocalScreenSharing}
              mirrorLocalVideo={state.mirrorLocalVideo}
              hdVideo={hdVideoPref}
              activeSpeaker={floatingTrack.participant.isSpeaking}
            />
          ) : null}

          {filmstripExpanded ? (
            <FlatList
              key={filmstripBeside ? 'filmstrip-side' : 'filmstrip-bottom'}
              data={filmstripTracks}
              keyExtractor={(trackRef) => `${stageTrackKey(trackRef)}-strip`}
              renderItem={({ item: trackRef }) => (
                <View
                  style={
                    filmstripBeside
                      ? { marginBottom: FILMSTRIP_GAP }
                      : { marginRight: FILMSTRIP_GAP }
                  }
                >
                  <NativeVideoTile
                    trackRef={trackRef}
                    name={participantDisplayName(trackRef.participant)}
                    isScreen={false}
                    localScreenShareActive={isLocalScreenSharing}
                    width={layout.pipWidth}
                    height={layout.pipHeight}
                    radius={10}
                    compact
                    mirrorLocalVideo={state.mirrorLocalVideo}
                    hdVideo={hdVideoPref}
                    activeSpeaker={trackRef.participant.isSpeaking}
                  />
                </View>
              )}
              style={{
                position: 'absolute',
                right: 0,
                bottom: filmstripBeside ? undefined : 0,
                top: filmstripBeside ? 0 : undefined,
                width: filmstripBeside ? layout.filmstripWidth : '100%',
                height: filmstripBeside ? mainHeight : layout.filmstripHeight,
              }}
              horizontal={!filmstripBeside}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => {
                const length =
                  (filmstripBeside ? layout.pipHeight : layout.pipWidth) + FILMSTRIP_GAP
                return { length, offset: length * index, index }
              }}
              initialNumToRender={FILMSTRIP_INITIAL_VISIBLE}
              windowSize={5}
              onViewableItemsChanged={onFilmstripViewableChanged}
              viewabilityConfig={filmstripViewabilityConfig}
            />
          ) : null}
          {showFilmstrip ? (
            <YStack
              position="absolute"
              right={filmstripBeside ? 4 : 8}
              bottom={
                filmstripBeside ? 4 : filmstripExpanded ? layout.filmstripHeight + 4 : 8
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
          {(() => {
            if (!galleryScrolls) return null
            const lastVisibleRow = galleryVisibleRowRange?.last ?? galleryScroll.visibleRows - 1
            const below = stageTracks.length - (lastVisibleRow + 1) * galleryScroll.columns
            if (below <= 0) return null
            return (
              <XStack
                position="absolute"
                bottom={12}
                alignSelf="center"
                zIndex={28}
                paddingHorizontal={12}
                paddingVertical={6}
                borderRadius={999}
                backgroundColor="rgba(12,8,10,0.88)"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.16)"
                pointerEvents="none"
              >
                <Text color="#fff" fontSize={12} fontWeight="700">
                  ↓ {below} more · {layoutState.totalTiles} people
                </Text>
              </XStack>
            )
          })()}
        </YStack>
      )}
      {(() => {
        if (!screenShareBannerVisible) return null
        const label = screenShareRoleLabel(
          isLocalScreenSharing ? 'sharing' : hasScreenShare ? 'viewing' : 'none',
        )
        return label ? (
          <YStack
            position="absolute"
            top={layout.stagePaddingTop + 8}
            left={layout.stagePaddingLeft + 8}
            maxWidth={320}
            zIndex={30}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={12}
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
    </Pressable>
  )
}

/** Zoom-style 1:1 self-view: drag to any corner, tap to swap with the main video. */
function NativeFloatingVideoTile({
  trackRef,
  areaWidth,
  areaHeight,
  onSwap,
  localScreenShareActive,
  mirrorLocalVideo,
  hdVideo,
  activeSpeaker,
}: {
  trackRef: StageTrackRef
  areaWidth: number
  areaHeight: number
  onSwap: () => void
  localScreenShareActive: boolean
  mirrorLocalVideo: boolean
  hdVideo: boolean
  activeSpeaker: boolean
}) {
  const tile = meetingFloatingTileSize({ width: areaWidth, height: areaHeight })
  const area = { width: areaWidth, height: areaHeight }
  const [corner, setCorner] = useState<MeetingFloatingCorner>('bottom-right')
  const position = useRef(
    new Animated.ValueXY(meetingFloatingCornerOrigin('bottom-right', area, tile)),
  ).current
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const latest = useRef({ area, tile, corner, onSwap })
  latest.current = { area, tile, corner, onSwap }

  const snapTo = (next: MeetingFloatingCorner) => {
    const { area: currentArea, tile: currentTile } = latest.current
    Animated.spring(position, {
      toValue: meetingFloatingCornerOrigin(next, currentArea, currentTile),
      useNativeDriver: false,
      bounciness: 4,
      speed: 18,
    }).start()
  }

  useEffect(() => {
    snapTo(corner)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corner, areaWidth, areaHeight, tile.width, tile.height])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim every touch so the tile's own press/long-press never fires underneath.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          position.stopAnimation((value) => {
            dragOriginRef.current = value
          })
        },
        onPanResponderMove: (_, gesture) => {
          const origin = dragOriginRef.current
          position.setValue({ x: origin.x + gesture.dx, y: origin.y + gesture.dy })
        },
        onPanResponderRelease: (_, gesture) => {
          const current = latest.current
          if (Math.hypot(gesture.dx, gesture.dy) < MEETING_FLOATING_DRAG_SLOP) {
            snapTo(current.corner)
            current.onSwap()
            return
          }
          const origin = dragOriginRef.current
          const next = meetingFloatingCornerForPoint(
            {
              x: origin.x + gesture.dx + current.tile.width / 2,
              y: origin.y + gesture.dy + current.tile.height / 2,
            },
            current.area,
          )
          if (next === current.corner) snapTo(next)
          else setCorner(next)
        },
        onPanResponderTerminate: () => snapTo(latest.current.corner),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position],
  )

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Swap video with the main view"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tile.width,
        height: tile.height,
        zIndex: 20,
        elevation: 8,
        transform: position.getTranslateTransform(),
      }}
    >
      <NativeVideoTile
        key={stageTrackKey(trackRef)}
        trackRef={trackRef}
        name={participantDisplayName(trackRef.participant)}
        isScreen={false}
        localScreenShareActive={localScreenShareActive}
        width={tile.width}
        height={tile.height}
        radius={12}
        compact
        floating
        mirrorLocalVideo={mirrorLocalVideo}
        hdVideo={hdVideo}
        activeSpeaker={activeSpeaker}
      />
    </Animated.View>
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
  floating = false,
  mirrorLocalVideo,
  hdVideo = true,
  activeSpeaker,
  localScreenShareActive = false,
}: {
  trackRef: import('@livekit/components-core').TrackReferenceOrPlaceholder
  name: string
  isScreen: boolean
  width: number
  height: number
  radius: number
  compact?: boolean
  /** Overlaps another video tile; Android needs the media-overlay surface layer to stay on top. */
  floating?: boolean
  mirrorLocalVideo: boolean
  hdVideo?: boolean
  activeSpeaker: boolean
  /** Local share is on. SurfaceViews punch a black hole into MediaProjection. */
  localScreenShareActive?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const {
    blockVideoSurfaces,
    stopIncomingVideo,
    localUserId,
    spotlightUserId,
    pinnedUserIds,
    togglePinnedUserId,
    tileHostActions,
    triggerStageTap,
  } = useMeetingLiveSignals()
  const [surfacesAllowed, setSurfacesAllowed] = useState(!blockVideoSurfaces)
  useEffect(() => {
    if (blockVideoSurfaces) {
      setSurfacesAllowed(false)
      return
    }
    const timer = setTimeout(() => setSurfacesAllowed(true), 80)
    return () => clearTimeout(timer)
  }, [blockVideoSurfaces])
  const avatarUrl = getParticipantAvatarUrl(trackRef.participant)
  const handRaised = useParticipantHandRaised(trackRef.participant.identity)
  const nonverbal = useParticipantNonverbal(trackRef.participant.identity)
  const meetingRole = useParticipantMeetingRole(trackRef.participant.identity)
  const identity = trackRef.participant.identity
  const isSelf = identity === localUserId
  const isPinned = pinnedUserIds.includes(identity)
  const isSpotlighted = spotlightUserId === identity
  const micMuted = !isScreen && trackRef.participant.isMicrophoneEnabled === false
  const stopRemoteCamera =
    stopIncomingVideo && !trackRef.participant.isLocal && !isScreen
  const cameraOff =
    stopRemoteCamera ||
    (!isScreen &&
      isCameraTileOff({
        source: trackRef.source,
        publication: isTrackReference(trackRef) ? trackRef.publication : null,
        isPlaceholder: !isTrackReference(trackRef),
      }))

  const openTileMenu = () => {
    const actions = meetingTileMenuActions({
      isSelf,
      isScreen,
      canModerate: !!tileHostActions?.canModerate,
      isPinned,
      isSpotlighted,
      handRaised,
    })
    if (actions.length === 0) return
    Alert.alert(
      name,
      undefined,
      [
        ...actions.map((action) => ({
          text: meetingTileActionLabel(action),
          onPress: () => {
            if (action === 'pin' || action === 'unpin') {
              togglePinnedUserId(identity)
              return
            }
            if (action === 'spotlight') {
              tileHostActions?.setSpotlight(identity)
              return
            }
            if (action === 'remove_spotlight') {
              tileHostActions?.setSpotlight(null)
              return
            }
            if (action === 'lower_hand') {
              tileHostActions?.lowerHandFor(identity)
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true },
    )
  }

  // Android RTCView often never recovers from a 0×0 first layout ("Dropping frame - No surface").
  // Gate the VideoTrack until we have real pixel size, then mount with explicit dimensions.
  const [surfaceSize, setSurfaceSize] = useState<{ w: number; h: number } | null>(
    width > 1 && height > 1 ? nextMeetingVideoSurfaceSize(null, { w: width, h: height }) : null,
  )

  useEffect(() => {
    if (width > 1 && height > 1) {
      setSurfaceSize((prev) => nextMeetingVideoSurfaceSize(prev, { w: width, h: height }))
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
    () => resolveNativeVideoStreamAttachId(mediaTrack, { allowTrackIdFallback: !isScreen }),
  )
  useEffect(() => {
    if (!mediaTrack) {
      setStreamAttachId(null)
      return
    }
    const readId = () =>
      resolveNativeVideoStreamAttachId(mediaTrack, { allowTrackIdFallback: !isScreen })
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
    }, 120)
    // Screen share: if MediaStream never appears, still unlock render after a beat
    // once a MediaStreamTrack exists (ensureNativeVideoMediaStream will wrap it).
    const forceReady = setTimeout(() => {
      const wrapped = resolveNativeVideoStreamAttachId(mediaTrack, {
        allowTrackIdFallback: !isScreen,
      })
      if (wrapped) setStreamAttachId(wrapped)
    }, isScreen ? 1200 : 2500)
    const stop = setTimeout(() => clearInterval(poll), 30_000)
    return () => {
      clearInterval(poll)
      clearTimeout(stop)
      clearTimeout(forceReady)
    }
  }, [isScreen, mediaTrack, trackSid])

  // Only treat the surface as ready once MediaStream exists — never use track.sid alone.
  const mediaReadyToken =
    streamAttachId ??
    resolveNativeVideoStreamAttachId(mediaTrack, { allowTrackIdFallback: !isScreen }) ??
    mediaTrack?.sid ??
    null
  const trackFacing =
    (mediaTrack as any)?.mediaStreamTrack?.getSettings?.()?.facingMode
  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: trackRef.participant.isLocal,
    isScreenShare: isScreen,
    source: trackRef.source,
    cameraFacing: trackFacing,
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
  const localScreenShare = isScreen && trackRef.participant.isLocal
  // Android SurfaceView cannot be captured by MediaProjection — it records as
  // a black tile and the in-meeting camera goes black with it. While this
  // device is sharing, keep every local tile on a normal view.
  const hideLocalSurface = localScreenShareActive && trackRef.participant.isLocal
  const shouldRenderVideo =
    !localScreenShare &&
    !hideLocalSurface &&
    !blockVideoSurfaces &&
    surfacesAllowed &&
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

  const cameraQuality = meetingCameraQualityForTile({ width, height, hdVideo })
  useEffect(() => {
    if (isScreen || trackRef.participant.isLocal || !publication) return
    if (trackRef.source !== Track.Source.Camera) return
    const remote = publication as RemoteTrackPublication
    try {
      if (!remote.isSubscribed) remote.setSubscribed(true)
      remote.setVideoQuality(cameraQuality)
    } catch {
      // soft-fail
    }
  }, [cameraQuality, isScreen, publication, trackRef.participant.isLocal, trackRef.source])

  return (
    <Pressable
      onPress={triggerStageTap}
      onLongPress={openTileMenu}
      delayLongPress={420}
      style={{ width, height, maxWidth: '100%' }}
    >
    <YStack
      width="100%"
      height="100%"
      maxWidth="100%"
      borderRadius={radius}
      overflow="hidden"
      // Keep border width constant — toggling 1↔2 on speak remounted Android video.
      borderWidth={2}
      borderColor={
        (handRaised || activeSpeaker || isSpotlighted || isPinned) && !isScreen
          ? coworkUi.brand
          : 'rgba(255,255,255,0.12)'
      }
      backgroundColor={coworkUi.tileBg}
      position="relative"
      collapsable={false}
      onLayout={(event) => {
        const { width: layoutW, height: layoutH } = event.nativeEvent.layout
        if (layoutW > 1 && layoutH > 1) {
          setSurfaceSize((prev) => nextMeetingVideoSurfaceSize(prev, { w: layoutW, h: layoutH }))
        }
      }}
    >
      {shouldRenderVideo && effectiveSurface && isTrackReference(trackRef) ? (
        <VideoTrack
          // Remount when MediaStream attaches (stream id), size, or mirror changes.
          key={meetingVideoTrackRemountKey({
            trackSid,
            streamId: mediaReadyToken,
            surface: effectiveSurface,
            isScreen,
            mirrored,
          })}
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
          // contain letterboxes MediaProjection into a black tile on Android.
          objectFit="cover"
          mirror={mirrored}
          // Camera tiles stay at zOrder 0 so they don't punch a black hole
          // through the meeting chrome. Remote screen share needs a layer
          // above the window or the frames never composite.
          zOrder={isScreen || floating ? 1 : 0}
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
          {isScreen || hideLocalSurface ? (
            <Text fontSize={compact ? 11 : 13} color="rgba(255,255,255,0.75)" fontWeight="600" textAlign="center" paddingHorizontal="$3">
              {localScreenShare || hideLocalSurface ? 'Sharing your screen' : 'Receiving screen…'}
            </Text>
          ) : (
            <>
              <Avatar name={name} src={avatarUrl ?? undefined} size={compact ? '$5' : '$8'} />
              {/* Short tiles have no room between the avatar and the name pill. */}
              {!compact && height >= 180 ? (
                <Text fontSize={12} color="rgba(255,255,255,0.55)" fontWeight="600">
                  {stopRemoteCamera ? 'Video paused' : 'Camera off'}
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
      {!isScreen && (isPinned || isSpotlighted) ? (
        <XStack
          position="absolute"
          top={compact ? 6 : 10}
          alignSelf="center"
          gap={6}
          zIndex={5}
          pointerEvents="none"
        >
          {isSpotlighted ? (
            <YStack
              width={compact ? 26 : 30}
              height={compact ? 26 : 30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(12, 8, 10, 0.82)"
              borderWidth={1}
              borderColor="rgba(245,197,66,0.55)"
            >
              <Text fontSize={compact ? 12 : 14} color="#F5C542">
                ★
              </Text>
            </YStack>
          ) : null}
          {isPinned ? (
            <YStack
              width={compact ? 26 : 30}
              height={compact ? 26 : 30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(12, 8, 10, 0.82)"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.22)"
            >
              <Text fontSize={compact ? 11 : 13}>📌</Text>
            </YStack>
          ) : null}
        </XStack>
      ) : null}
      {nonverbal && !isScreen ? (
        <YStack
          position="absolute"
          top={compact ? 6 : 10}
          left={compact ? 6 : 10}
          width={compact ? 28 : 34}
          height={compact ? 28 : 34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(12, 8, 10, 0.78)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.22)"
          zIndex={4}
        >
          <Text fontSize={compact ? 13 : 15}>{meetingNonverbalEmoji(nonverbal)}</Text>
        </YStack>
      ) : null}
      {!isScreen && (meetingRole === 'host' || meetingRole === 'co_host') && !compact && !nonverbal ? (
        <YStack position="absolute" top={10} left={10} zIndex={5}>
          <MeetingRoleBadge role={meetingRole} size="sm" />
        </YStack>
      ) : null}
      {/* elevation keeps the name chip above Android SurfaceView video */}
      <YStack
        position="absolute"
        left={compact ? 6 : 10}
        bottom={compact ? 6 : 10}
        paddingHorizontal={compact ? 8 : 12}
        paddingVertical={compact ? 3 : 5}
        borderRadius={999}
        backgroundColor="rgba(12, 8, 10, 0.82)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.18)"
        maxWidth="90%"
        zIndex={8}
        elevation={Platform.OS === 'android' ? 8 : undefined}
        pointerEvents="none"
        collapsable={false}
        renderToHardwareTextureAndroid
      >
        <XStack alignItems="center" gap={6} maxWidth="100%">
          {micMuted ? <Icons.MicOff size={compact ? 11 : 13} color="#fda4af" /> : null}
          <Text fontSize={compact ? 10 : 12} fontWeight="700" color="#fff" numberOfLines={1} flexShrink={1}>
            {name}
            {isScreen ? ' · Screen' : ''}
            {handRaised && !isScreen ? ' · ✋' : ''}
          </Text>
        </XStack>
      </YStack>
    </YStack>
    </Pressable>
  )
}
