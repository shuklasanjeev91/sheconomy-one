// Keep first: media libraries extend DOMException while they evaluate, and a
// universal link can make this the very first screen module Hermes loads.
import '~/lib/polyfills/install-dom-exception'

import { BackHandler, Platform, useWindowDimensions } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ANDROID_PRESENT_UNAVAILABLE_MESSAGE,
  androidPresentUnavailable,
} from '~/co-work/lib/android-present-build'

import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { MeetingShareOptionsSheet,
  type MeetingShareStartOptions,
} from '~/co-work/components/MeetingShareOptionsSheet'
import { MeetingAppsSheet } from '~/co-work/components/MeetingAppsSheet'
import { MeetingSettingsSheet } from '~/co-work/components/MeetingSettingsSheet'
import type { MeetingShareContentKind } from '~/co-work/lib/meeting-share-content'
import { MeetingTransferHostSheet } from '~/co-work/components/MeetingTransferHostSheet'
import { ScreenCenter, ViewportOverlay } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  CoWorkAlertBanner,
  MeetingInfoModal,
} from '~/co-work/components/CoWorkUi'
import { MeetingHeader } from '~/co-work/components/MeetingHeader'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { MeetingMediaRoom } from '~/co-work/components/MeetingMediaRoom'
import type { MeetingDisconnectReason, MeetingMediaControls } from '~/co-work/lib/meeting-media-controls'
import { MeetingChatPanel } from '~/co-work/components/MeetingChatPanel'
import { MeetingBackgroundPanel } from '~/co-work/components/MeetingBackgroundPanel'
import { MeetingAudioPanel } from '~/co-work/components/MeetingAudioPanel'
import { MeetingControls } from '~/co-work/components/MeetingControls'
import { MeetingWhiteboardModal } from '~/co-work/components/MeetingWhiteboardModal'
import {
  MeetingContentSharePill as ContentSharePill,
  MeetingContentShareStage,
} from '~/co-work/components/MeetingContentShareStage'
import { MEETING_CONTENT_MAX_ITEMS, type MeetingContentItem } from '~/co-work/lib/meeting-content-share'
import { uploadMeetingContent, type MeetingContentSource } from '~/co-work/lib/meeting-content-upload'
import { MeetingAudioTestModal } from '~/co-work/components/MeetingAudioTestModal'
import { MeetingShortcutsHelp } from '~/co-work/components/MeetingShortcutsHelp'
import { useMeetingKeyboardShortcuts } from '~/co-work/hooks/useMeetingKeyboardShortcuts'
import { MeetingHostToolsPanel } from '~/co-work/components/MeetingHostToolsPanel'
import { MeetingHostNotesPanel } from '~/co-work/components/MeetingHostNotesPanel'
import { MeetingInfoPanel } from '~/co-work/components/MeetingInfoPanel'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingLiveCaptions } from '~/co-work/components/MeetingLiveCaptions'
import { MeetingLiveSignalsProvider, useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import {
  meetingLiveAdmittedCount,
  meetingLiveParticipants,
  meetingOnlineRemoteParticipants,
} from '~/co-work/lib/meeting-live-roster'
import { MeetingParticipantsPanel } from '~/co-work/components/MeetingParticipantsPanel'
import { MeetingPollsPanel } from '~/co-work/components/MeetingPollsPanel'
import { MeetingQaPanel } from '~/co-work/components/MeetingQaPanel'
import { MeetingAnnotationOverlay } from '~/co-work/components/MeetingAnnotationOverlay'
import { MeetingRemoteControlRequestModal } from '~/co-work/components/MeetingRemoteControlRequestModal'
import { MeetingBreakoutPanel } from '~/co-work/components/MeetingBreakoutPanel'
import { MeetingReactionsOverlay } from '~/co-work/components/MeetingReactionsOverlay'
import { MeetingRecordingsPanel } from '~/co-work/components/MeetingRecordingsPanel'
import { MeetingResponsivePanel } from '~/co-work/components/MeetingResponsivePanel'
import { MeetingWaitingRoom } from '~/co-work/components/MeetingWaitingRoom'
import { MeetingWaitingRoomRequests } from '~/co-work/components/MeetingWaitingRoomRequests'
import { MeetingElapsedTimer } from '~/co-work/components/MeetingElapsedTimer'
import { MeetingRecordingConsentBanner } from '~/co-work/components/MeetingRecordingConsentBanner'
import { MeetingInviteOthersCard } from '~/co-work/components/MeetingInviteOthersCard'
import { MeetingSafeDrivingMode } from '~/co-work/components/MeetingSafeDrivingMode'
import { MeetingSpeakingWhileMutedBanner } from '~/co-work/components/MeetingSpeakingWhileMutedBanner'
import { MeetingAskToUnmuteBanner } from '~/co-work/components/MeetingAskToUnmuteBanner'
import { shouldShowSpeakingWhileMuted } from '~/co-work/lib/meeting-speaking-while-muted'
import { connectionStatusLabel } from '~/co-work/lib/meeting-audio-quality'
import { MeetingProvider, useMeetingMachine, useOptionalMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  useMeetingStateManager,
  useSyncMeetingLifecycle,
} from '~/co-work/hooks/useMeetingStateManager'
import {
  MEETING_TOOLBAR_Z_INDEX,
} from '~/co-work/lib/meeting-toolbar'
import { confirmMeetingAction } from '~/co-work/lib/meeting-confirm'
import { useLiveCaptions } from '~/co-work/hooks/useLiveCaptions'
import {
  useMeetingRecording,
  useMeetingRecordingIndicator,
} from '~/co-work/hooks/useMeetingRecording'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import {
  MEETING_MEDIA_REMOUNT_GUARD_MS,
  shouldSilentRemountMedia,
} from '~/co-work/lib/meeting-media-reconnect'
import { isMeetingChatEnabled, isMeetingPrivateChatEnabled } from '~/co-work/lib/meeting-chat'
import { canChangeCriticalMeetingSettings } from '~/co-work/lib/meeting-role-permissions'
import { resolveMeetingUiLayout } from '~/co-work/lib/meeting-orientation-layout'
import {
  meetingPanelPresentation,
  meetingViewportIsLandscape,
  resolveMeetingBreakpoint,
} from '~/co-work/lib/meeting-responsive'
import {
  applyMeetingUiLayout,
  resolveMeetingUiPadding,
  shouldAutoHideMeetingControls,
} from '~/co-work/lib/meeting-ui-overlay'
import { useMeetingUiVisibility } from '~/co-work/hooks/useMeetingUiVisibility'
import { useMeetingFullscreen } from '~/co-work/hooks/useMeetingFullscreen'
import { useKeyboardBottomInset } from '~/hooks/useKeyboardVisible'
import { supportsMeetingVideo } from '~/lib/platform/capabilities'
import {
  describeMeetingWebScreenShare,
  detectMeetingWebCapabilities,
  mapWebScreenShareError,
  meetingWebUnsupportedMessage,
} from '~/co-work/lib/meeting-web'
import {
  buildAndroidIntentUrl,
  buildOpenInAppSchemeUrl,
  launchNativeApp,
} from '~/lib/platform/open-in-app'
import { detectMobileDevice } from '~/lib/utils/mobile-detection'
import { openInstantMeetingSession, markInstantMeetingEnteredRoom, closeInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  clearGlobalSession,
  enterGlobalSessionPip,
  minimizeGlobalSession,
  peekGlobalSession,
  registerGlobalSession,
} from '~/lib/session/global-session'
import { useRegisterGlobalSession } from '~/lib/session/useRegisterGlobalSession'
import {
  detectSessionPipCapabilities,
  requestSessionPictureInPicture,
  sessionPipUnsupportedMessage,
} from '~/lib/session/picture-in-picture'
import { meetingBrowsingMinimizedNotice } from '~/co-work/lib/meeting-lifecycle'
import { clearImageCropQueue } from '~/lib/media/crop-session'
import { useSessionPipOnHide } from '~/lib/session/useSessionPipOnHide'
import { formatMeetingCode, getMeetingShareUrl, updateMeetingLiveSettings, updateMeetingTitle } from '~/co-work/lib/meetings'
import { isMeetingPopoutMode } from '~/co-work/lib/meeting-dual-monitor'
import { copyShareLink } from '~/lib/share'
import {
  endMeetingConfirmCopy,
  hostLeaveConfirmCopy,
} from '~/co-work/lib/meeting-end'
import { footerFadeStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'
import { navigateApp } from '~/lib/platform/navigate'
import { coWorkRoutes } from '~/lib/routes'

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type MeetingRoomScreenProps = {
  meeting: Meeting
  userId: string
  displayName: string
  avatarUrl?: string | null
  isHost: boolean
  /** Optional — overlay host closes session; default navigates to Co-Work home. */
  onLeave?: () => void
  /** Pre-join mic preference (default on). */
  initialAudioEnabled?: boolean
  /** Pre-join camera preference (default on when video is supported). */
  initialVideoEnabled?: boolean
}

type PresenceState = ReturnType<typeof useMeetingPresence>
type MediaCaps = ReturnType<typeof getMediaCapabilities>

export function MeetingRoomScreen(props: MeetingRoomScreenProps) {
  const existing = useOptionalMeetingMachine()
  if (existing) {
    return <MeetingRoomContent {...props} />
  }
  return (
    <MeetingProvider>
      <MeetingRoomContent {...props} />
    </MeetingProvider>
  )
}

function MeetingRoomContent(props: MeetingRoomScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { bindPresenceCollaboration } = useMeetingMachine()
  const presence = useMeetingPresence({
    meeting: props.meeting,
    userId: props.userId,
    displayName: props.displayName,
    isHost: props.isHost,
    enabled: true,
  })

  const title = useMemo(() => props.meeting.title, [props.meeting.title])
  const onlineRemoteParticipants = useMemo(
    () =>
      meetingOnlineRemoteParticipants(presence.participants, {
        localUserId: props.userId,
        onlineUserIds: presence.onlineUserIds,
      }),
    [presence.onlineUserIds, presence.participants, props.userId],
  )
  const caps = useMemo(() => getMediaCapabilities(), [])
  const hasMediaRoom = supportsMeetingVideo() && !!props.meeting.room_id
  const { width: roomWidth, height: roomHeight } = useWindowDimensions()
  // Video surfaces remain active behind/above bottom sheets (Image 1)
  const blockVideoSurfaces = false
  const [mediaReconnectFailed, setMediaReconnectFailed] = useState(false)
  const [joinedElsewhere, setJoinedElsewhere] = useState(false)
  const [mediaReconnectKey, setMediaReconnectKey] = useState(0)
  const [breakoutRoomId, setBreakoutRoomId] = useState<string | null>(null)
  const mediaConnectedRef = useRef(false)
  const ignoreMediaDisconnectRef = useRef(false)
  const mediaAutoRetryRef = useRef(0)

  const handleMediaConnected = useCallback(() => {
    mediaConnectedRef.current = true
    mediaAutoRetryRef.current = 0
    setMediaReconnectFailed(false)
  }, [])

  const remountMediaRoom = useCallback(() => {
    ignoreMediaDisconnectRef.current = true
    mediaConnectedRef.current = false
    setMediaReconnectFailed(false)
    setMediaReconnectKey((value) => value + 1)
    setTimeout(() => {
      ignoreMediaDisconnectRef.current = false
    }, MEETING_MEDIA_REMOUNT_GUARD_MS)
  }, [])

  const handleMediaDisconnected = useCallback((reason?: MeetingDisconnectReason) => {
    // The SFU allows one connection per identity (our user id). Auto-rejoining
    // here would kick the user's other device/tab, which then rejoins and kicks
    // this one — an endless loop. Stop and let the user pick where to stay.
    if (reason === 'duplicate_identity') {
      mediaConnectedRef.current = false
      setJoinedElsewhere(true)
      return
    }
    // Ignore tear-down from remount / leave / credential retry — those are not
    // real network failures and previously flashed "Unable to reconnect".
    if (ignoreMediaDisconnectRef.current) return
    if (!mediaConnectedRef.current) return

    // Several silent remounts before escalating to the full-page reconnect UI.
    if (shouldSilentRemountMedia(mediaAutoRetryRef.current)) {
      mediaAutoRetryRef.current += 1
      remountMediaRoom()
      return
    }

    mediaConnectedRef.current = false
    setMediaReconnectFailed(true)
  }, [remountMediaRoom])

  // Collaboration layer (presence / chat / hands) — separate from SFU media.
  // Update the adapter pointer every change; unbind only on unmount so we never
  // null→rebind (that bumped MeetingProvider and looped with media re-renders).
  useEffect(() => {
    bindPresenceCollaboration({
      participants: presence.participants,
      handRaised: presence.handRaised,
      sendChat: presence.sendChat,
      toggleHandRaise: presence.toggleHandRaise,
      leave: presence.leave,
      retryJoinRequest: presence.retryJoinRequest,
    })
  }, [
    bindPresenceCollaboration,
    presence.handRaised,
    presence.leave,
    presence.participants,
    presence.retryJoinRequest,
    presence.sendChat,
    presence.toggleHandRaise,
  ])

  useEffect(() => {
    return () => bindPresenceCollaboration(null)
  }, [bindPresenceCollaboration])

  // Pre-room + admitted presence. Screen share / audio-only refinements are
  // owned by useMeetingLifecycle so CONNECTED never clobbers SCREEN_SHARING.
  const admitted =
    (!presence.isConnecting || presence.participants.length > 0) &&
    !presence.isWaiting &&
    !presence.isRemoved &&
    !presence.isRejected &&
    !presence.connectionFailed &&
    !mediaReconnectFailed

  useSyncMeetingLifecycle({
    joining: presence.isConnecting,
    waitingForHost: presence.isWaiting,
    removed: presence.isRemoved,
    connectionFailed: presence.connectionFailed || mediaReconnectFailed,
    inMeeting: admitted || undefined,
  })

  const leaveMeetingScreen = useCallback(async () => {
    ignoreMediaDisconnectRef.current = true
    mediaConnectedRef.current = false
    await presence.leave()
    closeInstantMeetingSession()
    clearGlobalSession()
    if (props.onLeave) props.onLeave()
    else navigateApp(coWorkRoutes.home)
  }, [presence, props])

  // If we landed on reconnect after the host ended, tear down the overlay and
  // show the real Meeting ended page instead of "Unable to reconnect".
  useEffect(() => {
    if (!(presence.connectionFailed || mediaReconnectFailed)) return
    if (props.meeting.status !== 'ended' && props.meeting.status !== 'cancelled') return
    closeInstantMeetingSession()
    clearGlobalSession()
    navigateApp(coWorkRoutes.meetingEnded(props.meeting.meeting_code))
  }, [
    mediaReconnectFailed,
    presence.connectionFailed,
    props.meeting.meeting_code,
    props.meeting.status,
  ])

  // Only the first join may replace the room with a spinner. Background
  // realtime heals must not remount the media room (that looked like auto-refresh).
  if (presence.isConnecting && presence.participants.length === 0) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brandLight} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Joining meeting…
        </Text>
      </ScreenCenter>
    )
  }

  if (presence.isRejected) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
        <Text fontSize={24} fontWeight="800" color={coworkUi.text} textAlign="center">
          The host declined your join request
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center">
          You were not admitted to {title}.
        </Text>
        <Button tone="primary" size="$3" borderRadius={999} onPress={() => (props.onLeave ? props.onLeave() : navigateApp(coWorkRoutes.home))}>
          Back to Meetings
        </Button>
      </ScreenCenter>
    )
  }

  if (presence.isRemoved) {
    return (
      <MeetingReconnectFallback
        title="You were removed from this meeting"
        message="The host must allow you to rejoin before this meeting link will work again."
        error={presence.error}
        onRetry={() => presence.retryJoinRequest()}
        onLeave={leaveMeetingScreen}
      />
    )
  }

  if (joinedElsewhere) {
    return (
      <MeetingReconnectFallback
        title="You joined from another device"
        message="This meeting is open with your account on another device or browser tab. Join here to move the meeting to this screen."
        retryLabel="Join here"
        onRetry={async () => {
          mediaAutoRetryRef.current = 0
          setJoinedElsewhere(false)
          remountMediaRoom()
        }}
        onLeave={leaveMeetingScreen}
      />
    )
  }

  if (presence.connectionFailed || mediaReconnectFailed) {
    // Prefer the dedicated ended page over a misleading reconnect prompt when
    // the host already ended the room (InstantMeetingHost used to cover /ended).
    if (props.meeting.status === 'ended' || props.meeting.status === 'cancelled') {
      return (
        <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
          <Spinner size="large" color={coworkUi.brandLight} />
          <Text color={coworkUi.textSecondary}>This meeting has ended…</Text>
        </ScreenCenter>
      )
    }
    return (
      <MeetingReconnectFallback
        title="Unable to reconnect"
        message="Check your internet connection, then tap Rejoin meeting. You can also go Back to Meetings and join again."
        error={presence.error}
        onRetry={async () => {
          mediaAutoRetryRef.current = 0
          remountMediaRoom()
          await presence.retryJoinRequest()
        }}
        onLeave={leaveMeetingScreen}
      />
    )
  }

  if (presence.isWaiting) {
    return (
      <MeetingWaitingRoom
        meetingTitle={title}
        meetingCode={formatMeetingCode(props.meeting.meeting_code)}
        hostPresent={presence.isHostPresent}
        realtimeConnected={presence.isRealtimeConnected}
        realtimeDegraded={presence.realtimeDegraded}
        error={presence.error}
        onRetry={presence.retryJoinRequest}
        onCancel={async () => {
          await presence.leave()
          if (props.onLeave) props.onLeave()
          else navigateApp(coWorkRoutes.home)
        }}
      />
    )
  }

  return (
    <MeetingLiveSignalsProvider
      localUserId={props.userId}
      handRaised={presence.handRaised}
      raisedHands={presence.raisedHands}
      nonverbalByUserId={presence.nonverbalByUserId}
      blockVideoSurfaces={blockVideoSurfaces}
      spotlightUserId={presence.spotlightUserId}
      onlineRemoteParticipants={onlineRemoteParticipants}
      tileHostActions={{
        canModerate: presence.canModerate || props.isHost,
        setSpotlight: (id) => presence.setSpotlight(id),
        lowerHandFor: (id) => presence.lowerHandFor(id),
      }}
      rolesByUserId={Object.fromEntries(
        presence.participants.map((participant) => [
          participant.user_id,
          participant.role ?? (participant.is_host ? 'host' : 'participant'),
        ]),
      )}
    >
      <MeetingMediaRoom
        key={`${mediaReconnectKey}:${breakoutRoomId ?? 'main'}`}
        meetingId={props.meeting.id}
        roomId={breakoutRoomId ?? props.meeting.room_id ?? ''}
        displayName={props.displayName}
        avatarUrl={props.avatarUrl}
        isHost={props.isHost}
        enabled={!presence.isWaiting && !presence.isRejected}
        initialAudio={props.initialAudioEnabled !== false}
        initialVideo={props.initialVideoEnabled !== false}
        onConnected={handleMediaConnected}
        onDisconnected={handleMediaDisconnected}
        overlay={
          hasMediaRoom
            ? (callMedia) => (
                <MeetingRoomOverlay
                  {...props}
                  presence={presence}
                  caps={caps}
                  title={title}
                  callMedia={callMedia ?? undefined}
                  activeBreakoutRoomId={breakoutRoomId}
                  onRemountMedia={remountMediaRoom}
                  onJoinBreakoutRoom={(roomName) => {
                    setBreakoutRoomId(roomName)
                    setMediaReconnectKey((value) => value + 1)
                  }}
                  onLeaveBreakoutRoom={() => {
                    setBreakoutRoomId(null)
                    setMediaReconnectKey((value) => value + 1)
                  }}
                />
              )
            : () => (
                <MeetingRoomOverlay
                  {...props}
                  presence={presence}
                  caps={caps}
                  title={title}
                  activeBreakoutRoomId={breakoutRoomId}
                  onRemountMedia={remountMediaRoom}
                  onJoinBreakoutRoom={(roomName) => {
                    setBreakoutRoomId(roomName)
                    setMediaReconnectKey((value) => value + 1)
                  }}
                  onLeaveBreakoutRoom={() => {
                    setBreakoutRoomId(null)
                    setMediaReconnectKey((value) => value + 1)
                  }}
                />
              )
        }
      />
    </MeetingLiveSignalsProvider>
  )
}

function MeetingReconnectFallback({
  title,
  message,
  error,
  retryLabel = 'Rejoin meeting',
  onRetry,
  onLeave,
}: {
  title: string
  message: string
  error?: string | null
  retryLabel?: string
  onRetry: () => Promise<void>
  onLeave: () => Promise<void>
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [busy, setBusy] = useState<'retry' | 'leave' | null>(null)

  const run = async (action: 'retry' | 'leave', task: () => Promise<void>) => {
    if (busy) return
    setBusy(action)
    try {
      await task()
    } finally {
      setBusy(null)
    }
  }

  return (
    <ViewportOverlay>
      <YStack
        position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center"
        padding="$6"
        gap="$4"
        backgroundColor={coworkUi.pageBg}
        zIndex={200_000}
        style={
          Platform.OS === 'web'
            ? { position: 'fixed', inset: 0, zIndex: 200_000 }
            : undefined
        }
      >
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={coworkUi.warningMuted}
          borderWidth={1}
          borderColor={coworkUi.borderSoft}
        >
          <Icons.AlertTriangle size={26} color={coworkUi.warning} />
        </YStack>
        <Text fontSize={24} fontWeight="800" color={coworkUi.text} textAlign="center">
          {title}
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center" maxWidth={460}>
          {message}
        </Text>
        {error ? (
          <Text color={coworkUi.danger} textAlign="center" maxWidth={460}>
            {error}
          </Text>
        ) : null}
        <XStack gap="$3" flexWrap="wrap" justifyContent="center">
          <Button
            tone="primary"
            borderRadius={999}
            minWidth={140}
            minHeight={48}
            disabled={!!busy}
            onPress={() => void run('retry', onRetry)}
          >
            {busy === 'retry' ? 'Rejoining…' : retryLabel}
          </Button>
          <Button
            tone="outline"
            borderRadius={999}
            minWidth={140}
            minHeight={48}
            disabled={!!busy}
            onPress={() => void run('leave', onLeave)}
          >
            {busy === 'leave' ? 'Leaving…' : 'Back to Meetings'}
          </Button>
        </XStack>
      </YStack>
    </ViewportOverlay>
  )
}

function MeetingRoomOverlay({
  meeting,
  userId,
  displayName,
  avatarUrl,
  onLeave,
  presence,
  caps,
  title,
  callMedia,
  isHost,
  activeBreakoutRoomId = null,
  onRemountMedia,
  onJoinBreakoutRoom,
  onLeaveBreakoutRoom,
}: MeetingRoomScreenProps & {
  presence: PresenceState
  caps: MediaCaps
  title: string
  callMedia?: MeetingMediaControls
  activeBreakoutRoomId?: string | null
  onRemountMedia?: () => void
  onJoinBreakoutRoom?: (mediaRoomName: string) => void
  onLeaveBreakoutRoom?: () => void
}) {
  const { ui: coworkUi, scheme: coworkScheme } = useCoWorkTheme()
  const {
    state: meetingMachine,
    bindSfuMedia,
    session,
  } = useMeetingMachine()
  const {
    syncLifecycle,
    leave: markLeaving,
    end: markEnded,
    dispatchUi,
  } = useMeetingStateManager()
  const toast = useAppToast()
  const fullscreen = useMeetingFullscreen()
  const webCapabilities = useMemo(
    () => (Platform.OS === 'web' ? detectMeetingWebCapabilities() : null),
    [],
  )
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const { isTablet, isDesktop, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const layoutBase = useMemo(
    () =>
      resolveMeetingUiLayout({
        width: viewportWidth,
        height: viewportHeight,
        safeTop,
        safeBottom,
        safeLeft,
        safeRight,
        isTablet,
        isDesktop,
        isNative: Platform.OS !== 'web',
      }),
    [
      isDesktop,
      isTablet,
      safeBottom,
      safeLeft,
      safeRight,
      safeTop,
      viewportHeight,
      viewportWidth,
    ],
  )
  const layout = useMemo(
    () =>
      applyMeetingUiLayout(
        layoutBase,
        resolveMeetingUiPadding({
          layout: layoutBase,
          uiMode: meetingMachine.uiMode,
          controlsVisible: meetingMachine.controlsVisible,
          safeTop,
          safeBottom,
        }),
      ),
    [
      layoutBase,
      meetingMachine.controlsVisible,
      meetingMachine.uiMode,
      safeBottom,
      safeTop,
    ],
  )
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [meetingState, setMeetingState] = useState(meeting)
  useEffect(() => {
    setMeetingState(meeting)
  }, [meeting])

  const activeVideoTrack = callMedia?.featuredVideo ?? null

  // Who is really here: drops `admitted` rows left behind by closed tabs / killed apps.
  const liveParticipants = useMemo(
    () =>
      meetingLiveParticipants(presence.participants, {
        localUserId: userId,
        onlineUserIds: presence.onlineUserIds,
        mediaUserIds: callMedia?.remoteUserIds,
      }),
    [callMedia?.remoteUserIds, presence.onlineUserIds, presence.participants, userId],
  )

  const peoplePanelOpen = presence.panel === 'people'
  const [speakingUserIds, setSpeakingUserIds] = useState<string[]>([])
  useEffect(() => {
    const next = peoplePanelOpen ? callMedia?.speakingIdentities ?? [] : []
    setSpeakingUserIds((current) =>
      current.length === next.length && current.every((id, index) => id === next[index])
        ? current
        : next,
    )
  }, [callMedia?.speakingIdentities, peoplePanelOpen])

  const [shareOpen, setShareOpen] = useState(false)
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false)
  const [shareOptionsInitialContent, setShareOptionsInitialContent] =
    useState<MeetingShareContentKind | null>(null)
  const [appsSheetOpen, setAppsSheetOpen] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [askToUnmuteVisible, setAskToUnmuteVisible] = useState(false)
  const [inviteCardDismissed, setInviteCardDismissed] = useState(false)
  const [safeDrivingOpen, setSafeDrivingOpen] = useState(false)
  const [safeDrivingSpeaking, setSafeDrivingSpeaking] = useState(false)
  const [transferHostOpen, setTransferHostOpen] = useState(false)
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false)
  const [controlsOverlayOpen, setControlsOverlayOpen] = useState(false)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [whiteboardHidden, setWhiteboardHidden] = useState(false)
  /** Viewer hid this content share (Zoom "hide"); a new share shows again. */
  const [contentHiddenId, setContentHiddenId] = useState<string | null>(null)
  const [contentUploadLabel, setContentUploadLabel] = useState<string | null>(null)
  const [audioTestOpen, setAudioTestOpen] = useState(false)
  const [annotateShareOpen, setAnnotateShareOpen] = useState(false)
  const [originalSound, setOriginalSound] = useState(false)
  const [hdVideo, setHdVideo] = useState(true)
  const [enterExitSound, setEnterExitSound] = useState(true)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const exitingRef = useRef(false)
  const presenceCountRef = useRef<number | null>(null)
  // Read synchronously on the Share tap — browsers drop the user gesture across slow awaits.
  const quickShareOptionsRef = useRef<MeetingShareStartOptions>({
    content: 'screen',
    shareComputerSound: false,
    optimizeShareForVideo: false,
    annotateAfterShare: false,
  })
  const { setStopIncomingVideo, stopIncomingVideo } = useMeetingLiveSignals()

  useEffect(() => {
    void import('~/co-work/lib/meeting-media-prefs').then(({ loadMeetingMediaPrefs }) =>
      loadMeetingMediaPrefs().then((prefs) => {
        setOriginalSound(!!prefs.originalSound)
        setHdVideo(prefs.hdVideo !== false)
        setStopIncomingVideo(!!prefs.stopIncomingVideo)
        setEnterExitSound(prefs.enterExitSound !== false)
        quickShareOptionsRef.current = {
          content: 'screen',
          shareComputerSound: prefs.shareComputerSound === true,
          optimizeShareForVideo: prefs.optimizeShareForVideo === true,
          annotateAfterShare: prefs.annotateAfterShare === true,
        }
      }),
    )
  }, [setStopIncomingVideo])

  // Zoom join/leave chime when admitted participant count changes.
  useEffect(() => {
    const admitted = meetingLiveAdmittedCount(liveParticipants)
    const previous = presenceCountRef.current
    presenceCountRef.current = admitted
    if (previous == null) return
    if (!enterExitSound) return
    void import('~/co-work/lib/meeting-join-sounds').then(
      ({ playMeetingJoinChime, playMeetingLeaveChime, resolveMeetingPresenceSound }) => {
        const kind = resolveMeetingPresenceSound({
          previousCount: previous,
          nextCount: admitted,
        })
        if (kind === 'join') playMeetingJoinChime()
        else if (kind === 'leave') playMeetingLeaveChime()
      },
    )
  }, [enterExitSound, liveParticipants])

  // Persist "already in room" on the InstantMeetingHost session so Maximize
  // restores MeetingRoomScreen instead of the Join confirm lobby.
  useEffect(() => {
    markInstantMeetingEnteredRoom({ displayName, meeting })
  }, [displayName, meeting])

  // Keep SFU adapter pointer fresh without unbind/rebind thrash.
  // The media controls object changes identity each render — cleanup→null→bind
  // was bumping MeetingProvider adapters in a max-update-depth loop (captions/panels).
  useEffect(() => {
    bindSfuMedia(callMedia ?? null)
  }, [bindSfuMedia, callMedia])

  useEffect(() => {
    return () => bindSfuMedia(null)
  }, [bindSfuMedia])

  useEffect(() => {
    if (exiting) markLeaving()
  }, [exiting, markLeaving])

  const isAuthoritativeHost = isHost || presence.selfRole === 'host'
  const canModerate = presence.canModerate || isAuthoritativeHost
  const chatEnabled = isMeetingChatEnabled(meetingState)
  const privateChatEnabled = isMeetingPrivateChatEnabled(meetingState)
  const supportsScreenBroadcast =
    !!callMedia && (caps.supportsScreenShare || Platform.OS === 'ios' || Platform.OS === 'android')

  // Webinar mode: force attendees muted when the host enables it.
  useEffect(() => {
    if (!presence.webinarMode || isAuthoritativeHost || canModerate || !callMedia) return
    if (callMedia.audioEnabled) {
      void presence.syncMediaState({ is_muted: true })
      callMedia.toggleAudio()
    }
  }, [canModerate, isAuthoritativeHost, callMedia, presence, presence.webinarMode])

  const popoutMode = Platform.OS === 'web' && isMeetingPopoutMode()

  useEffect(() => {
    if (!popoutMode) return
    dispatchUi({ type: 'SET_UI_MODE', uiMode: 'maximized' })
    dispatchUi({ type: 'SET_CONTROLS', visible: false })
  }, [dispatchUi, popoutMode])

  const localBackgroundMode =
    callMedia?.videoEffects.status === 'error' ? 'off' : (callMedia?.videoEffects.selection.mode ?? 'off')
  useEffect(() => {
    dispatchUi({ type: 'SET_LOCAL_BACKGROUND_MODE', mode: localBackgroundMode })
  }, [dispatchUi, localBackgroundMode])

  const setControlsVisible = useCallback(
    (visible: boolean) => {
      dispatchUi({ type: 'SET_CONTROLS', visible })
    },
    [dispatchUi],
  )
  const roomModalOpen =
    controlsOverlayOpen ||
    shareOptionsOpen ||
    appsSheetOpen ||
    settingsSheetOpen ||
    reactionTrayOpen ||
    audioTestOpen ||
    shortcutsOpen ||
    transferHostOpen ||
    infoModalOpen ||
    safeDrivingOpen

  const { revealControls, toggleControls } = useMeetingUiVisibility({
    uiMode: meetingMachine.uiMode,
    viewMode: meetingMachine.viewMode,
    panelOpen: presence.panel !== 'none',
    modalOpen: roomModalOpen,
    waitingCount: presence.waitingParticipants.length,
    busy: exiting,
    controlsPinned: meetingMachine.controlsPinned,
    controlsVisible: meetingMachine.controlsVisible,
    onSetControlsVisible: setControlsVisible,
  })
  const controlsVisible = meetingMachine.controlsVisible
  const immersiveAutoHide = shouldAutoHideMeetingControls({
    uiMode: meetingMachine.uiMode,
    viewMode: meetingMachine.viewMode,
    panelOpen: presence.panel !== 'none',
    modalOpen: roomModalOpen,
    waitingCount: presence.waitingParticipants.length,
    busy: exiting,
    controlsPinned: meetingMachine.controlsPinned,
  })
  const allowRecording = meetingState.security_settings?.allowRecording !== false
  const allowScreenShare = meetingState.security_settings?.allowScreenShare !== false
  const allowHandRaise = meetingState.security_settings?.allowHandRaise !== false
  const allowSelfUnmute = meetingState.security_settings?.allowSelfUnmute !== false
  const allowSelfStartVideo = meetingState.security_settings?.allowSelfStartVideo !== false
  const autoRecord = !!meetingState.meeting_options?.autoRecord && isAuthoritativeHost && allowRecording
  const admittedCount = meetingLiveAdmittedCount(liveParticipants)
  const inviteNudgeShownRef = useRef(false)

  // Zoom-like: nudge the host to share the join code when they are alone in the room.
  useEffect(() => {
    if (!isAuthoritativeHost || inviteNudgeShownRef.current) return
    if (admittedCount !== 1 || presence.isWaiting || presence.isConnecting) return
    inviteNudgeShownRef.current = true
    const code = formatMeetingCode(meeting.meeting_code)
    const shareUrl = getMeetingShareUrl(meeting.meeting_code)
    toast.show('Invite others to this room', {
      tone: 'info',
      message: `Code ${code} · share so 1–N people can join`,
      actionLabel: 'Copy link',
      onAction: () => {
        void copyShareLink(shareUrl).then((copied) => {
          toast.show(copied ? 'Invite link copied' : 'Could not copy link', {
            tone: copied ? 'success' : 'error',
          })
        })
      },
    })
  }, [
    admittedCount,
    isAuthoritativeHost,
    meeting.meeting_code,
    presence.isConnecting,
    presence.isWaiting,
    toast,
  ])

  const participantDisplayNames = useMemo(
    () =>
      Object.fromEntries(
        presence.participants.map((participant) => [
          participant.user_id,
          participant.display_name ||
            participant.profile?.full_name ||
            participant.profile?.username ||
            'Guest',
        ]),
      ),
    [presence.participants],
  )
  useEffect(() => {
    if (presence.whiteboard.active) setWhiteboardHidden(false)
  }, [presence.whiteboard.active, presence.whiteboard.startedBy])
  const roomy = isTablet || isDesktop
  const panelTrailingInset = layout.panelTrailingInset

  const captions = useLiveCaptions({
    userId,
    displayName,
    enabled: true,
    remoteCaptions: presence.liveCaptions,
    roomWantsCaptions: presence.roomWantsCaptions,
    speechEnabled: callMedia?.audioEnabled ?? false,
    onPublishCaption: (text, sourceLang, isFinal) =>
      presence.broadcastCaption(text, displayName, sourceLang, isFinal),
  })
  const captionsPrefAppliedRef = useRef(false)
  const prevSelfRoleRef = useRef(presence.selfRole)
  const prevCaptionLangRef = useRef(captions.targetLang)

  useEffect(() => {
    presence.setCaptionWanted(captions.active)
  }, [captions.active, presence.setCaptionWanted])

  useEffect(() => {
    if (captionsPrefAppliedRef.current) return
    if (!meeting.meeting_options?.captionsEnabled || !captions.supported) return
    captionsPrefAppliedRef.current = true
    if (!captions.active) {
      captions.setCollapsed(false)
      captions.toggleCaptions()
    }
    // Depend on primitives — full `captions` object identity churned every render.
  }, [
    captions.active,
    captions.setCollapsed,
    captions.supported,
    captions.toggleCaptions,
    meeting.meeting_options?.captionsEnabled,
  ])

  // Notify the assignee when they become co-host / host mid-meeting (Zoom-style).
  useEffect(() => {
    const previous = prevSelfRoleRef.current
    const next = presence.selfRole
    prevSelfRoleRef.current = next
    if (previous === next) return
    if (next === 'co_host') {
      toast.show('You’re now a co-host', {
        tone: 'success',
        message: 'You can mute participants, admit waiting guests, and manage chat.',
      })
      return
    }
    if (next === 'host' && previous !== 'host') {
      toast.show('You’re now the host', {
        tone: 'success',
        message: 'You can end the meeting, lock it, and assign co-hosts.',
      })
      return
    }
    if (previous === 'co_host' && next === 'participant') {
      toast.show('Co-host role removed', { tone: 'info' })
    }
  }, [presence.selfRole, toast])

  useEffect(() => {
    const previous = prevCaptionLangRef.current
    prevCaptionLangRef.current = captions.targetLang
    if (previous === captions.targetLang || !captions.active) return
    toast.show(`Captions · ${captions.targetLangName}`, {
      tone: 'info',
      message: 'Listening and translating into this language for you only.',
    })
  }, [captions.active, captions.targetLang, captions.targetLangName, toast])

  // Interpretation channel → caption target language (Zoom language interpretation lite).
  // Only on channel changes: `captions` is a new object every render, and
  // re-applying the channel would keep overriding the viewer's own Show pick.
  const setCaptionTargetLang = captions.setTargetLang
  useEffect(() => {
    const channel = presence.interpretationChannelId
    if (!channel || channel === 'floor') return
    if (channel === 'en' || channel === 'hi' || channel === 'es') {
      setCaptionTargetLang(channel)
    }
  }, [setCaptionTargetLang, presence.interpretationChannelId])

  const recordingSession = useMeetingRecording({
    roomName: callMedia?.connected ? activeBreakoutRoomId ?? meeting.room_id ?? null : null,
    meetingId: meeting.id,
    meetingCode: meeting.meeting_code,
    enabled: allowRecording && (isAuthoritativeHost || canModerate),
    autoStart: autoRecord,
    captionLines: captions.transcriptLines,
    onStarted: () => {
      toast.show('Cloud recording started', {
        tone: 'success',
        message: 'Audio and video are being saved for the whole room.',
      })
    },
    onStopped: (status) =>
      toast.show(
        status === 'processing' ? 'Recording processing' : 'Recording stopped',
        {
          tone: 'success',
          message:
            status === 'processing'
              ? 'Your shareable MP4 link will appear in Recordings when ready.'
              : undefined,
        },
      ),
    onReady: () =>
      toast.show('Recording ready', {
        tone: 'success',
        message: 'Open Recordings to share a revocable link.',
      }),
    onError: (message, configRequired) => {
      if (configRequired) {
        toast.show('Recording unavailable', {
          tone: 'danger',
          message: 'Cloud recording storage is not set up. Contact your administrator.',
        })
      } else {
        toast.show(message, { tone: 'danger' })
      }
    },
    onBroadcastStatus: (isRecording) => {
      presence.broadcastRecordingStatus(isRecording)
    },
  })

  const recordingIndicator = useMeetingRecordingIndicator(
    meeting.id,
    allowRecording && !(isAuthoritativeHost || canModerate),
  )

  const showError = presence.error && presence.error !== dismissedError
  // Keyboard resize can flip portrait→landscape metrics and unmount the sheet
  // under a focused composer. Freeze presentation while any panel is open.
  const panelPresentationLockedRef = useRef(layout.panelPresentation)
  if (presence.panel === 'none') {
    panelPresentationLockedRef.current = layout.panelPresentation
  }
  const panelPresentation =
    presence.panel === 'none' ? layout.panelPresentation : panelPresentationLockedRef.current
  const panelFullWidth = panelPresentation === 'bottom-sheet'
  const sheetPanelOpen = panelPresentation === 'bottom-sheet' && presence.panel !== 'none'
  const sidePanelWidth = Math.min(
    layout.breakpoint === 'large-desktop' ? 440 : layout.breakpoint === 'desktop' ? 400 : 380,
    Math.round(viewportWidth * layout.panelMaxWidthFraction),
  )
  const sidePanelOpen = panelPresentation === 'side' && presence.panel !== 'none'
  const stageTrailingInsetValue = sidePanelOpen
    ? sidePanelWidth + Math.max(layout.panelTrailingInset, 8)
    : 0
  const {
    setStageTrailingInset,
    pinnedUserIds,
    togglePinnedUserId,
    stageHandlesTaps,
    setStageTapHandler,
    setSafeDrivingHandler,
  } = useMeetingLiveSignals()
  useEffect(() => {
    setStageTrailingInset(stageTrailingInsetValue)
    return () => setStageTrailingInset(0)
  }, [setStageTrailingInset, stageTrailingInsetValue])
  useEffect(() => {
    setStageTapHandler(toggleControls)
    return () => setStageTapHandler(null)
  }, [setStageTapHandler, toggleControls])
  const recording = isAuthoritativeHost || canModerate
    ? recordingSession.recording || recordingSession.isProcessing
    : presence.liveRecordingSignal ?? recordingIndicator.isRecording

  useEffect(() => {
    if (!callMedia) {
      presence.registerMediaHandlers({})
      return
    }

    const applyRemoteMuteAll = () => {
      if (callMedia.audioEnabled) {
        void presence.syncMediaState({ is_muted: true })
        callMedia.toggleAudio()
      }
      toast.show('You were muted by a moderator', { tone: 'info' })
    }

    presence.registerMediaHandlers({
      onMuteAll: applyRemoteMuteAll,
      onForceMute: applyRemoteMuteAll,
      onMuteRequested: () => {
        toast.show('A moderator asked you to mute', {
          tone: 'info',
          message: 'Use your microphone control when you are ready.',
        })
      },
      onAskToUnmute: () => {
        setAskToUnmuteVisible(true)
        toast.show('A moderator asked you to unmute', {
          tone: 'info',
          message: 'Tap Unmute when you are ready.',
        })
      },
      onStopVideo: () => {
        if (callMedia.videoEnabled) {
          void presence.syncMediaState({ is_video_off: true })
          callMedia.toggleVideo()
        }
        toast.show('Your video was stopped by a moderator', { tone: 'info' })
      },
      onMeetingEnded: () => {
        if (exitingRef.current) return
        exitingRef.current = true
        setExiting(true)
        void (async () => {
          try {
            if (callMedia.screenSharing) {
              await Promise.resolve(callMedia.toggleScreenShare())
            }
          } catch {
            // Best-effort.
          }
          try {
            callMedia.disconnect()
          } catch {
            // Already disconnected.
          }
          markEnded()
          closeInstantMeetingSession()
          clearGlobalSession()
          navigateApp(coWorkRoutes.meetingEnded(meeting.meeting_code))
        })()
      },
    })
    return () => {
      presence.registerMediaHandlers({})
    }
  }, [
    callMedia,
    markEnded,
    meeting.meeting_code,
    presence.registerMediaHandlers,
    presence.syncMediaState,
    toast,
  ])

  // Lobby choices, background camera pauses and device failures never pass through
  // the toggles, so reconcile the roster row with the live media state.
  const liveMuted = callMedia ? !callMedia.audioEnabled : null
  const liveVideoOff = callMedia ? !callMedia.videoEnabled : null
  const selfRow = presence.participants.find((p) => p.user_id === userId && p.status === 'admitted')
  const rosterMuted = selfRow ? selfRow.is_muted === true : null
  const rosterVideoOff = selfRow ? selfRow.is_video_off === true : null
  const syncMediaState = presence.syncMediaState
  useEffect(() => {
    if (liveMuted === null || liveVideoOff === null || rosterMuted === null) return
    const patch: { is_muted?: boolean; is_video_off?: boolean } = {}
    if (liveMuted !== rosterMuted) patch.is_muted = liveMuted
    if (liveVideoOff !== rosterVideoOff) patch.is_video_off = liveVideoOff
    if (patch.is_muted === undefined && patch.is_video_off === undefined) return
    const timer = setTimeout(() => void syncMediaState(patch).catch(() => {}), 800)
    return () => clearTimeout(timer)
  }, [liveMuted, liveVideoOff, rosterMuted, rosterVideoOff, syncMediaState])

  useEffect(() => {
    const notice = presence.latestChatNotice
    if (!notice) return
    toast.show(notice.title, {
      tone: 'info',
      message: notice.message,
      duration: 4500,
      onPress: () => presence.togglePanel('chat'),
    })
    presence.clearChatNotice()
  }, [
    presence.latestChatNotice,
    presence.clearChatNotice,
    presence.togglePanel,
    toast,
  ])

  useEffect(() => {
    const notice = presence.latestHandNotice
    if (!notice) return
    toast.show(notice.title, {
      tone: 'info',
      message: notice.message,
      duration: 4000,
      onPress: () => presence.togglePanel('people'),
    })
    presence.clearHandNotice()
  }, [
    presence.latestHandNotice,
    presence.clearHandNotice,
    presence.togglePanel,
    toast,
  ])

  const raisedHandCount = useMemo(
    () => Object.values(presence.raisedHands).filter(Boolean).length,
    [presence.raisedHands],
  )

  const toggleRecording = useCallback(() => {
    if (!allowRecording) {
      toast.show('Recording is disabled for this meeting', { tone: 'info' })
      return
    }
    if (!isAuthoritativeHost && !canModerate) {
      if (recordingSession.recording || recordingIndicator.isRecording) {
        toast.show('This meeting is already being recorded', { tone: 'info' })
        return
      }
      presence.requestRecording()
      toast.show('Recording request sent', {
        tone: 'info',
        message: 'The host will be asked to start recording.',
      })
      return
    }
    if (!callMedia) {
      toast.show('Still connecting…', {
        tone: 'info',
        message: 'Wait for the room to join, then start recording.',
      })
      return
    }
    if (!callMedia.connected) {
      toast.show('Cloud recording is not available in this meeting yet', { tone: 'info' })
      return
    }
    const run = () => {
      try {
        recordingSession.toggleRecording()
      } catch (error) {
        toast.show('Recording failed', {
          tone: 'error',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    }
    if (recordingSession.recording) {
      run()
      return
    }
    confirmMeetingAction({
      title: 'Start recording?',
      message: 'Cloud recording will start. Everyone in the meeting will see a recording notice.',
      confirmLabel: 'Start recording',
      destructive: true,
      onConfirm: run,
    })
  }, [
    allowRecording,
    canModerate,
    isAuthoritativeHost,
    callMedia,
    presence.requestRecording,
    recordingIndicator.isRecording,
    recordingSession,
    toast,
  ])

  const toggleCaptions = useCallback(() => {
    if (!captions.supported) {
      toast.show('Live captions are not available on this device', {
        tone: 'info',
        message:
          Platform.OS === 'web'
            ? 'Use Chrome or Edge, or enable speech recognition in your browser settings.'
            : 'Allow microphone access and install the speech pack for your language in system settings.',
      })
      return
    }
    const turningOn = !captions.active
    captions.toggleCaptions()
    if (turningOn) {
      const canPublish = captions.canPublish !== false
      toast.show(`Live captions on · ${captions.targetLangName}`, {
        tone: 'success',
        message: canPublish
          ? `Speech is captioned live and shown in ${captions.targetLangName}.`
          : 'You can view others’ captions. Speech recognition is unavailable for publishing on this browser.',
      })
      return
    }
    toast.show('Live captions off', { tone: 'success' })
  }, [captions, toast])

  const toggleScreenShare = useCallback(async (options?: MeetingShareStartOptions | null) => {
    if (!callMedia) {
      toast.show('Connect to the meeting to share your screen', { tone: 'info' })
      return
    }
    if (!callMedia.screenSharing && !allowScreenShare && !canModerate) {
      toast.show('The host disabled screen sharing', { tone: 'info' })
      return
    }
    if (!supportsScreenBroadcast || androidPresentUnavailable()) {
      const device = Platform.OS === 'web' ? detectMobileDevice() : null
      const mobileWeb = !!device?.isMobile && (device.isAndroid || device.isIOS)
      const appPath = String(coWorkRoutes.meeting(meetingState.meeting_code))
      toast.show('Screen share is not available on this device', {
        tone: 'info',
        message:
          Platform.OS === 'android'
            ? ANDROID_PRESENT_UNAVAILABLE_MESSAGE
            : Platform.OS === 'web'
              ? meetingWebUnsupportedMessage(mobileWeb ? 'mobile_screen_share' : 'screen_share')
              : 'Rebuild the app with screen sharing enabled (Broadcast Extension on iOS).',
        ...(mobileWeb && device
          ? {
              actionLabel: 'Open app',
              onAction: () =>
                launchNativeApp(
                  device.isAndroid ? buildAndroidIntentUrl(appPath) : buildOpenInAppSchemeUrl(appPath),
                ),
            }
          : {}),
      })
      return
    }

    // One tap like Zoom: go straight to the OS / browser capture picker with saved options.
    // Content (whiteboard, files) and screen options live in the Docs share sheet.
    if (!callMedia.screenSharing && !options) options = quickShareOptionsRef.current

    const wasSharing = callMedia.screenSharing
    try {
      const changed = await callMedia.toggleScreenShare(
        options
          ? {
              shareComputerSound: options.shareComputerSound,
              optimizeForVideo: options.optimizeShareForVideo,
            }
          : null,
      )
      if (changed === false) return
      if (!wasSharing) presence.stopContentShare()
      toast.show(wasSharing ? 'Screen share stopped' : 'Screen sharing started', {
        tone: 'success',
        duration: 2800,
        message: wasSharing
          ? undefined
          : Platform.OS === 'ios'
            ? 'Keep the broadcast extension running while you present.'
            : Platform.OS === 'android'
            ? 'Allow screen capture when Android asks. Keep the Present notification on while you share.'
            : Platform.OS === 'web' && webCapabilities
              ? describeMeetingWebScreenShare(webCapabilities)
              : undefined,
      })
      if (!wasSharing && options?.annotateAfterShare) {
        setAnnotateShareOpen(true)
        presence.setAnnotationSessionOpen(true)
      }
    } catch (screenError) {
      const message =
        Platform.OS === 'web'
          ? mapWebScreenShareError(screenError)
          : screenError instanceof Error
            ? screenError.message
            : typeof screenError === 'string'
              ? screenError
              : screenError && typeof screenError === 'object' && 'message' in screenError
                ? String((screenError as { message?: unknown }).message)
                : undefined
      toast.show('Screen share failed', {
        tone: 'error',
        message:
          androidPresentUnavailable()
            ? ANDROID_PRESENT_UNAVAILABLE_MESSAGE
            : message || 'Allow screen recording when prompted, then try again.',
      })
    }
  }, [allowScreenShare, canModerate, callMedia, meetingState.meeting_code, presence, supportsScreenBroadcast, toast, webCapabilities])

  /** Zoom "share a file": upload once, then it plays on everyone's stage. */
  const shareContent = useCallback(
    async (kind: 'photos' | 'video' | 'files') => {
      if (!allowScreenShare && !canModerate) {
        toast.show('The host disabled sharing', { tone: 'info' })
        return
      }
      if (contentUploadLabel) return
      let sources: MeetingContentSource[] = []
      try {
        const picker = await import('~/lib/media/pick-image')
        if (kind === 'photos') {
          sources = await picker.pickImages({ multiple: true, maxCount: MEETING_CONTENT_MAX_ITEMS })
        } else if (kind === 'video') {
          sources = await picker.pickVideos({ multiple: false })
        } else {
          const doc = await picker.pickDocument()
          sources = doc ? [doc] : []
        }
      } catch (cause) {
        toast.show('Could not open files', {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'Try again.',
        })
        return
      }
      if (sources.length === 0) return

      setContentUploadLabel(
        sources.length > 1 ? `Uploading ${sources.length} photos…` : `Uploading ${sources[0]?.fileName || 'file'}…`,
      )
      try {
        const items: MeetingContentItem[] = []
        for (const source of sources) {
          items.push(await uploadMeetingContent(meeting.id, userId, source))
        }
        if (callMedia?.screenSharing) {
          await Promise.resolve(callMedia.toggleScreenShare()).catch(() => undefined)
        }
        presence.startContentShare(items)
        setContentHiddenId(null)
        toast.show('You are sharing', {
          tone: 'success',
          duration: 2600,
          message: items.length > 1 ? `${items.length} photos` : items[0]?.fileName,
        })
      } catch (cause) {
        toast.show('Could not share', {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'Upload failed. Try again.',
        })
      } finally {
        setContentUploadLabel(null)
      }
    },
    [allowScreenShare, callMedia, canModerate, contentUploadLabel, meeting.id, presence, toast, userId],
  )

  const confirmShareOptions = useCallback(
    (options: MeetingShareStartOptions) => {
      setShareOptionsOpen(false)
      quickShareOptionsRef.current = { ...options, content: 'screen' }
      if (options.content === 'whiteboard') {
        setWhiteboardHidden(false)
        presence.openWhiteboard()
        return
      }
      if (options.content === 'photos' || options.content === 'video' || options.content === 'files') {
        void shareContent(options.content)
        return
      }
      void toggleScreenShare(options)
    },
    [presence, shareContent, toggleScreenShare],
  )

  const presentingContent = presence.contentShare?.from === userId
  const stopContentShare = presence.stopContentShare

  // One share at a time, like Zoom: whoever starts sharing takes over the stage.
  const remoteContentShareId =
    presence.contentShare && !presentingContent ? presence.contentShare.id : null
  const remoteScreenPresenter = callMedia?.screenShareIdentity ?? null
  const localScreenSharing = !!callMedia?.screenSharing
  const toggleLocalScreenShare = callMedia?.toggleScreenShare
  const seenRemoteContentShareRef = useRef<string | null>(null)
  useEffect(() => {
    const started = !!remoteContentShareId && remoteContentShareId !== seenRemoteContentShareRef.current
    seenRemoteContentShareRef.current = remoteContentShareId
    if (!started || !localScreenSharing || !toggleLocalScreenShare) return
    void Promise.resolve(toggleLocalScreenShare()).catch(() => undefined)
    toast.show('Your screen share ended', { tone: 'info', message: 'Someone else started sharing.' })
  }, [localScreenSharing, remoteContentShareId, toast, toggleLocalScreenShare])
  const seenRemoteScreenPresenterRef = useRef<string | null>(null)
  useEffect(() => {
    const started = !!remoteScreenPresenter && remoteScreenPresenter !== seenRemoteScreenPresenterRef.current
    seenRemoteScreenPresenterRef.current = remoteScreenPresenter
    if (!started || !presentingContent) return
    stopContentShare()
    toast.show('Your share ended', { tone: 'info', message: 'Someone else started sharing their screen.' })
  }, [presentingContent, remoteScreenPresenter, stopContentShare, toast])

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen.supported) {
      toast.show('Full screen unavailable', {
        tone: 'info',
        message: fullscreen.unsupportedMessage || 'Full screen is not available on this device.',
      })
      return
    }
    const entering = !fullscreen.active
    void fullscreen
      .toggle()
      .then(() => {
        // Expand / restore the video stage alongside system full screen.
        dispatchUi({ type: 'SET_UI_MODE', uiMode: entering ? 'maximized' : 'normal' })
      })
      .catch((cause) => {
        toast.show('Full screen failed', {
          tone: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : fullscreen.unsupportedMessage || 'Could not enter full screen.',
        })
      })
  }, [dispatchUi, fullscreen, toast])

  const ensureMeetingGlobalSession = useCallback(
    (presentation: 'fullscreen' | 'minimized' | 'pip' = 'fullscreen') => {
      const existing = peekGlobalSession()
      const code = meeting.meeting_code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (
        existing?.kind === 'meeting' &&
        existing.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === code
      ) {
        if (presentation === 'minimized') minimizeGlobalSession()
        else if (presentation === 'pip') enterGlobalSessionPip()
        return
      }
      registerGlobalSession({
        kind: 'meeting',
        code: meeting.meeting_code,
        title: meeting.title || 'Meeting',
        subtitle: formatMeetingCode(meeting.meeting_code),
        maximizeHref: String(coWorkRoutes.meetingLive(meeting.meeting_code)),
        presentation,
        avatarUrl: avatarUrl ?? meeting.host?.avatar_url ?? null,
        participantCount: admittedCount,
        media: {
          audioEnabled: callMedia?.audioEnabled ?? true,
          videoEnabled: callMedia?.videoEnabled ?? false,
          screenSharing: callMedia?.screenSharing ?? false,
          speakerOn: callMedia?.speakerOn ?? true,
        },
        activeTrackRef: activeVideoTrack,
        // Handlers are refreshed by useRegisterGlobalSession on the next effect.
        // Stub here so the mini-player never appears without End / Mic.
        handlers: {
          toggleMic: () => {
            if (session.hasMedia()) session.toggleMic()
            else callMedia?.toggleAudio()
          },
          toggleCamera: () => {
            if (session.hasMedia()) session.toggleCamera()
            else callMedia?.toggleVideo()
          },
          toggleSpeaker: () => {
            void callMedia?.toggleSpeaker()
          },
        },
      })
    },
    [activeVideoTrack, admittedCount, avatarUrl, callMedia, meeting, session],
  )

  const minimizeMeeting = useCallback(
    (options?: { browseHref?: string | null }) => {
      // Leave system full screen before collapsing to the mini-player.
      if (fullscreen.active) {
        void fullscreen.toggle().catch(() => undefined)
      }
      dispatchUi({ type: 'SET_UI_MODE', uiMode: 'normal' })
      // Drop any open crop sheet so Minimize never reveals Commerce under
      // "Crop virtual background" UI (stale session / see-through crop hole).
      clearImageCropQueue()
      // Keep the media room mounted via InstantMeetingHost. Mark enteredRoom so Maximize
      // resumes the live room instead of the Join confirm lobby.
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
        enteredRoom: true,
        displayName,
      })
      // Always materialize the global session before collapsing — otherwise
      // `minimizeGlobalSession()` is a no-op when the media room hasn't registered yet
      // and InstantMeetingHost stays fullscreen over home.
      ensureMeetingGlobalSession('minimized')

      // On platforms supporting native PiP (iPad / iOS), attempt to launch native Video Picture-in-Picture
      // so the user actually sees the live video floating rather than an audio-only avatar!
      const caps = detectSessionPipCapabilities()
      // Android PiP shrinks the whole app window — Minimize must keep browsing in-app.
      if (caps.supported && caps.mode !== 'native_activity') {
        void requestSessionPictureInPicture('.sheconomy-meeting-overlay video, video')
          .then((res) => {
            if (res.ok) {
              ensureMeetingGlobalSession('pip')
            }
          })
          .catch(() => undefined)
      }

      toast.show('Meeting minimized', {
        tone: 'success',
        message: meetingBrowsingMinimizedNotice('meeting'),
      })
      // Tab navigation passes browseHref; the Minimize control falls back to Co-Work home.
      // Never navigate twice (browseAway used to race home vs the tapped tab).
      navigateApp((options?.browseHref as never) || coWorkRoutes.home)
    },
    [dispatchUi, displayName, ensureMeetingGlobalSession, fullscreen, meeting, toast],
  )

  const collapseMeetingForBrowse = useCallback(() => {
    clearImageCropQueue()
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
      enteredRoom: true,
      displayName,
    })
    ensureMeetingGlobalSession('minimized')
  }, [displayName, ensureMeetingGlobalSession, meeting])

  const enterMeetingPip = useCallback(() => {
    const caps = detectSessionPipCapabilities()
    void (async () => {
      const result = await requestSessionPictureInPicture(
        '.sheconomy-meeting-overlay video, video',
      )
      if (!result.ok) {
        // Fall back to in-app minimize so the user can still browse Sheconomy.
        toast.show('Picture-in-Picture unavailable', {
          tone: 'info',
          message:
            result.message ||
            sessionPipUnsupportedMessage(caps) ||
            'Use Minimize to keep the meeting while you browse Sheconomy.',
        })
        minimizeMeeting()
        return
      }
      ensureMeetingGlobalSession('pip')
      if (Platform.OS === 'ios') {
        toast.show('Picture-in-Picture', {
          tone: 'info',
          message: 'Use the system PiP controls, or Maximize from the mini bar to return.',
        })
      }
    })()
  }, [ensureMeetingGlobalSession, minimizeMeeting, toast])

  // Android Back otherwise pops the route hidden under the fullscreen room.
  const panelOpen = presence.panel !== 'none'
  const closePanel = presence.setPanel
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const presentation = peekGlobalSession()?.presentation
      if (presentation === 'minimized' || presentation === 'pip') return false
      if (panelOpen) closePanel('none')
      else minimizeMeeting()
      return true
    })
    return () => subscription.remove()
  }, [closePanel, minimizeMeeting, panelOpen])

  const toggleMeetingAudio = useCallback(() => {
    if (!callMedia && !session.hasMedia()) {
      toast.show('Still connecting…', {
        tone: 'info',
        message: 'Wait a moment for the room to join, then try mute again.',
      })
      return
    }
    const audioOn = session.getMediaSnapshot()?.audioEnabled ?? callMedia?.audioEnabled ?? true
    // Turning mic ON while muted — host may have disabled self-unmute for participants.
    if (audioOn === false && !allowSelfUnmute && !canModerate) {
      toast.show('The host disabled unmuting', {
        tone: 'info',
        message: 'Ask the host to allow participants to unmute.',
      })
      return
    }
    if (audioOn === false && presence.webinarMode && !canModerate) {
      toast.show('Webinar mode is on', {
        tone: 'info',
        message: 'Raise your hand and wait for the host to ask you to unmute.',
      })
      return
    }
    // is_muted means "participant is muted" — sync the *next* state after toggle.
    const nextMuted = audioOn
    void presence.syncMediaState({ is_muted: nextMuted })
    if (session.hasMedia()) session.toggleMic()
    else callMedia?.toggleAudio()
  }, [allowSelfUnmute, canModerate, callMedia, presence, session, toast])

  const openSafeDrivingMode = useCallback(() => {
    if (callMedia?.videoEnabled) {
      void presence.syncMediaState({ is_video_off: true })
      callMedia.toggleVideo()
    }
    if (callMedia?.audioEnabled) toggleMeetingAudio()
    setSafeDrivingOpen(true)
  }, [callMedia, presence, toggleMeetingAudio])

  // First stage page on every device: swiping right from the speaker opens Tap to speak.
  useEffect(() => {
    setSafeDrivingHandler(openSafeDrivingMode)
    return () => setSafeDrivingHandler(null)
  }, [openSafeDrivingMode, setSafeDrivingHandler])

  const toggleHand = useCallback(() => {
    const raising = !presence.handRaised
    if (raising && !allowHandRaise && !canModerate) {
      toast.show('The host disabled raise hand', { tone: 'info' })
      return
    }
    if (session.hasCollaboration()) {
      if (raising) session.raiseHand()
      else session.lowerHand()
    } else {
      presence.toggleHandRaise()
    }
    toast.show(raising ? 'Hand raised' : 'Hand lowered', {
      tone: 'success',
      message: raising ? 'Others can see your raised hand on your tile' : undefined,
    })
  }, [allowHandRaise, canModerate, presence, session, toast])

  const sendReaction = useCallback(
    (emoji: string) => {
      presence.sendReaction(emoji, displayName)
      setReactionTrayOpen(false)
    },
    [displayName, presence],
  )

  const exitToCoWork = useCallback(() => {
    closeInstantMeetingSession()
    clearGlobalSession()
    if (onLeave) {
      onLeave()
      return
    }
    navigateApp(coWorkRoutes.home)
  }, [onLeave])

  const exitToMeetingEnded = useCallback(() => {
    markEnded()
    // Tear down InstantMeetingHost before routing — otherwise the disconnect
    // shows "Unable to reconnect" over /meeting/:code/ended.
    closeInstantMeetingSession()
    clearGlobalSession()
    navigateApp(coWorkRoutes.meetingEnded(meeting.meeting_code))
  }, [markEnded, meeting.meeting_code])

  const disconnectMedia = useCallback(async () => {
    if (session.hasMedia()) {
      await session.disconnect()
      return
    }
    if (!callMedia) return
    try {
      if (callMedia.screenSharing) {
        await Promise.resolve(callMedia.toggleScreenShare())
      }
    } catch {
      // Best-effort stop of local screen share before teardown.
    }
    try {
      callMedia.disconnect()
    } catch {
      // Room may already be tearing down.
    }
  }, [callMedia, session])

  const runLeave = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    void (async () => {
      try {
        if (isAuthoritativeHost && recordingSession.recording) {
          await withTimeout(recordingSession.stopRecording(), 4000)
        }
        await disconnectMedia()
        await withTimeout(presence.leave(), 4000)
      } finally {
        const outcome = hostLeaveConfirmCopy({
          behavior: presence.moderationSettings?.host_leave_behavior,
          participants: presence.participants,
          hostUserId: userId,
        })
        if (isAuthoritativeHost && outcome.willEndMeeting) {
          exitToMeetingEnded()
        } else {
          exitToCoWork()
        }
      }
    })()
  }, [
    disconnectMedia,
    exitToCoWork,
    exitToMeetingEnded,
    isAuthoritativeHost,
    presence,
    recordingSession,
    userId,
  ])

  const runEndForEveryone = useCallback(() => {
    if (!isAuthoritativeHost || exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    void (async () => {
      try {
        if (recordingSession.recording) {
          await withTimeout(recordingSession.stopRecording(), 4000)
        }
        await disconnectMedia()
        await withTimeout(presence.hostEnd(), 4000)
      } finally {
        exitToMeetingEnded()
      }
    })()
  }, [
    disconnectMedia,
    exitToMeetingEnded,
    isAuthoritativeHost,
    presence,
    recordingSession,
  ])

  const handleLeave = useCallback(() => {
    if (exitingRef.current) return
    if (!isAuthoritativeHost) {
      runLeave()
      return
    }
    const copy = hostLeaveConfirmCopy({
      behavior: presence.moderationSettings?.host_leave_behavior,
      participants: presence.participants,
      hostUserId: userId,
    })
    confirmMeetingAction({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
      cancelLabel: copy.cancelLabel,
      destructive: copy.willEndMeeting,
      onConfirm: runLeave,
    })
  }, [
    isAuthoritativeHost,
    presence.moderationSettings?.host_leave_behavior,
    presence.participants,
    runLeave,
    userId,
  ])

  const keyboardHandlers = useMemo(
    () => ({
      toggle_mute: () => toggleMeetingAudio(),
      toggle_video: () => {
        if (!callMedia) return
        void presence.syncMediaState({ is_video_off: callMedia.videoEnabled })
        callMedia.toggleVideo()
      },
      toggle_share: () => {
        void toggleScreenShare()
      },
      toggle_participants: () => presence.togglePanel('people'),
      toggle_chat: () => presence.togglePanel('chat'),
      toggle_hand: () => toggleHand(),
      toggle_reactions: () => setReactionTrayOpen((open) => !open),
      toggle_captions: () => toggleCaptions(),
      toggle_whiteboard: () => {
        if (!presence.whiteboard.active) {
          setWhiteboardHidden(false)
          presence.openWhiteboard()
          return
        }
        setWhiteboardHidden((hidden) => !hidden)
      },
      toggle_gallery: () => {
        dispatchUi({
          type: 'SET_VIEW',
          viewMode: meetingMachine.viewMode === 'speaker' ? 'gallery' : 'speaker',
        })
      },
      toggle_record: () => toggleRecording(),
      leave: () => handleLeave(),
      show_shortcuts: () => setShortcutsOpen(true),
    }),
    [
      dispatchUi,
      handleLeave,
      callMedia,
      meetingMachine.viewMode,
      presence,
      toggleCaptions,
      toggleHand,
      toggleMeetingAudio,
      toggleRecording,
      toggleScreenShare,
    ],
  )
  useMeetingKeyboardShortcuts(Platform.OS === 'web' && !exiting, keyboardHandlers)

  useRegisterGlobalSession({
    // Register as soon as the live room mounts — not only after the SFU connects —
    // so Minimize always has a global session to collapse into the mini-player.
    active: !exiting,
    kind: 'meeting',
    code: meeting.meeting_code,
    title: meeting.title || 'Meeting',
    subtitle: formatMeetingCode(meeting.meeting_code),
    maximizeHref: String(coWorkRoutes.meetingLive(meeting.meeting_code)),
    avatarUrl: avatarUrl ?? meeting.host?.avatar_url ?? null,
    participantCount: admittedCount,
    media: {
      audioEnabled: callMedia?.audioEnabled ?? true,
      videoEnabled: callMedia?.videoEnabled ?? false,
      screenSharing: callMedia?.screenSharing ?? false,
      speakerOn: callMedia?.speakerOn ?? true,
    },
    activeTrackRef: activeVideoTrack,
    handlers: {
      toggleMic: () => {
        if (session.hasMedia()) session.toggleMic()
        else callMedia?.toggleAudio()
      },
      toggleCamera: () => {
        if (session.hasMedia()) session.toggleCamera()
        else callMedia?.toggleVideo()
      },
      toggleSpeaker: () => {
        void callMedia?.toggleSpeaker()
      },
      end: () => {
        handleLeave()
      },
      browseAway: () => {
        collapseMeetingForBrowse()
      },
      enterPip: async () => {
        enterMeetingPip()
      },
    },
  })

  useSessionPipOnHide(!exiting && !callMedia?.screenSharing)

  const handleEnd = useCallback(() => {
    if (!isAuthoritativeHost || exitingRef.current) return
    const copy = endMeetingConfirmCopy()
    confirmMeetingAction({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
      cancelLabel: copy.cancelLabel,
      destructive: true,
      onConfirm: runEndForEveryone,
    })
  }, [isAuthoritativeHost, runEndForEveryone])

  const handleMuteAll = useCallback(() => {
    if (!isAuthoritativeHost) return
    confirmMeetingAction({
      title: 'Mute all participants?',
      message: 'This never turns anyone’s microphone on — only requests mute.',
      confirmLabel: 'Mute all',
      destructive: true,
      onConfirm: () => {
        void presence
          .muteAll()
          .then(() =>
            toast.show('Participants muted', {
              tone: 'success',
              message: 'This never enables anyone’s microphone.',
            }),
          )
          .catch((cause) =>
            toast.show('Could not mute participants', {
              tone: 'danger',
              message: cause instanceof Error ? cause.message : 'Please try again.',
            }),
          )
      },
    })
  }, [isAuthoritativeHost, presence, toast])

  const handleRemoveAllExceptHost = useCallback(() => {
    if (!isAuthoritativeHost) return
    confirmMeetingAction({
      title: 'Remove everyone except host?',
      message: 'All other participants will be removed from this meeting.',
      confirmLabel: 'Remove all',
      destructive: true,
      onConfirm: () => {
        void presence.removeAllExceptHost()
      },
    })
  }, [isAuthoritativeHost, presence])

  const handleToggleLock = useCallback(() => {
    if (!isAuthoritativeHost) return
    const nextLocked = !presence.moderationSettings?.is_locked
    void presence
      .setLocked(nextLocked)
      .then(() =>
        toast.show(nextLocked ? 'Meeting locked' : 'Meeting unlocked', {
          tone: 'success',
          message: nextLocked
            ? 'New participants cannot join until you unlock.'
            : 'New participants can join again.',
        }),
      )
      .catch((cause) =>
        toast.show(nextLocked ? 'Could not lock meeting' : 'Could not unlock meeting', {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'Please try again.',
        }),
      )
  }, [isAuthoritativeHost, presence, toast])

  const patchLiveSecurity = useCallback(
    async (
      patch: Partial<NonNullable<Meeting['security_settings']>>,
      successMessage: string,
    ) => {
      if (!isAuthoritativeHost) {
        toast.show('Only the host can change security settings', { tone: 'info' })
        return
      }
      try {
        const next = await updateMeetingLiveSettings(meeting.id, { securitySettings: patch })
        setMeetingState(next)
        toast.show(successMessage, { tone: 'success' })
      } catch (cause) {
        toast.show('Could not update security', {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'Please try again.',
        })
      }
    },
    [isAuthoritativeHost, meeting.id, toast],
  )

  const handleToggleWaitingRoom = useCallback(() => {
    const next = meetingState.security_settings?.waitingRoom === false
    void patchLiveSecurity(
      { waitingRoom: next },
      next ? 'Waiting room enabled' : 'Waiting room disabled',
    )
  }, [meetingState.security_settings?.waitingRoom, patchLiveSecurity])

  const handleToggleMuteOnJoin = useCallback(() => {
    const next = !meetingState.security_settings?.muteOnJoin
    void patchLiveSecurity(
      { muteOnJoin: next },
      next ? 'Mute on entry enabled' : 'Mute on entry disabled',
    )
  }, [meetingState.security_settings?.muteOnJoin, patchLiveSecurity])

  const handleToggleVideoOffOnJoin = useCallback(() => {
    const next = !meetingState.security_settings?.videoOffOnJoin
    void patchLiveSecurity(
      { videoOffOnJoin: next },
      next ? 'Video off on entry enabled' : 'Video off on entry disabled',
    )
  }, [meetingState.security_settings?.videoOffOnJoin, patchLiveSecurity])

  const confirmRemoveParticipant = useCallback(
    (participantId: string) => {
      confirmMeetingAction({
        title: 'Remove participant?',
        message: 'They will be disconnected and cannot rejoin until you allow them.',
        confirmLabel: 'Remove',
        destructive: true,
        onConfirm: () => {
          void presence
            .remove(participantId)
            .then(() => toast.show('Participant removed', { tone: 'success' }))
            .catch((cause) =>
              toast.show('Could not remove participant', {
                tone: 'danger',
                message: cause instanceof Error ? cause.message : 'Please try again.',
              }),
            )
        },
      })
    },
    [presence, toast],
  )

  const confirmPutInWaitingRoom = useCallback(
    (participantId: string) => {
      confirmMeetingAction({
        title: 'Put in waiting room?',
        message: 'They will leave the meeting and wait until you admit them again.',
        confirmLabel: 'Put in waiting room',
        destructive: false,
        onConfirm: () => {
          void presence
            .putInWaitingRoom(participantId)
            .then(() => toast.show('Sent to waiting room', { tone: 'success' }))
            .catch((cause) =>
              toast.show('Could not update participant', {
                tone: 'danger',
                message: cause instanceof Error ? cause.message : 'Please try again.',
              }),
            )
        },
      })
    },
    [presence, toast],
  )

  const keyboardHeight = useKeyboardBottomInset()
  const panelTop = layout.panelTop
  // Meeting routes are chromeless (no app tab bar). Clear home indicator via layout.
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const controlsBottom = Math.max(safeBottom, 0)
  // Side panels sit under the toolbar's z-index, so they must clear its real height
  // (the invite card makes it taller than layout.panelBottom) or the composer is untappable.
  const panelBottom = Math.max(
    layout.panelBottom,
    keyboardHeight,
    layout.panelPresentation === 'side' && toolbarHeight > 0
      ? controlsBottom + toolbarHeight + 8
      : 0,
  )
  const overlayPosition = Platform.OS === 'web' ? ('fixed' as const) : ('absolute' as const)

  return (
    <YStack
      position={overlayPosition}
      top={0}
      left={0}
      right={0}
      bottom={0}
      width="100%"
      height="100%"
      pointerEvents="box-none"
      zIndex={100}
    >
      {!sheetPanelOpen && !stageHandlesTaps ? (
        <YStack
          position={overlayPosition}
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={15}
          pointerEvents="auto"
          onPress={toggleControls}
          accessibilityRole="button"
          accessibilityLabel={controlsVisible ? 'Hide meeting controls' : 'Show meeting controls'}
        />
      ) : null}

      <YStack
        position={overlayPosition}
        top={0}
        left={0}
        right={0}
        zIndex={20}
        pointerEvents={controlsVisible ? 'auto' : 'none'}
        opacity={controlsVisible ? 1 : 0}
        style={{
          transform: [{ translateY: controlsVisible ? 0 : -24 }],
          ...(Platform.OS === 'web' ? { transition: 'opacity 0.22s ease, transform 0.22s ease' } : {}),
        }}
      >
        <MeetingHeader
          compact={layout.compactControls}
          safeTop={safeTop}
          safeLeft={safeLeft}
          safeRight={safeRight}
          title={presence.liveTopic || title}
          locked={!!presence.moderationSettings?.is_locked}
          recording={recording}
          speakerOn={callMedia?.speakerOn ?? true}
          onBack={() => minimizeMeeting()}
          onMinimize={() => minimizeMeeting()}
          // Zoom-style: header chevron / minimize → floating bubble.
          // Browser full screen stays in More (onToggleFullscreen), not here —
          // Maximize2 in the header was confused with bubble Maximize.
          onToggleFullscreen={toggleFullscreen}
          fullscreenActive={fullscreen.active}
          onMeetingInfo={() => presence.setPanel('info')}
          onTile={enterMeetingPip}
          onEffects={() => presence.togglePanel('backgrounds')}
          onWhiteboard={() => {
            if (!presence.whiteboard.active) {
              presence.openWhiteboard()
              setWhiteboardHidden(false)
            } else {
              setWhiteboardHidden((v) => !v)
            }
          }}
          onAnnotate={() => {
            setAnnotateShareOpen((open) => {
              const next = !open
              presence.setAnnotationSessionOpen(next)
              return next
            })
          }}
          onToggleSpeaker={
            callMedia
              ? () => {
                  void (async () => {
                    const wasOn = callMedia.speakerOn
                    await callMedia.toggleSpeaker()
                    toast.show(wasOn ? 'Loudspeaker off' : 'Loudspeaker on', {
                      tone: 'info',
                      message: wasOn
                        ? 'Audio uses a connected Bluetooth speaker, headset, or the phone.'
                        : 'Audio plays through the built-in speaker.',
                    })
                  })()
                }
              : undefined
          }
          onFlipCamera={
            callMedia
              ? () => {
                  void (async () => {
                    try {
                      const facing = await callMedia.flipCamera()
                      toast.show(facing === 'environment' ? 'Rear camera' : 'Front camera', {
                        tone: 'info',
                      })
                    } catch (cause) {
                      toast.show('Could not flip camera', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Try again in a moment.',
                      })
                    }
                  })()
                }
              : undefined
          }
          onSettings={() => {
            // Header gear → Zoom meeting settings / host security.
            if (canModerate) presence.togglePanel('host_tools')
            else presence.togglePanel('audio')
          }}
          onSecurity={() => {
            if (canModerate) presence.togglePanel('host_tools')
            else presence.setPanel('info')
          }}
          onEnd={isAuthoritativeHost ? handleEnd : handleLeave}
          isHost={isAuthoritativeHost}
        />

        {/* Zoom Mobile Top-Left Green Shield (Image 1 & Image 3) */}
        {layout.compactControls && (controlsVisible || sheetPanelOpen) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Meeting security and encryption info"
            hitSlop={8}
            onPress={() => presence.setPanel('info')}
            style={({ pressed }) => ({
              position: 'absolute',
              top: Math.max(safeTop, 8) + 52,
              left: Math.max(safeLeft, 14),
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: pressed ? 'rgba(18, 36, 26, 0.95)' : 'rgba(18, 36, 26, 0.85)',
              borderWidth: 1,
              borderColor: 'rgba(34, 197, 94, 0.4)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 35,
            })}
          >
            <Icons.ShieldCheck size={18} color="#22C55E" />
          </Pressable>
        ) : null}

        <MeetingRecordingConsentBanner
          recording={recording}
          isHost={isAuthoritativeHost}
          onLeave={() => void handleLeave()}
          leadingInset={
            layout.compactControls && (controlsVisible || sheetPanelOpen)
              ? Math.max(safeLeft, 14) + 30 - 4
              : 0
          }
        />
        <MeetingSpeakingWhileMutedBanner
          visible={shouldShowSpeakingWhileMuted({
            muted: !(session.getMediaSnapshot()?.audioEnabled ?? callMedia?.audioEnabled ?? true),
            inputLevel: callMedia?.audioQuality?.inputLevel ?? 0,
            enabled: !exiting && !presence.isWaiting,
          })}
          topOffset={Math.max(safeTop, 8) + (controlsVisible ? 56 : 12)}
          onUnmute={() => toggleMeetingAudio()}
        />
        <MeetingAskToUnmuteBanner
          visible={
            askToUnmuteVisible &&
            !(session.getMediaSnapshot()?.audioEnabled ?? callMedia?.audioEnabled ?? true)
          }
          topOffset={Math.max(safeTop, 8) + (controlsVisible ? 56 : 12) + 64}
          onUnmute={() => {
            setAskToUnmuteVisible(false)
            toggleMeetingAudio()
          }}
          onDismiss={() => setAskToUnmuteVisible(false)}
        />

        {presence.breakoutBroadcast ? (
          <CoWorkAlertBanner
            tone="warning"
            message={`Breakout broadcast: ${presence.breakoutBroadcast.message}`}
          />
        ) : null}

        {presence.breakoutEndsAt && presence.breakoutEndsAt > Date.now() ? (
          <CoWorkAlertBanner
            tone="warning"
            message={`Breakouts end in ${Math.max(1, Math.ceil((presence.breakoutEndsAt - Date.now()) / 60_000))} min — return to the main room when ready.`}
          />
        ) : null}

        {presence.webinarMode ? (
          <CoWorkAlertBanner
            tone="warning"
            message="Webinar mode is on — attendees stay muted unless the host asks them to unmute."
          />
        ) : null}

        {(() => {
          const reconnecting = callMedia?.audioQuality.connectionStatus === 'reconnecting'
          const audioError = callMedia?.audioQuality.error
          const effectsError = callMedia?.videoEffects.error
          const presenceError = showError ? presence.error : null
          if (reconnecting) {
            return (
              <CoWorkAlertBanner
                tone="warning"
                message="Network hiccup — restoring audio automatically."
                actionLabel="Reconnect"
                onAction={() => {
                  void callMedia?.audioQuality.retryConnection()
                  onRemountMedia?.()
                }}
              />
            )
          }
          if (effectsError) {
            return (
              <CoWorkAlertBanner
                tone="warning"
                message={effectsError}
                actionLabel="Retry"
                onAction={() => void callMedia?.videoEffects.retry()}
              />
            )
          }
          if (audioError) {
            return (
              <CoWorkAlertBanner
                tone="danger"
                message={audioError}
                actionLabel="Audio settings"
                onAction={() => presence.setPanel('audio')}
              />
            )
          }
          if (presenceError) {
            const isEdgeFn = /non-2xx|Edge Function/i.test(presenceError)
            return (
              <CoWorkAlertBanner
                tone="danger"
                message={
                  isEdgeFn
                    ? 'Could not complete a meeting request. Tap Try again, or leave and rejoin.'
                    : presenceError
                }
                actionLabel={isEdgeFn ? 'Try again' : 'Dismiss'}
                onAction={() => {
                  if (isEdgeFn) {
                    void presence.retryRealtime()
                    void presence.retryJoinRequest()
                    return
                  }
                  setDismissedError(presence.error)
                }}
              />
            )
          }
          // Prefer a single banner — skip the realtime chip while a stronger error is up.
          if (presence.realtimeDegraded && !presenceError && !audioError) {
            return (
              <CoWorkAlertBanner
                tone="warning"
                message="Live updates paused — chat and participants refresh every few seconds."
                actionLabel="Reconnect"
                onAction={() => presence.retryRealtime()}
              />
            )
          }
          return null
        })()}
        {canModerate && presence.waitingParticipants.length > 0 ? (
          <MeetingWaitingRoomRequests
            participants={presence.waitingParticipants}
            onAdmit={presence.admit}
            onReject={presence.reject}
            onAdmitAll={presence.admitAllWaiting}
            onReview={() => presence.setPanel('people')}
          />
        ) : null}
      </YStack>

      <MeetingResponsivePanel
        open={!!callMedia && presence.panel === 'audio'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        {callMedia ? (
          <MeetingAudioPanel
            audio={callMedia.audioQuality}
            audioEnabled={callMedia.audioEnabled}
            speakerOn={callMedia.speakerOn}
            onToggleAudio={toggleMeetingAudio}
            onToggleSpeaker={() => void callMedia.toggleSpeaker()}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        ) : null}
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={!!callMedia && presence.panel === 'backgrounds'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        {callMedia ? (
          <MeetingBackgroundPanel
            userId={userId}
            effects={callMedia.videoEffects}
            cameraEnabled={callMedia.videoEnabled}
            onEnsureCamera={() => {
              if (callMedia.videoEnabled) return
              if (!allowSelfStartVideo && !canModerate) {
                toast.show('The host disabled starting video', { tone: 'info' })
                return
              }
              void presence.syncMediaState({ is_video_off: false })
              callMedia.toggleVideo()
            }}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        ) : null}
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'chat'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
        sheetHeightPercent={88}
      >
        <MeetingChatPanel
          messages={presence.chatMessages}
          participants={liveParticipants}
          currentUserId={userId}
          viewerRole={presence.selfRole}
          participantDisplayNames={participantDisplayNames}
          meetingId={meeting.id}
          chatEnabled={chatEnabled}
          privateChatEnabled={privateChatEnabled}
          participantChatWith={meetingState.security_settings?.participantChatWith}
          canManageChat={canModerate}
          onSend={(text, audience, recipientId) =>
            void presence.sendChat(text, audience, recipientId).catch((cause: unknown) => {
              toast.show('Message not sent', {
                tone: 'danger',
                message: cause instanceof Error ? cause.message : 'Check your connection and try again.',
              })
            })
          }
          onDelete={canModerate || chatEnabled ? (id) => void presence.deleteChat(id) : undefined}
          onClose={() => presence.setPanel('none')}
          onSendAttachment={(source, audience, recipientId) =>
            presence.sendChatAttachment(source, audience, recipientId)
          }
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'people'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingParticipantsPanel
          participants={liveParticipants}
          speakingUserIds={speakingUserIds}
          isHost={isAuthoritativeHost}
          viewerRole={isAuthoritativeHost ? 'host' : presence.selfRole}
          currentUserId={userId}
          isLocked={presence.moderationSettings?.is_locked}
          onAdmit={(id) => void presence.admit(id)}
          onReject={canModerate ? (id) => void presence.reject(id) : undefined}
          onAdmitAll={canModerate ? () => void presence.admitAllWaiting() : undefined}
          onRemove={canModerate ? confirmRemoveParticipant : undefined}
          onPutInWaitingRoom={canModerate ? confirmPutInWaitingRoom : undefined}
          onAllowRejoin={
            canModerate
              ? (id) =>
                  void presence
                    .allowRejoin(id)
                    .then(() => toast.show('Participant may request to rejoin', { tone: 'success' }))
              : undefined
          }
          onForceMute={
            canModerate
              ? (id) =>
                  void presence
                    .forceMute(id)
                    .then(() => toast.show('Participant muted', { tone: 'success' }))
                    .catch((cause) =>
                      toast.show('Could not mute participant', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
              : undefined
          }
          onAskToUnmute={
            canModerate
              ? (id) =>
                  void presence
                    .askToUnmute(id)
                    .then(() => toast.show('Asked participant to unmute', { tone: 'info' }))
                    .catch((cause) =>
                      toast.show('Could not send unmute request', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
              : undefined
          }
          onRequestMute={canModerate ? (id) => void presence.requestMute(id) : undefined}
          onLowerHand={
            canModerate
              ? (id) => {
                  presence.lowerHandFor(id)
                  toast.show('Hand lowered', { tone: 'success' })
                }
              : undefined
          }
          onStopVideo={
            canModerate
              ? (id) =>
                  void presence
                    .stopVideo(id)
                    .then(() => toast.show('Asked to stop video', { tone: 'success' }))
                    .catch((cause) =>
                      toast.show('Could not stop video', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
              : undefined
          }
          onAssignCoHost={
            isAuthoritativeHost
              ? (id) => {
                  const target = presence.participants.find((row) => row.user_id === id)
                  const name =
                    target?.display_name ||
                    target?.profile?.full_name ||
                    target?.profile?.username ||
                    'Participant'
                  void presence
                    .assignCoHost(id)
                    .then(() =>
                      toast.show(`${name} is now a co-host`, {
                        tone: 'success',
                        message: 'They can help manage participants and the waiting room.',
                      }),
                    )
                    .catch((cause) =>
                      toast.show('Could not assign co-host', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
                }
              : undefined
          }
          onRemoveCoHost={
            isAuthoritativeHost
              ? (id) =>
                  void presence
                    .removeCoHost(id)
                    .then(() => toast.show('Co-host removed', { tone: 'success' }))
                    .catch((cause) =>
                      toast.show('Could not remove co-host', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
              : undefined
          }
          onTransferHost={
            isAuthoritativeHost
              ? (id) =>
                  void presence
                    .transferHost(id)
                    .then(() =>
                      toast.show('Host transferred', {
                        tone: 'success',
                        message: 'You are now a co-host of this meeting.',
                      }),
                    )
                    .catch((cause) =>
                      toast.show('Could not transfer host', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
              : undefined
          }
          onOpenTransferHost={
            isAuthoritativeHost ? () => setTransferHostOpen(true) : undefined
          }
          onToggleLock={isAuthoritativeHost ? handleToggleLock : undefined}
          onMuteAll={isAuthoritativeHost ? handleMuteAll : undefined}
          onAskAllToUnmute={
            canModerate
              ? () =>
                  void presence
                    .askAllToUnmute()
                    .then(() => toast.show('Asked everyone to unmute', { tone: 'info' }))
              : undefined
          }
          onAskAllToMute={canModerate ? () => void presence.askAllToMute() : undefined}
          onRemoveAllExceptHost={isAuthoritativeHost ? handleRemoveAllExceptHost : undefined}
          onClose={() => presence.setPanel('none')}
          onInvite={() => presence.setPanel('invite')}
          raisedHands={presence.raisedHands}
          fullWidth={panelFullWidth}
          spotlightUserId={presence.spotlightUserId}
          onSetSpotlight={canModerate ? (id) => presence.setSpotlight(id) : undefined}
          pinnedUserIds={pinnedUserIds}
          onTogglePin={togglePinnedUserId}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'host_tools'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingHostToolsPanel
          meeting={meetingState}
          viewerRole={isAuthoritativeHost ? 'host' : presence.selfRole}
          isLocked={!!presence.moderationSettings?.is_locked}
          captionsActive={captions.active}
          onClose={() => presence.setPanel('none')}
          onMeetingUpdated={setMeetingState}
          onToggleLock={isAuthoritativeHost ? handleToggleLock : undefined}
          onOpenParticipants={() => presence.setPanel('people')}
          onOpenInfo={() => presence.setPanel('info')}
          onTransferHostPress={
            isAuthoritativeHost ? () => setTransferHostOpen(true) : undefined
          }
          onToggleCaptions={toggleCaptions}
          onOpenPolls={() => presence.setPanel('polls')}
          onOpenQa={() => presence.setPanel('qna')}
          onOpenBreakouts={() => presence.setPanel('breakouts')}
          onOpenNotes={() => presence.setPanel('notes')}
          onSaveTranscript={() => {
            void (async () => {
              const {
                buildMeetingTranscriptArchive,
                saveMeetingTranscriptArchive,
                transcriptArchiveToPlainText,
                copyMeetingTranscriptText,
                downloadMeetingTranscriptText,
              } = await import('~/co-work/lib/meeting-transcript-archive')
              const entry = buildMeetingTranscriptArchive(meeting.id, presence.liveCaptions)
              await saveMeetingTranscriptArchive(entry)
              const text = transcriptArchiveToPlainText(entry)
              if (!entry.lines.length) {
                toast.show('No caption lines yet', { tone: 'info' })
                return
              }
              const copied = await copyMeetingTranscriptText(text)
              const downloaded = downloadMeetingTranscriptText({
                meetingId: meeting.id,
                text,
              })
              toast.show(`Saved ${entry.lines.length} transcript lines`, {
                tone: 'success',
                message: [
                  copied ? 'Copied to clipboard' : null,
                  downloaded ? 'Download started' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              })
            })().catch((cause) =>
              toast.show('Could not save transcript', {
                tone: 'danger',
                message: cause instanceof Error ? cause.message : undefined,
              }),
            )
          }}
          onSummarizeMeeting={() => {
            void (async () => {
              const {
                buildMeetingTranscriptArchive,
                transcriptArchiveToPlainText,
              } = await import('~/co-work/lib/meeting-transcript-archive')
              const { summarizeMeetingTranscript } = await import('~/co-work/lib/meeting-ai-summary')
              const entry = buildMeetingTranscriptArchive(meeting.id, presence.liveCaptions)
              const summary = await summarizeMeetingTranscript({
                meetingTitle: meetingState.title,
                transcript: transcriptArchiveToPlainText(entry),
              })
              toast.show('AI summary ready', { tone: 'success', message: summary.slice(0, 280) })
            })().catch((cause) =>
              toast.show('Could not summarize meeting', {
                tone: 'danger',
                message: cause instanceof Error ? cause.message : undefined,
              }),
            )
          }}
          onMuteAll={isAuthoritativeHost ? handleMuteAll : undefined}
          onAskAllToMute={canModerate ? () => void presence.askAllToMute() : undefined}
          onLowerAllHands={
            canModerate
              ? () => {
                  presence.lowerAllHands()
                }
              : undefined
          }
          onClearAllFeedback={
            canModerate
              ? () => {
                  presence.clearAllFeedback()
                }
              : undefined
          }
          onRenameTopic={
            isAuthoritativeHost
              ? (nextTitle) => {
                  presence.setMeetingTopicLive(nextTitle)
                  setMeetingState((current) => ({ ...current, title: nextTitle }))
                  void updateMeetingTitle(meeting.id, nextTitle).catch((cause) =>
                    toast.show('Could not save title', {
                      tone: 'danger',
                      message: cause instanceof Error ? cause.message : 'Please try again.',
                    }),
                  )
                }
              : undefined
          }
          onMuteOnJoinEnabled={
            isAuthoritativeHost
              ? () => {
                  void presence.muteAll()
                  toast.show('Muted everyone for mute-on-entry', { tone: 'info' })
                }
              : undefined
          }
          webinarMode={presence.webinarMode}
          onToggleWebinarMode={(enabled) => {
            presence.setWebinarModeLive(enabled)
            toast.show(enabled ? 'Webinar mode on' : 'Meeting mode on', { tone: 'info' })
          }}
          interpretationChannelId={presence.interpretationChannelId ?? 'floor'}
          onInterpretationChannelChange={(channelId) => {
            presence.setInterpretationChannelLive(channelId)
            toast.show(`Listening to ${channelId === 'floor' ? 'floor' : channelId}`, {
              tone: 'info',
            })
          }}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'notes'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingHostNotesPanel
          meetingId={meeting.id}
          userId={userId}
          onClose={() => presence.setPanel('none')}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'polls'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingPollsPanel
          meetingId={meeting.id}
          userId={userId}
          canModerate={canModerate}
          onClose={() => presence.setPanel('none')}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'qna'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingQaPanel
          meetingId={meeting.id}
          userId={userId}
          canModerate={canModerate}
          onClose={() => presence.setPanel('none')}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'breakouts'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingBreakoutPanel
          meetingId={meeting.id}
          userId={userId}
          meetingRoomId={meeting.room_id ?? meeting.id}
          participants={liveParticipants
            .filter((row) => row.status === 'admitted')
            .map((row) => ({
              user_id: row.user_id,
              display_name:
                row.display_name || row.profile?.full_name || row.profile?.username || undefined,
            }))}
          canModerate={canModerate}
          onClose={() => presence.setPanel('none')}
          onJoinBreakoutRoom={(roomName) => onJoinBreakoutRoom?.(roomName)}
          onBroadcastToBreakouts={(message) => {
            presence.broadcastToBreakouts(message)
            toast.show('Breakout broadcast sent', { tone: 'success' })
          }}
          onBreakoutTimerSet={(endsAt) => {
            presence.setBreakoutTimer(endsAt)
          }}
          onOpenBreakouts={async () => {
            const { fetchMeetingBreakouts } = await import('~/co-work/lib/meeting-breakouts')
            const rooms = await fetchMeetingBreakouts(meeting.id)
            const mine = rooms.find((room) => room.assigneeIds.includes(userId) && room.livekit_room_name)
            if (mine?.livekit_room_name) onJoinBreakoutRoom?.(mine.livekit_room_name)
            toast.show('Breakout rooms opened', {
              tone: 'info',
              message: mine
                ? 'Joining your assigned breakout…'
                : 'Open Breakouts and join your room when ready.',
            })
          }}
          onCloseBreakouts={() => {
            onLeaveBreakoutRoom?.()
            toast.show('Returned to the main meeting', { tone: 'success' })
          }}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={presence.panel === 'info'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingInfoPanel
          meeting={meetingState}
          participantCount={admittedCount}
          isHost={isAuthoritativeHost}
          onClose={() => presence.setPanel('none')}
          onInvite={
            canModerate
              ? () => {
                  presence.setPanel('invite')
                }
              : undefined
          }
          onOpenRecordings={
            isAuthoritativeHost && allowRecording
              ? () => {
                  presence.setPanel('recordings')
                }
              : undefined
          }
          fullWidth={panelFullWidth}
          mirrorLocalVideo={meetingMachine.mirrorLocalVideo}
          onMirrorLocalVideoChange={(enabled) =>
            dispatchUi({ type: 'SET_MIRROR_LOCAL_VIDEO', enabled })
          }
          hostLeaveBehavior={presence.moderationSettings?.host_leave_behavior}
          onHostLeaveBehaviorChange={
            isAuthoritativeHost
              ? (behavior) => {
                  void presence
                    .setHostLeaveBehavior(behavior)
                    .then(() =>
                      toast.show(
                        behavior === 'transfer_to_co_host'
                          ? 'Host leave will transfer the meeting'
                          : 'Host leave will end the meeting',
                        { tone: 'success' },
                      ),
                    )
                    .catch((cause) =>
                      toast.show('Could not update host leave setting', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : 'Please try again.',
                      }),
                    )
                }
              : undefined
          }
          onTransferHostPress={
            isAuthoritativeHost ? () => setTransferHostOpen(true) : undefined
          }
          onOpenParticipants={
            isAuthoritativeHost
              ? () => {
                  presence.setPanel('people')
                }
              : undefined
          }
          onRenameTopic={
            isAuthoritativeHost
              ? (nextTitle) => {
                  presence.setMeetingTopicLive(nextTitle)
                  setMeetingState((current) => ({ ...current, title: nextTitle }))
                  void updateMeetingTitle(meeting.id, nextTitle).catch((cause) =>
                    toast.show('Could not save title', {
                      tone: 'danger',
                      message: cause instanceof Error ? cause.message : 'Please try again.',
                    }),
                  )
                }
              : undefined
          }
          onEditSchedule={
            isAuthoritativeHost &&
            meetingState.status !== 'ended' &&
            meetingState.status !== 'cancelled'
              ? () => {
                  navigateApp(coWorkRoutes.scheduleEdit(meetingState.id))
                }
              : undefined
          }
          isLocked={!!presence.moderationSettings?.is_locked}
          onToggleLock={isAuthoritativeHost ? handleToggleLock : undefined}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={isAuthoritativeHost && presence.panel === 'recordings'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingRecordingsPanel
          meetingId={meeting.id}
          meetingTitle={title}
          isHost={isAuthoritativeHost}
          onClose={() => presence.setPanel('none')}
          fullWidth={panelFullWidth}
        />
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={canModerate && presence.panel === 'invite'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        <MeetingInvitePanel
          meeting={meetingState}
          hostId={meetingState.host_id}
          hostName={displayName}
          onClose={() => presence.setPanel('none')}
          fullWidth={panelFullWidth}
          onInviteesUpdated={(invitees) => setMeetingState((current) => ({ ...current, invitees }))}
        />
      </MeetingResponsivePanel>

      <MeetingLiveCaptions
        active={captions.active}
        currentCaption={captions.currentCaption}
        liveSpeaker={captions.liveCaptionSpeaker}
        lines={captions.visibleLines}
        error={captions.error}
        micMuted={liveMuted === true}
        targetLang={captions.targetLang}
        targetLangName={captions.targetLangName}
        spokenLang={captions.spokenLang}
        spokenLangName={captions.spokenLangName}
        showingTranslation={captions.showingTranslation}
        availableLanguages={captions.availableLanguages}
        collapsed={captions.captionPreferences.collapsed}
        size={captions.captionPreferences.size}
        placement={captions.captionPreferences.placement}
        offsetX={captions.captionPreferences.offsetX}
        offsetY={captions.captionPreferences.offsetY}
        presentationSafe={
          meetingMachine.viewMode === 'screen-share' || !!callMedia?.screenSharing
        }
        wideLayout={layout.captionWideLayout}
        topOffset={layout.captionTopOffset}
        bottomOffset={layout.captionBottomOffset}
        sideInset={layout.captionSideInset}
        trailingInset={stageTrailingInsetValue}
        onTargetLangChange={(language) => {
          captions.setTargetLang(language)
        }}
        onSpokenLangChange={(language) => {
          captions.setSpokenLang(language)
        }}
        onCollapsedChange={captions.setCollapsed}
        onSizeChange={captions.setOverlaySize}
        onPlacementChange={captions.setPlacement}
        onOffsetChange={captions.setOverlayOffset}
      />

      {presence.contentShare && contentHiddenId !== presence.contentShare.id ? (
        <MeetingContentShareStage
          share={presence.contentShare}
          receivedAt={presence.contentShareReceivedAt}
          isPresenter={presentingContent}
          top={layout.stagePaddingTop}
          bottom={layout.stagePaddingBottom}
          left={Math.max(safeLeft, 0)}
          right={Math.max(safeRight, 0) + stageTrailingInsetValue}
          onUpdate={presence.updateContentShare}
          onStop={stopContentShare}
          onHide={() => setContentHiddenId(presence.contentShare?.id ?? null)}
          onToggleControls={toggleControls}
        />
      ) : null}
      {presence.contentShare && contentHiddenId === presence.contentShare.id ? (
        <ContentSharePill
          top={layout.stagePaddingTop + 8}
          label={`View ${presence.contentShare.presenterName || 'shared'}’s content`}
          onPress={() => setContentHiddenId(null)}
        />
      ) : null}
      {contentUploadLabel ? <ContentSharePill top={layout.stagePaddingTop + 8} label={contentUploadLabel} busy /> : null}

      <MeetingReactionsOverlay
        reactions={presence.floatingReactions}
        onExpire={presence.expireFloatingReaction}
      />

      <YStack
        position={overlayPosition}
        bottom={controlsBottom}
        left={0}
        right={0}
        paddingLeft={Math.max(safeLeft, 0)}
        paddingRight={Math.max(safeRight, 0)}
        zIndex={MEETING_TOOLBAR_Z_INDEX}
        onLayout={(event) => {
          const height = Math.round(event.nativeEvent.layout.height)
          if (height > 0 && height !== toolbarHeight) setToolbarHeight(height)
        }}
        pointerEvents={
          (controlsVisible || roomModalOpen) && !sheetPanelOpen
            ? layout.compactControls
              ? 'auto'
              : 'box-none'
            : 'none'
        }
        opacity={(controlsVisible || roomModalOpen) && !sheetPanelOpen ? 1 : 0}
        style={{
          transform: [{ translateY: (controlsVisible || roomModalOpen) && !sheetPanelOpen ? 0 : 40 }],
          ...(Platform.OS === 'web' ? { transition: 'opacity 0.22s ease, transform 0.22s ease' } : {}),
          ...((controlsVisible || roomModalOpen) && !sheetPanelOpen && layout.compactControls
            ? coworkScheme === 'dark'
              ? footerFadeStyle(
                  'linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.75) 55%)',
                  'rgba(12, 8, 10, 0.92)',
                )
              : footerFadeStyle(
                  'linear-gradient(180deg, transparent 0%, rgba(253, 247, 250, 0.85) 55%)',
                  'rgba(253, 247, 250, 0.95)',
                )
            : {}),
        }}
      >
        {(controlsVisible || roomModalOpen) && !sheetPanelOpen ? (
          <YStack gap="$2" width="100%" pointerEvents="box-none">
            <MeetingInviteOthersCard
              visible={
                !inviteCardDismissed &&
                admittedCount <= 1 &&
                !exiting &&
                !presence.isWaiting
              }
              onInvite={() => {
                if (canModerate) presence.togglePanel('invite')
                else setShareOpen(true)
              }}
              onDismiss={() => setInviteCardDismissed(true)}
            />
          <MeetingControls
            caps={{
              ...caps,
              supportsVideo: true,
              supportsScreenShare: supportsScreenBroadcast && !androidPresentUnavailable(),
              supportsRecording: allowRecording,
              supportsLiveCaptions: captions.supported,
            }}
            audioEnabled={callMedia?.audioEnabled ?? true}
            videoEnabled={callMedia?.videoEnabled ?? false}
            screenSharing={(callMedia?.screenSharing ?? false) || presentingContent}
            whiteboardActive={presence.whiteboard.active}
            handRaised={presence.handRaised}
            recording={recording}
            captionsActive={captions.active}
            isHost={isAuthoritativeHost}
            viewerRole={isAuthoritativeHost ? 'host' : presence.selfRole}
            canModerate={canModerate}
            canChangeCriticalSettings={canChangeCriticalMeetingSettings(
              isAuthoritativeHost ? 'host' : presence.selfRole,
            )}
            isLocked={!!presence.moderationSettings?.is_locked}
            panel={presence.panel}
            backgroundActive={(callMedia?.videoEffects.selection.mode ?? 'off') !== 'off'}
            unreadChatCount={presence.unreadChatCount}
            forceCompact={layout.compactControls}
            raisedHandCount={raisedHandCount}
            waitingCount={presence.waitingParticipants.length}
            participantCount={admittedCount}
            reactionTrayOpen={reactionTrayOpen}
            busy={exiting}
            mirrorLocalVideo={meetingMachine.mirrorLocalVideo}
            hideSelfView={meetingMachine.hideSelfView}
            hideNonVideoParticipants={meetingMachine.hideNonVideoParticipants}
            stopIncomingVideo={stopIncomingVideo}
            enterExitSound={enterExitSound}
            denseGallery={meetingMachine.denseGallery}
            uiMaximized={meetingMachine.uiMode === 'maximized'}
            onSetViewMode={(viewMode) => dispatchUi({ type: 'SET_VIEW', viewMode })}
            onToggleMirror={() =>
              dispatchUi({
                type: 'SET_MIRROR_LOCAL_VIDEO',
                enabled: !meetingMachine.mirrorLocalVideo,
              })
            }
            onToggleHideSelfView={() =>
              dispatchUi({
                type: 'SET_HIDE_SELF_VIEW',
                enabled: !meetingMachine.hideSelfView,
              })
            }
            onToggleHideNonVideo={() =>
              dispatchUi({
                type: 'SET_HIDE_NON_VIDEO',
                enabled: !meetingMachine.hideNonVideoParticipants,
              })
            }
            activeSpeakersOnly={meetingMachine.activeSpeakersOnly}
            onToggleActiveSpeakersOnly={() =>
              dispatchUi({
                type: 'SET_ACTIVE_SPEAKERS_ONLY',
                enabled: !meetingMachine.activeSpeakersOnly,
              })
            }
            sideBySideShare={meetingMachine.sideBySideShare}
            onToggleSideBySideShare={() =>
              dispatchUi({
                type: 'SET_SIDE_BY_SIDE_SHARE',
                enabled: !meetingMachine.sideBySideShare,
              })
            }
            onToggleStopIncomingVideo={() => {
              setStopIncomingVideo(!stopIncomingVideo)
              void import('~/co-work/lib/meeting-media-prefs').then(
                ({ loadMeetingMediaPrefs, saveMeetingMediaPrefs }) =>
                  loadMeetingMediaPrefs().then((prefs) =>
                    saveMeetingMediaPrefs({ ...prefs, stopIncomingVideo: !stopIncomingVideo }),
                  ),
              )
              toast.show(!stopIncomingVideo ? 'Incoming video stopped' : 'Incoming video resumed', {
                tone: 'info',
              })
            }}
            onToggleEnterExitSound={() => {
              setEnterExitSound((current) => {
                const next = !current
                void import('~/co-work/lib/meeting-media-prefs').then(
                  ({ loadMeetingMediaPrefs, saveMeetingMediaPrefs }) =>
                    loadMeetingMediaPrefs().then((prefs) =>
                      saveMeetingMediaPrefs({ ...prefs, enterExitSound: next }),
                    ),
                )
                toast.show(next ? 'Join/leave sound on' : 'Join/leave sound off', { tone: 'info' })
                return next
              })
            }}
            onShowKeyboardShortcuts={
              Platform.OS === 'web' ? () => setShortcutsOpen(true) : undefined
            }
            onToggleDenseGallery={() =>
              dispatchUi({
                type: 'SET_DENSE_GALLERY',
                enabled: !meetingMachine.denseGallery,
              })
            }
            onToggleMaximize={() => dispatchUi({ type: 'TOGGLE_UI_MODE' })}
            onTogglePinToolbar={() =>
              dispatchUi({
                type: 'SET_CONTROLS_PINNED',
                pinned: !meetingMachine.controlsPinned,
              })
            }
            controlsPinned={meetingMachine.controlsPinned}
            onToggleOriginalSound={() => {
              setOriginalSound((current) => {
                const next = !current
                void (async () => {
                  const {
                    loadMeetingMediaPrefs,
                    saveMeetingMediaPrefs,
                    meetingAudioCaptureConstraints,
                  } = await import('~/co-work/lib/meeting-media-prefs')
                  const prefs = await loadMeetingMediaPrefs()
                  await saveMeetingMediaPrefs({ ...prefs, originalSound: next })
                  if (!callMedia?.audioEnabled) return
                  const capture = meetingAudioCaptureConstraints({ ...prefs, originalSound: next })
                  try {
                    await callMedia.restartMicrophone(capture)
                  } catch {
                    // Soft-fail — next unmute will pick up prefs via resolveCallAudioCapture.
                  }
                })()
                toast.show(next ? 'Original sound on' : 'Original sound off', {
                  tone: 'info',
                  message: next
                    ? 'Noise suppression relaxed for music / instruments.'
                    : 'Voice processing restored.',
                })
                return next
              })
            }}
            originalSound={originalSound}
            onToggleHdVideo={() => {
              setHdVideo((current) => {
                const next = !current
                void import('~/co-work/lib/meeting-media-prefs').then(
                  ({ loadMeetingMediaPrefs, saveMeetingMediaPrefs }) =>
                    loadMeetingMediaPrefs().then((prefs) =>
                      saveMeetingMediaPrefs({ ...prefs, hdVideo: next }),
                    ),
                )
                toast.show(next ? 'HD video on' : 'Standard video', { tone: 'info' })
                return next
              })
            }}
            hdVideo={hdVideo}
            onToggleAudio={toggleMeetingAudio}
            onOpenAudioSettings={callMedia ? () => presence.togglePanel('audio') : undefined}
            onOpenAudioTest={() => setAudioTestOpen(true)}
            audioQuality={callMedia?.audioQuality}
            onToggleVideo={() => {
              if (!callMedia) {
                toast.show('Still connecting…', {
                  tone: 'info',
                  message: 'Wait a moment for the room to join, then try video again.',
                })
                return
              }
              if (callMedia.videoEnabled === false && !allowSelfStartVideo && !canModerate) {
                toast.show('The host disabled starting video', {
                  tone: 'info',
                  message: 'Ask the host to allow participants to turn on their camera.',
                })
                return
              }
              void presence.syncMediaState({ is_video_off: callMedia.videoEnabled })
              callMedia.toggleVideo()
            }}
            onToggleBackgrounds={() => presence.togglePanel('backgrounds')}
            onOpenVideoSettings={() => presence.togglePanel('backgrounds')}
            onOpenWhiteboard={() => {
              if (!presence.whiteboard.active) {
                setWhiteboardHidden(false)
                presence.openWhiteboard()
                return
              }
              setWhiteboardHidden((hidden) => !hidden)
            }}
            onToggleScreen={() => {
              if (presentingContent && !callMedia?.screenSharing) stopContentShare()
              else void toggleScreenShare()
            }}
            onOpenShareOptions={() => {
              setShareOptionsInitialContent(null)
              setShareOptionsOpen(true)
            }}
            onToggleHand={toggleHand}
            onToggleReactions={() => setReactionTrayOpen((open) => !open)}
            onCloseReactions={() => setReactionTrayOpen(false)}
            onSendReaction={sendReaction}
            onSelectNonverbal={(status) => {
              presence.setNonverbalFeedback(status)
              void import('~/co-work/lib/meeting-nonverbal').then(({ meetingNonverbalLabel }) => {
                toast.show(status ? meetingNonverbalLabel(status) : 'Feedback cleared', {
                  tone: 'info',
                })
              })
            }}
            activeNonverbal={presence.localNonverbal}
            onToggleRecord={toggleRecording}
            onToggleCaptions={toggleCaptions}
            onToggleChat={() => presence.togglePanel('chat')}
            onTogglePeople={() => presence.togglePanel('people')}
            onToggleInfo={() => presence.togglePanel('info')}
            onToggleInvite={() => {
              if (canModerate) presence.togglePanel('invite')
              else setShareOpen(true)
            }}
            onToggleHostTools={
              canModerate ? () => presence.togglePanel('host_tools') : undefined
            }
            onTogglePolls={() => presence.togglePanel('polls')}
            onToggleQa={() => presence.togglePanel('qna')}
            onToggleBreakouts={() => presence.togglePanel('breakouts')}
            onOpenDualMonitor={
              Platform.OS === 'web'
                ? () => {
                    void import('~/co-work/lib/meeting-dual-monitor').then(({ openMeetingStagePopout }) => {
                      const win = openMeetingStagePopout({
                        meetingId: meeting.id,
                        title: meetingState.title,
                      })
                      toast.show(
                        win ? 'Opened second window' : 'Could not open a second window',
                        { tone: win ? 'success' : 'danger' },
                      )
                    })
                  }
                : undefined
            }
            onToggleAnnotateShare={() => {
              setAnnotateShareOpen((open) => {
                const next = !open
                presence.setAnnotationSessionOpen(next)
                return next
              })
            }}
            annotateShareActive={annotateShareOpen || presence.annotationOpen}
            onRequestRemoteControl={() => {
              // Prefer the active screen sharer identity when available.
              const sharerIdentity =
                (callMedia as { screenShareIdentity?: string } | undefined)?.screenShareIdentity ||
                null
              const sharer =
                (sharerIdentity
                  ? presence.participants.find((row) => row.user_id === sharerIdentity)
                  : null) ||
                liveParticipants.find(
                  (row) => row.user_id !== userId && row.status === 'admitted',
                )
              if (!sharer || sharer.user_id === userId) {
                toast.show('Ask the person sharing their screen for remote control', {
                  tone: 'info',
                })
                return
              }
              presence.requestRemoteControl(sharer.user_id)
              toast.show('Remote control requested', {
                tone: 'info',
                message: `Sent to ${sharer.display_name || 'participant'}`,
              })
            }}
            onShare={() => setShareOpen(true)}
            onOpenDocs={() => {
              setShareOptionsInitialContent('files')
              setShareOptionsOpen(true)
            }}
            onOpenApps={() => setAppsSheetOpen(true)}
            onOverlayOpenChange={setControlsOverlayOpen}
            onMuteAll={isAuthoritativeHost ? handleMuteAll : undefined}
            onAskAllToMute={canModerate ? () => void presence.askAllToMute() : undefined}
            onAskAllToUnmute={
              canModerate
                ? () =>
                    void presence
                      .askAllToUnmute()
                      .then(() => toast.show('Asked everyone to unmute', { tone: 'info' }))
                : undefined
            }
            onRemoveAllExceptHost={
              isAuthoritativeHost ? handleRemoveAllExceptHost : undefined
            }
            onToggleLock={isAuthoritativeHost ? handleToggleLock : undefined}
            onToggleWaitingRoom={isAuthoritativeHost ? handleToggleWaitingRoom : undefined}
            waitingRoomEnabled={meetingState.security_settings?.waitingRoom !== false}
            onToggleMuteOnJoin={isAuthoritativeHost ? handleToggleMuteOnJoin : undefined}
            muteOnJoin={!!meetingState.security_settings?.muteOnJoin}
            onToggleVideoOffOnJoin={isAuthoritativeHost ? handleToggleVideoOffOnJoin : undefined}
            videoOffOnJoin={!!meetingState.security_settings?.videoOffOnJoin}
            onToggleFullscreen={toggleFullscreen}
            fullscreenActive={fullscreen.active}
            onMinimize={minimizeMeeting}
            onPictureInPicture={enterMeetingPip}
            onDisconnectAudio={() => {
              if (callMedia?.audioEnabled) toggleMeetingAudio()
              toast.show('Audio disconnected', {
                tone: 'info',
                message: 'Tap Unmute when you want to speak again.',
              })
            }}
            onOpenSettings={() => setSettingsSheetOpen(true)}
            onOpenSafeDriving={() => {
              if (callMedia?.videoEnabled) {
                void presence.syncMediaState({ is_video_off: true })
                callMedia.toggleVideo()
              }
              if (callMedia?.audioEnabled) toggleMeetingAudio()
              setSafeDrivingOpen(true)
              toast.show('Safe driving mode on', {
                tone: 'success',
                message: 'Hold Tap to speak when you need the mic.',
              })
            }}
            onLeave={handleLeave}
            onEnd={handleEnd}
          />
          </YStack>
        ) : (
          <XStack
            width="100%"
            paddingHorizontal={roomy ? '$5' : '$3'}
            paddingBottom="$2"
            paddingTop="$1"
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <Button
              tone="ghost"
              size="$2"
              borderRadius={999}
              onPress={revealControls}
              icon={Icons.ChevronUp ? <Icons.ChevronUp size={16} color={coworkUi.text} /> : null}
              accessibilityLabel="Show meeting controls"
            >
              Controls
            </Button>
            <XStack alignItems="center" gap="$2">
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                borderColor="rgba(244,63,104,0.45)"
                color={coworkUi.danger}
                backgroundColor={coworkUi.dangerMuted}
                disabled={exiting}
                accessibilityLabel="Leave meeting"
                onPress={handleLeave}
              >
                {exiting ? 'Leaving…' : 'Leave'}
              </Button>
              {isAuthoritativeHost ? (
                <Button
                  tone="primary"
                  size="$2"
                  borderRadius={999}
                  backgroundColor={coworkUi.danger}
                  disabled={exiting}
                  accessibilityLabel="End meeting for everyone"
                  onPress={handleEnd}
                >
                  {exiting ? 'Ending…' : 'End'}
                </Button>
              ) : null}
            </XStack>
          </XStack>
        )}
      </YStack>

      <MeetingAnnotationOverlay
        open={annotateShareOpen || presence.annotationOpen}
        localUserId={userId}
        remoteStrokes={presence.annotationStrokes}
        onClose={() => {
          setAnnotateShareOpen(false)
          presence.setAnnotationSessionOpen(false)
        }}
        onStroke={(stroke) => presence.publishAnnotationStroke(stroke)}
        onClear={() => presence.clearAnnotations()}
      />
      <MeetingRemoteControlRequestModal
        open={!!presence.remoteControlRequest}
        requesterName={presence.remoteControlRequest?.name || 'Someone'}
        onAccept={() => {
          if (presence.remoteControlRequest) {
            presence.respondRemoteControl(presence.remoteControlRequest.from, true)
            toast.show('Remote control allowed', { tone: 'success' })
          }
        }}
        onDeny={() => {
          if (presence.remoteControlRequest) {
            presence.respondRemoteControl(presence.remoteControlRequest.from, false)
            toast.show('Remote control denied', { tone: 'info' })
          }
        }}
      />
      <MeetingRemoteControlRequestModal
        open={
          !!presence.recordingRequest &&
          (isAuthoritativeHost || canModerate) &&
          !recordingSession.recording
        }
        requesterName={presence.recordingRequest?.name || 'Someone'}
        title="Recording request"
        message={`${presence.recordingRequest?.name || 'Someone'} is asking to record this meeting. Allowing starts cloud recording for everyone.`}
        acceptLabel="Start recording"
        onAccept={() => {
          const request = presence.recordingRequest
          if (!request) return
          if (!callMedia?.connected) {
            toast.show('Still connecting…', { tone: 'info', message: 'Try again once the room joins.' })
            return
          }
          void recordingSession.startRecording().then((started) => {
            presence.respondRecording(request.from, started)
          })
        }}
        onDeny={() => {
          if (presence.recordingRequest) {
            presence.respondRecording(presence.recordingRequest.from, false)
          }
        }}
      />
      <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting} />
      <MeetingShareOptionsSheet
        open={shareOptionsOpen}
        onClose={() => {
          setShareOptionsOpen(false)
          setShareOptionsInitialContent(null)
        }}
        onConfirm={(options) => {
          setShareOptionsInitialContent(null)
          confirmShareOptions(options)
        }}
        initialContent={shareOptionsInitialContent}
        supportsScreenShare={supportsScreenBroadcast && !androidPresentUnavailable()}
        supportsWhiteboard
      />
      <MeetingAppsSheet
        open={appsSheetOpen}
        onClose={() => setAppsSheetOpen(false)}
        actions={[
          {
            key: 'virtual_backgrounds',
            label: 'Virtual Backgrounds',
            hint: 'Blur or replace your camera background',
            icon: Icons.Image,
            onPress: () => presence.togglePanel('backgrounds'),
          },
          {
            key: 'polls',
            label: 'Polls',
            hint: 'Create and run live polls',
            icon: Icons.BarChart3,
            onPress: () => presence.togglePanel('polls'),
          },
          {
            key: 'qna',
            label: 'Q&A',
            hint: 'Collect questions from participants',
            icon: Icons.HelpCircle,
            onPress: () => presence.togglePanel('qna'),
          },
          {
            key: 'whiteboard',
            label: 'Whiteboard',
            hint: 'Collaborate on a shared board',
            icon: Icons.PenTool,
            onPress: () => {
              if (!presence.whiteboard.active) {
                setWhiteboardHidden(false)
                presence.openWhiteboard()
                return
              }
              setWhiteboardHidden((hidden) => !hidden)
            },
          },
          {
            key: 'breakouts',
            label: 'Breakout rooms',
            hint: 'Split the meeting into smaller rooms',
            icon: Icons.UsersRound,
            onPress: () => presence.togglePanel('breakouts'),
          },
          ...(canModerate
            ? [
                {
                  key: 'host_notes',
                  label: 'Host notes',
                  hint: 'Private notes only you can see',
                  icon: Icons.FileText,
                  onPress: () => presence.togglePanel('host_tools'),
                },
              ]
            : []),
        ]}
      />
      <MeetingSettingsSheet
        open={settingsSheetOpen}
        onClose={() => setSettingsSheetOpen(false)}
        actions={[
          ...(canModerate
            ? [
                {
                  key: 'meeting_settings',
                  label: 'Meeting settings',
                  icon: Icons.Video,
                  onPress: () => presence.togglePanel('host_tools'),
                },
              ]
            : []),
          {
            key: 'virtual_background',
            label: 'Virtual background',
            icon: Icons.Image,
            onPress: () => {
              if (!callMedia) return
              presence.togglePanel('backgrounds')
            },
          },
          {
            key: 'video_filters',
            label: 'Video filters',
            icon: Icons.Sparkles,
            onPress: () => {
              toast.show('Video filters', {
                tone: 'info',
                message: 'Coming soon — use Virtual background for blur and images.',
              })
            },
          },
          {
            key: 'audio',
            label: 'Audio',
            icon: Icons.Headphones,
            onPress: () => presence.togglePanel('audio'),
          },
          {
            key: 'captions',
            label: 'Captions and translations',
            icon: Icons.Captions,
            onPress: () => toggleCaptions(),
          },
          {
            key: 'safe_driving',
            label: 'Safe driving mode',
            icon: Icons.Car,
            onPress: openSafeDrivingMode,
          },
        ]}
      />
      <MeetingInfoModal
        open={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        topic={title}
        meetingCode={formatMeetingCode(meetingState?.meeting_code || meeting.meeting_code)}
        hostName={
          presence.participants.find((p) => p.user_id === meetingState?.host_id)?.display_name ||
          displayName
        }
        passcode={meetingState?.security_settings?.passcode || null}
        numericPasscode={
          (meetingState?.security_settings as { numeric_passcode?: string } | null | undefined)
            ?.numeric_passcode || null
        }
        shareUrl={getMeetingShareUrl(meetingState?.meeting_code || meeting.meeting_code)}
      />
      <MeetingTransferHostSheet
        open={transferHostOpen}
        onOpenChange={setTransferHostOpen}
        participants={liveParticipants}
        currentUserId={userId}
        onTransfer={async (id) => {
          const target = presence.participants.find((row) => row.user_id === id)
          const name =
            target?.display_name ||
            target?.profile?.full_name ||
            target?.profile?.username ||
            'Participant'
          try {
            await presence.transferHost(id)
            toast.show('Host transferred', {
              tone: 'success',
              message: `${name} is now the host. You’re a co-host.`,
            })
          } catch (cause) {
            toast.show('Could not transfer host', {
              tone: 'danger',
              message: cause instanceof Error ? cause.message : 'Please try again.',
            })
            throw cause
          }
        }}
      />
      <MeetingWhiteboardModal
        open={presence.whiteboard.active && !whiteboardHidden}
        userId={userId}
        startedByName={
          presence.whiteboard.startedBy
            ? participantDisplayNames[presence.whiteboard.startedBy] ||
              (presence.whiteboard.startedBy === userId ? displayName : 'Someone')
            : null
        }
        canStopForEveryone={
          canModerate || presence.whiteboard.startedBy === userId
        }
        strokes={presence.whiteboard.strokes}
        onClose={() => setWhiteboardHidden(true)}
        onStopSharing={() => {
          setWhiteboardHidden(false)
          presence.closeWhiteboard(true)
        }}
        onStroke={presence.addWhiteboardStroke}
        onUndo={presence.undoWhiteboardStroke}
        onClear={presence.clearWhiteboard}
      />
      <MeetingAudioTestModal
        open={audioTestOpen}
        onClose={() => setAudioTestOpen(false)}
      />
      <MeetingShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Immersive chrome-hidden: Zoom-style quick actions (flip / background / chat / driving). */}
      {layout.compactControls && !controlsVisible && !roomModalOpen && !sheetPanelOpen ? (
        <XStack
          position="absolute"
          bottom={Math.max(safeBottom, 12) + 6}
          alignSelf="center"
          alignItems="center"
          gap={10}
          zIndex={25}
          paddingHorizontal={12}
          paddingVertical={8}
          borderRadius={999}
          backgroundColor="rgba(12, 8, 10, 0.78)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.16)"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            hitSlop={12}
            onPress={() => {
              if (!callMedia) return
              void (async () => {
                try {
                  const facing = await callMedia.flipCamera()
                  toast.show(facing === 'environment' ? 'Rear camera' : 'Front camera', {
                    tone: 'info',
                  })
                } catch (cause) {
                  toast.show('Could not flip camera', {
                    tone: 'danger',
                    message: cause instanceof Error ? cause.message : 'Try again.',
                  })
                }
              })()
            }}
            style={{
              minWidth: 36,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Icons.RefreshCw size={14} color="#fff" />
          </Pressable>
          {callMedia ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Virtual background"
              hitSlop={12}
              onPress={() => {
                dispatchUi({ type: 'SET_CONTROLS', visible: true })
                presence.togglePanel('backgrounds')
              }}
              style={{
                minWidth: 36,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
                backgroundColor:
                  (callMedia.videoEffects.selection.mode ?? 'off') !== 'off'
                    ? 'rgba(14, 114, 237, 0.55)'
                    : 'rgba(255,255,255,0.12)',
              }}
            >
              <Icons.Image size={14} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Meeting chat"
            hitSlop={12}
            onPress={() => {
              dispatchUi({ type: 'SET_CONTROLS', visible: true })
              presence.togglePanel('chat')
            }}
            style={{
              minWidth: 36,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Icons.MessageSquare size={14} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Safe driving mode"
            hitSlop={12}
            onPress={() => {
              if (callMedia?.videoEnabled) {
                void presence.syncMediaState({ is_video_off: true })
                callMedia.toggleVideo()
              }
              if (callMedia?.audioEnabled) toggleMeetingAudio()
              setSafeDrivingOpen(true)
            }}
            style={{
              minWidth: 36,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Icons.Car size={14} color="#fff" />
          </Pressable>
        </XStack>
      ) : null}

      <MeetingSafeDrivingMode
        open={safeDrivingOpen}
        muted={!(callMedia?.audioEnabled ?? true) && !safeDrivingSpeaking}
        videoOff={!(callMedia?.videoEnabled ?? false)}
        speaking={safeDrivingSpeaking}
        onHoldSpeak={() => {
          setSafeDrivingSpeaking(true)
          if (callMedia && !callMedia.audioEnabled) toggleMeetingAudio()
        }}
        onReleaseSpeak={() => {
          setSafeDrivingSpeaking(false)
          if (callMedia?.audioEnabled) toggleMeetingAudio()
        }}
        onToggleSpeaker={() => void callMedia?.toggleSpeaker()}
        onEnd={() => {
          setSafeDrivingOpen(false)
          handleEnd()
        }}
        onExitMode={() => setSafeDrivingOpen(false)}
        onOpenGallery={
          admittedCount >= 2
            ? () => {
                setSafeDrivingOpen(false)
                dispatchUi({ type: 'SET_VIEW', viewMode: 'gallery' })
              }
            : undefined
        }
      />
    </YStack>
  )
}
