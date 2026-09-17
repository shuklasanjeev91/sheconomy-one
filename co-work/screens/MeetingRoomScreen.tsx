// Keep first: `livekit-client` extends DOMException while it evaluates, and a
// universal link can make this the very first screen module Hermes loads.
import '~/lib/polyfills/install-dom-exception'

import { Alert, Platform, useWindowDimensions } from 'react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { MeetingTransferHostSheet } from '~/co-work/components/MeetingTransferHostSheet'
import { ScreenCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkAlertBanner, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { LiveKitMeetingRoom, type LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import { MeetingChatPanel } from '~/co-work/components/MeetingChatPanel'
import { MeetingBackgroundPanel } from '~/co-work/components/MeetingBackgroundPanel'
import { MeetingAudioPanel } from '~/co-work/components/MeetingAudioPanel'
import { MeetingControls } from '~/co-work/components/MeetingControls'
import { MeetingInfoPanel } from '~/co-work/components/MeetingInfoPanel'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingLiveCaptions } from '~/co-work/components/MeetingLiveCaptions'
import { MeetingLiveSignalsProvider } from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingParticipantsPanel } from '~/co-work/components/MeetingParticipantsPanel'
import { MeetingReactionsOverlay } from '~/co-work/components/MeetingReactionsOverlay'
import { MeetingRecordingsPanel } from '~/co-work/components/MeetingRecordingsPanel'
import { MeetingResponsivePanel } from '~/co-work/components/MeetingResponsivePanel'
import { MeetingWaitingRoom } from '~/co-work/components/MeetingWaitingRoom'
import { MeetingWaitingRoomRequests } from '~/co-work/components/MeetingWaitingRoomRequests'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { MeetingProvider, useMeetingMachine, useOptionalMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  useMeetingStateManager,
  useSyncMeetingLifecycle,
} from '~/co-work/hooks/useMeetingStateManager'
import {
  MEETING_TOOLBAR_Z_INDEX,
} from '~/co-work/lib/meeting-toolbar'
import { useLiveCaptions } from '~/co-work/hooks/useLiveCaptions'
import {
  useMeetingRecording,
  useMeetingRecordingIndicator,
} from '~/co-work/hooks/useMeetingRecording'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import { connectionStatusLabel } from '~/co-work/lib/meeting-audio-quality'
import { isMeetingChatEnabled, isMeetingPrivateChatEnabled } from '~/co-work/lib/meeting-chat'
import { canChangeCriticalMeetingSettings } from '~/co-work/lib/meeting-role-permissions'
import { resolveMeetingChromeLayout } from '~/co-work/lib/meeting-orientation-layout'
import {
  applyMeetingUiChromeLayout,
  resolveMeetingUiChromePadding,
  shouldAutoHideMeetingControls,
} from '~/co-work/lib/meeting-ui-chrome'
import { useMeetingUiChrome } from '~/co-work/hooks/useMeetingUiChrome'
import { useMeetingFullscreen } from '~/co-work/hooks/useMeetingFullscreen'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import {
  describeMeetingWebScreenShare,
  detectMeetingWebCapabilities,
  mapWebScreenShareError,
  meetingWebUnsupportedMessage,
} from '~/co-work/lib/meeting-web'
import { openInstantMeetingSession, markInstantMeetingEnteredRoom } from '~/co-work/lib/instant-meeting-session'
import {
  enterGlobalSessionPip,
  minimizeGlobalSession,
} from '~/lib/session/global-session'
import { useRegisterGlobalSession } from '~/lib/session/useRegisterGlobalSession'
import {
  detectSessionPipCapabilities,
  requestSessionPictureInPicture,
  sessionPipUnsupportedMessage,
} from '~/lib/session/picture-in-picture'
import { meetingBrowsingMinimizedNotice } from '~/co-work/lib/meeting-lifecycle'
import { useSessionPipOnHide } from '~/lib/session/useSessionPipOnHide'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import {
  endMeetingConfirmCopy,
  hostLeaveConfirmCopy,
} from '~/co-work/lib/meeting-end'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, footerFadeStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'
import { navigateApp } from '~/lib/platform/navigate'
import { coWorkRoutes } from '~/lib/routes'
import { copyShareLink } from '~/lib/share'

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
  const caps = useMemo(() => getMediaCapabilities(), [])
  const useLiveKit = supportsLiveKitVideo() && !!props.meeting.room_id
  const [mediaReconnectFailed, setMediaReconnectFailed] = useState(false)
  const [mediaReconnectKey, setMediaReconnectKey] = useState(0)
  const handleMediaDisconnected = useCallback(() => setMediaReconnectFailed(true), [])

  // Collaboration layer (presence / chat / hands) — separate from SFU media.
  // Update the adapter pointer every change; unbind only on unmount so we never
  // null→rebind (that bumped MeetingProvider and looped with LiveKit re-renders).
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
    !presence.isConnecting &&
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
    await presence.leave()
    if (props.onLeave) props.onLeave()
    else navigateApp(coWorkRoutes.home)
  }, [presence, props])

  if (presence.isConnecting) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
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
          Back to Co-Work
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

  if (presence.connectionFailed || mediaReconnectFailed) {
    return (
      <MeetingReconnectFallback
        title="Unable to reconnect"
        message="Check your internet connection, then try joining the meeting again."
        error={presence.error}
        onRetry={async () => {
          setMediaReconnectFailed(false)
          setMediaReconnectKey((value) => value + 1)
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
      rolesByUserId={Object.fromEntries(
        presence.participants.map((participant) => [
          participant.user_id,
          participant.role ?? (participant.is_host ? 'host' : 'participant'),
        ]),
      )}
    >
      <LiveKitMeetingRoom
        key={mediaReconnectKey}
        meetingId={props.meeting.id}
        roomId={props.meeting.room_id ?? ''}
        displayName={props.displayName}
        avatarUrl={props.avatarUrl}
        isHost={props.isHost}
        enabled={!presence.isWaiting && !presence.isRejected}
        onDisconnected={handleMediaDisconnected}
        overlay={
          useLiveKit
            ? (liveKit) => (
                <MeetingRoomOverlay
                  {...props}
                  presence={presence}
                  caps={caps}
                  title={title}
                  liveKit={liveKit}
                />
              )
            : () => <MeetingRoomOverlay {...props} presence={presence} caps={caps} title={title} />
        }
      />
    </MeetingLiveSignalsProvider>
  )
}

function MeetingReconnectFallback({
  title,
  message,
  error,
  onRetry,
  onLeave,
}: {
  title: string
  message: string
  error?: string | null
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
    <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
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
          disabled={!!busy}
          onPress={() => void run('retry', onRetry)}
        >
          {busy === 'retry' ? 'Retrying…' : 'Retry'}
        </Button>
        <Button
          tone="outline"
          borderRadius={999}
          disabled={!!busy}
          onPress={() => void run('leave', onLeave)}
        >
          {busy === 'leave' ? 'Leaving…' : 'Leave Meeting'}
        </Button>
      </XStack>
    </ScreenCenter>
  )
}

function MeetingRoomOverlay({
  meeting,
  userId,
  displayName,
  onLeave,
  presence,
  caps,
  title,
  liveKit,
  isHost,
}: MeetingRoomScreenProps & {
  presence: PresenceState
  caps: MediaCaps
  title: string
  liveKit?: LiveKitMediaControls
}) {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const {
    state: meetingMachine,
    bindLiveKitMedia,
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
  const chromeBase = useMemo(
    () =>
      resolveMeetingChromeLayout({
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
  const chrome = useMemo(
    () =>
      applyMeetingUiChromeLayout(
        chromeBase,
        resolveMeetingUiChromePadding({
          chrome: chromeBase,
          uiMode: meetingMachine.uiMode,
          controlsVisible: meetingMachine.controlsVisible,
          safeTop,
          safeBottom,
        }),
      ),
    [
      chromeBase,
      meetingMachine.controlsVisible,
      meetingMachine.uiMode,
      safeBottom,
      safeTop,
    ],
  )
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [meetingState, setMeetingState] = useState(meeting)
  const [shareOpen, setShareOpen] = useState(false)
  const [transferHostOpen, setTransferHostOpen] = useState(false)
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const exitingRef = useRef(false)

  // Persist "already in room" on the InstantMeetingHost session so Maximize
  // restores MeetingRoomScreen instead of the Join confirm lobby.
  useEffect(() => {
    markInstantMeetingEnteredRoom({ displayName, meeting })
  }, [displayName, meeting])

  // Keep SFU adapter pointer fresh without unbind/rebind thrash.
  // useLiveKitMediaControls returns a new object each render — cleanup→null→bind
  // was bumping MeetingProvider adapters in a max-update-depth loop (captions/panels).
  useEffect(() => {
    bindLiveKitMedia(liveKit ?? null)
  }, [bindLiveKitMedia, liveKit])

  useEffect(() => {
    return () => bindLiveKitMedia(null)
  }, [bindLiveKitMedia])

  useEffect(() => {
    if (exiting) markLeaving()
  }, [exiting, markLeaving])

  const isAuthoritativeHost = isHost || presence.selfRole === 'host'
  const canModerate = presence.canModerate || isAuthoritativeHost
  const chatEnabled = isMeetingChatEnabled(meetingState)
  const privateChatEnabled = isMeetingPrivateChatEnabled(meetingState)
  const supportsScreenBroadcast =
    !!liveKit && (caps.supportsScreenShare || Platform.OS === 'android' || Platform.OS === 'ios')

  const setControlsVisible = useCallback(
    (visible: boolean) => {
      dispatchUi({ type: 'SET_CONTROLS', visible })
    },
    [dispatchUi],
  )
  const { revealControls } = useMeetingUiChrome({
    uiMode: meetingMachine.uiMode,
    viewMode: meetingMachine.viewMode,
    panelOpen: presence.panel !== 'none',
    waitingCount: presence.waitingParticipants.length,
    busy: exiting,
    controlsPinned: meetingMachine.controlsPinned,
    controlsVisible: meetingMachine.controlsVisible,
    onSetControlsVisible: setControlsVisible,
  })
  const chromeVisible = meetingMachine.controlsVisible
  const immersiveAutoHide = shouldAutoHideMeetingControls({
    uiMode: meetingMachine.uiMode,
    viewMode: meetingMachine.viewMode,
    panelOpen: presence.panel !== 'none',
    waitingCount: presence.waitingParticipants.length,
    busy: exiting,
    controlsPinned: meetingMachine.controlsPinned,
  })
  const allowRecording = meeting.security_settings?.allowRecording !== false
  const autoRecord = !!meeting.meeting_options?.autoRecord && isAuthoritativeHost && allowRecording
  const admittedCount = presence.participants.filter((p) => p.status === 'admitted').length
  const waitingCount = presence.waitingParticipants.length
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
  const roomy = isTablet || isDesktop
  const narrowPhone = chrome.panelFullWidth
  const panelTrailingInset = chrome.panelTrailingInset

  const captions = useLiveCaptions({
    userId,
    displayName,
    enabled: true,
    remoteCaptions: presence.liveCaptions,
    onFinalCaption: (text, sourceLang) =>
      presence.broadcastCaption(text, displayName, sourceLang),
  })
  const captionsPrefAppliedRef = useRef(false)
  const prevSelfRoleRef = useRef(presence.selfRole)
  const prevCaptionLangRef = useRef(captions.targetLang)

  useEffect(() => {
    if (captionsPrefAppliedRef.current) return
    if (!meeting.meeting_options?.captionsEnabled || !captions.supported) return
    captionsPrefAppliedRef.current = true
    if (!captions.active) captions.toggleCaptions()
    // Depend on primitives — full `captions` object identity churned every render.
  }, [
    captions.active,
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

  const recordingSession = useMeetingRecording({
    room: liveKit?.room,
    meetingId: meeting.id,
    meetingCode: meeting.meeting_code,
    enabled: allowRecording && isAuthoritativeHost,
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
  })

  const recordingIndicator = useMeetingRecordingIndicator(
    meeting.id,
    allowRecording && !isAuthoritativeHost,
  )

  const showError = presence.error && presence.error !== dismissedError
  const panelPresentation = chrome.panelPresentation
  const panelFullWidth = panelPresentation === 'bottom-sheet'
  const sidePanelWidth = Math.min(
    chrome.breakpoint === 'large-desktop' ? 440 : chrome.breakpoint === 'desktop' ? 400 : 380,
    Math.round(viewportWidth * chrome.panelMaxWidthFraction),
  )
  const recording = isAuthoritativeHost
    ? recordingSession.recording || recordingSession.isProcessing
    : recordingIndicator.isRecording

  useEffect(() => {
    if (!liveKit) {
      presence.registerMediaHandlers({})
      return
    }

    const applyRemoteMuteAll = () => {
      if (liveKit.audioEnabled) {
        void presence.syncMediaState({ is_muted: true })
        liveKit.toggleAudio()
      }
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
        toast.show('A moderator asked you to unmute', {
          tone: 'info',
          message: 'Turn on your microphone when you are ready.',
        })
      },
      onStopVideo: () => {
        if (liveKit.videoEnabled) {
          void presence.syncMediaState({ is_video_off: true })
          liveKit.toggleVideo()
        }
        toast.show('Your video was stopped by a moderator', { tone: 'info' })
      },
      onMeetingEnded: () => {
        if (exitingRef.current) return
        exitingRef.current = true
        setExiting(true)
        void (async () => {
          try {
            if (liveKit.screenSharing) {
              await Promise.resolve(liveKit.toggleScreenShare())
            }
          } catch {
            // Best-effort.
          }
          try {
            liveKit.room.disconnect(true)
          } catch {
            // Already disconnected.
          }
          markEnded()
          navigateApp(coWorkRoutes.meetingEnded(meeting.meeting_code))
        })()
      },
    })
    return () => {
      presence.registerMediaHandlers({})
    }
  }, [
    liveKit,
    markEnded,
    meeting.meeting_code,
    presence.registerMediaHandlers,
    presence.syncMediaState,
    toast,
  ])

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
    if (!isAuthoritativeHost) {
      toast.show('Only the host can record this meeting', { tone: 'info' })
      return
    }
    try {
      recordingSession.toggleRecording()
    } catch (error) {
      toast.show('Recording failed', {
        tone: 'error',
        message: error instanceof Error ? error.message : undefined,
      })
    }
  }, [allowRecording, isAuthoritativeHost, recordingSession, toast])

  const toggleCaptions = useCallback(() => {
    if (!captions.supported) {
      toast.show('Live captions are not available on this device', { tone: 'info' })
      return
    }
    const turningOn = !captions.active
    captions.toggleCaptions()
    if (turningOn && !captions.canPublish) {
      toast.show(`Viewing captions in ${captions.targetLangName}`, {
        tone: 'success',
        message: 'Speech from others is auto-translated to your language',
      })
      return
    }
    toast.show(turningOn ? `Live captions on · ${captions.targetLangName}` : 'Live captions off', {
      tone: 'success',
      message: turningOn
        ? 'Other languages are translated to your default language'
        : undefined,
    })
  }, [captions, toast])

  const toggleScreenShare = useCallback(async () => {
    if (!liveKit) {
      toast.show('Connect to the meeting to share your screen', { tone: 'info' })
      return
    }
    if (!supportsScreenBroadcast) {
      toast.show('Screen share is not available on this device', {
        tone: 'info',
        message:
          Platform.OS === 'android'
            ? 'Present from iPhone, iPad, or the website. Android meetings can still view a shared screen.'
            : Platform.OS === 'web'
              ? meetingWebUnsupportedMessage('screen_share')
              : 'Rebuild the app with the screen-share broadcast extension enabled.',
      })
      return
    }

    const wasSharing = liveKit.screenSharing
    try {
      await liveKit.toggleScreenShare()
      toast.show(wasSharing ? 'Screen share stopped' : 'Screen sharing started', {
        tone: 'success',
        message: wasSharing
          ? undefined
          : Platform.OS === 'ios'
            ? 'Keep the broadcast extension running while you present.'
            : Platform.OS === 'android'
              ? 'Allow screen capture in the system prompt. A sharing notification stays on while you present.'
              : Platform.OS === 'web' && webCapabilities
                ? describeMeetingWebScreenShare(webCapabilities)
                : undefined,
      })
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
        message: message || 'Allow screen recording when prompted, then try again.',
      })
    }
  }, [liveKit, supportsScreenBroadcast, toast, webCapabilities])

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen.supported) {
      toast.show('Full screen unavailable', {
        tone: 'info',
        message: fullscreen.unsupportedMessage,
      })
      return
    }
    void fullscreen.toggle().catch((cause) => {
      toast.show('Full screen failed', {
        tone: 'error',
        message: cause instanceof Error ? cause.message : fullscreen.unsupportedMessage,
      })
    })
  }, [fullscreen, toast])

  const minimizeMeeting = useCallback(() => {
    // Keep LiveKit mounted via InstantMeetingHost. Mark enteredRoom so Maximize
    // resumes the live room instead of the Join confirm lobby.
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
      enteredRoom: true,
      displayName,
    })
    minimizeGlobalSession()
    toast.show('Meeting minimized', {
      tone: 'success',
      message: meetingBrowsingMinimizedNotice('meeting'),
    })
    // Always leave lobby /live under the overlay. Staying on Join now made
    // Maximize look broken when the host briefly hid (code-shape mismatch).
    navigateApp(coWorkRoutes.home)
  }, [displayName, meeting, toast])

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
      enterGlobalSessionPip()
      if (Platform.OS === 'ios') {
        toast.show('Picture-in-Picture', {
          tone: 'info',
          message: 'Use the system PiP controls, or Maximize from the mini bar to return.',
        })
      }
    })()
  }, [minimizeMeeting, toast])

  const toggleMeetingAudio = useCallback(() => {
    if (!liveKit && !session.hasMedia()) {
      toast.show('Still connecting…', {
        tone: 'info',
        message: 'Wait a moment for the room to join, then try mute again.',
      })
      return
    }
    const audioOn = session.getMediaSnapshot()?.audioEnabled ?? liveKit?.audioEnabled ?? true
    void presence.syncMediaState({ is_muted: audioOn })
    if (session.hasMedia()) session.toggleMic()
    else liveKit?.toggleAudio()
  }, [liveKit, presence, session, toast])

  const sendReaction = useCallback(
    (emoji: string) => {
      presence.sendReaction(emoji, displayName)
      setReactionTrayOpen(false)
    },
    [displayName, presence],
  )

  const copyMeetingId = useCallback(() => {
    void copyShareLink(meeting.meeting_code.replace(/\s/g, '')).then((copied) => {
      toast.show(copied ? 'Meeting ID copied' : 'Could not copy Meeting ID', {
        tone: copied ? 'success' : 'error',
      })
    })
  }, [meeting.meeting_code, toast])

  const exitToCoWork = useCallback(() => {
    if (onLeave) {
      onLeave()
      return
    }
    navigateApp(coWorkRoutes.home)
  }, [onLeave])

  const exitToMeetingEnded = useCallback(() => {
    markEnded()
    navigateApp(coWorkRoutes.meetingEnded(meeting.meeting_code))
  }, [markEnded, meeting.meeting_code])

  const disconnectLiveKit = useCallback(async () => {
    if (session.hasMedia()) {
      await session.disconnect()
      return
    }
    const room = liveKit?.room
    if (!room) return
    try {
      if (liveKit.screenSharing) {
        await Promise.resolve(liveKit.toggleScreenShare())
      }
    } catch {
      // Best-effort stop of local screen share before teardown.
    }
    try {
      room.disconnect(true)
    } catch {
      // Room may already be tearing down.
    }
  }, [liveKit, session])

  const toggleHand = useCallback(() => {
    const raising = !presence.handRaised
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
  }, [presence, session, toast])

  const runLeave = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    void (async () => {
      try {
        if (isAuthoritativeHost && recordingSession.recording) {
          await withTimeout(recordingSession.stopRecording(), 4000)
        }
        await disconnectLiveKit()
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
    disconnectLiveKit,
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
        await disconnectLiveKit()
        await withTimeout(presence.hostEnd(), 4000)
      } finally {
        exitToMeetingEnded()
      }
    })()
  }, [
    disconnectLiveKit,
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
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${copy.title}\n\n${copy.message}`)) {
        runLeave()
      }
      return
    }
    Alert.alert(copy.title, copy.message, [
      { text: copy.cancelLabel, style: 'cancel' },
      {
        text: copy.confirmLabel,
        style: copy.willEndMeeting ? 'destructive' : 'default',
        onPress: runLeave,
      },
    ])
  }, [
    isAuthoritativeHost,
    presence.moderationSettings?.host_leave_behavior,
    presence.participants,
    runLeave,
    userId,
  ])

  useRegisterGlobalSession({
    active: !!liveKit && !exiting,
    kind: 'meeting',
    code: meeting.meeting_code,
    title: meeting.title || 'Meeting',
    subtitle: formatMeetingCode(meeting.meeting_code),
    maximizeHref: String(coWorkRoutes.meetingLive(meeting.meeting_code)),
    media: {
      audioEnabled: liveKit?.audioEnabled ?? true,
      videoEnabled: liveKit?.videoEnabled ?? false,
      screenSharing: liveKit?.screenSharing ?? false,
      speakerOn: liveKit?.speakerOn ?? true,
    },
    handlers: {
      toggleMic: () => {
        if (session.hasMedia()) session.toggleMic()
        else liveKit?.toggleAudio()
      },
      toggleCamera: () => {
        if (session.hasMedia()) session.toggleCamera()
        else liveKit?.toggleVideo()
      },
      toggleSpeaker: () => {
        void liveKit?.toggleSpeaker()
      },
      end: () => {
        handleLeave()
      },
      browseAway: () => {
        minimizeMeeting()
      },
      enterPip: async () => {
        enterMeetingPip()
      },
    },
  })

  useSessionPipOnHide(!!liveKit && !exiting)

  const handleEnd = useCallback(() => {
    if (!isAuthoritativeHost || exitingRef.current) return
    const copy = endMeetingConfirmCopy()
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${copy.title}\n\n${copy.message}`)) {
        runEndForEveryone()
      }
      return
    }
    Alert.alert(copy.title, copy.message, [
      { text: copy.cancelLabel, style: 'cancel' },
      {
        text: copy.confirmLabel,
        style: 'destructive',
        onPress: runEndForEveryone,
      },
    ])
  }, [isAuthoritativeHost, runEndForEveryone])

  const handleMuteAll = useCallback(() => {
    if (!isAuthoritativeHost) return
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
  }, [isAuthoritativeHost, presence, toast])

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

  const confirmRemoveParticipant = useCallback(
    (participantId: string) => {
      const remove = () => {
        void presence
          .remove(participantId)
          .then(() => toast.show('Participant removed', { tone: 'success' }))
          .catch((cause) =>
            toast.show('Could not remove participant', {
              tone: 'danger',
              message: cause instanceof Error ? cause.message : 'Please try again.',
            }),
          )
      }
      if (Platform.OS === 'web') {
        if (
          typeof window !== 'undefined' &&
          window.confirm('Remove this participant? They cannot rejoin until you allow them.')
        ) {
          remove()
        }
        return
      }
      Alert.alert(
        'Remove participant?',
        'They will be disconnected and cannot rejoin until you allow them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: remove,
          },
        ],
      )
    },
    [presence, toast],
  )

  const panelTop = chrome.panelTop
  // Meeting routes are chromeless (no app tab bar). Clear home indicator via chrome.
  const controlsBottom = Math.max(safeBottom, 0)
  const panelBottom = chrome.panelBottom
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
      {!chromeVisible && immersiveAutoHide ? (
        <YStack
          position={overlayPosition}
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={15}
          pointerEvents="auto"
          onPress={revealControls}
          accessibilityRole="button"
          accessibilityLabel="Show meeting controls"
        />
      ) : null}

      <YStack
        position={overlayPosition}
        top={0}
        left={0}
        right={0}
        zIndex={20}
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        opacity={chromeVisible ? 1 : 0}
        style={{
          transform: [{ translateY: chromeVisible ? 0 : -24 }],
        }}
      >
        <XStack
          paddingLeft={Math.max(safeLeft, roomy ? 20 : 12)}
          paddingRight={Math.max(safeRight, roomy ? 20 : 12)}
          paddingTop={safeTop > 0 ? safeTop : chrome.policy === 'landscape-phone' ? 6 : 12}
          paddingBottom={chrome.policy === 'landscape-phone' ? 6 : 10}
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
          borderBottomWidth={1}
          borderBottomColor={coworkUi.borderSoft}
          style={{
            ...coworkGlassStyle(coworkUi),
            ...controlGradientStyle(coworkGradients.header, coworkUi.surfaceElevated),
          }}
        >
          <XStack alignItems="center" gap="$2.5" flex={1} minWidth={0}>
            <YStack
              width={roomy ? 38 : 34}
              height={roomy ? 38 : 34}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={coworkUi.liveMuted}
              borderWidth={1}
              borderColor="rgba(52,211,153,0.35)"
            >
              <Icons.Shield size={roomy ? 18 : 16} color={coworkUi.live} />
            </YStack>
            <YStack gap={2} flex={1} minWidth={0}>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text
                  fontSize={roomy ? 18 : 15}
                  fontWeight="800"
                  color={coworkUi.text}
                  numberOfLines={1}
                  flexShrink={1}
                  letterSpacing={-0.3}
                >
                  {title}
                </Text>
                {recording ? (
                  <CoWorkStatusPill
                    label={
                      isAuthoritativeHost && recordingSession.isProcessing
                        ? 'Processing'
                        : 'REC'
                    }
                    tone={isAuthoritativeHost && recordingSession.isProcessing ? 'warning' : 'danger'}
                  />
                ) : null}
                {captions.active ? <CoWorkStatusPill label="CC" tone="brand" /> : null}
                {presence.handRaised ? <CoWorkStatusPill label="✋" tone="coral" /> : null}
                <MeetingRoleBadge role={presence.selfRole} />
                {liveKit ? (
                  <CoWorkStatusPill
                    label={connectionStatusLabel(liveKit.audioQuality.connectionStatus)}
                    tone={
                      liveKit.audioQuality.connectionStatus === 'excellent'
                        ? 'live'
                        : liveKit.audioQuality.connectionStatus === 'good'
                          ? 'brand'
                          : 'warning'
                    }
                  />
                ) : null}
              </XStack>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Button
                  tone="ghost"
                  size="$1"
                  height={22}
                  paddingHorizontal="$1.5"
                  borderRadius={8}
                  onPress={copyMeetingId}
                >
                  <Text fontSize={11} color={coworkUi.textMuted} fontWeight="600">
                    ID {formatMeetingCode(meeting.meeting_code)}
                  </Text>
                </Button>
                <Text fontSize={11} color={coworkUi.textMuted}>
                  · Encrypted
                </Text>
              </XStack>
            </YStack>
          </XStack>

          <XStack alignItems="center" gap="$1.5" flexShrink={0}>
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              backgroundColor="rgba(255,255,255,0.06)"
              color={coworkUi.text}
              icon={<Icons.Users size={14} color={coworkUi.text} />}
              onPress={() => presence.togglePanel('people')}
            >
              {admittedCount}
              {waitingCount > 0 && canModerate ? ` +${waitingCount}` : ''}
            </Button>
            <Button
              tone="outline"
              size="$2"
              width={36}
              height={36}
              padding={0}
              borderRadius={999}
              borderColor={presence.panel === 'info' ? coworkUi.borderAccent : coworkUi.glassBorder}
              backgroundColor={
                presence.panel === 'info' ? coworkUi.brandMuted : 'rgba(255,255,255,0.06)'
              }
              onPress={() => presence.togglePanel('info')}
              icon={
                <Icons.Info
                  size={16}
                  color={presence.panel === 'info' ? coworkUi.brandLight : coworkUi.text}
                />
              }
            />
            <Button
              tone="outline"
              size="$2"
              width={36}
              height={36}
              padding={0}
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              backgroundColor="rgba(255,255,255,0.06)"
              onPress={() => setShareOpen(true)}
              icon={<Icons.Share2 size={16} color={coworkUi.text} />}
            />
          </XStack>
        </XStack>

        {!isAuthoritativeHost && recordingIndicator.isRecording ? (
          <CoWorkAlertBanner
            tone="danger"
            message="This meeting is being recorded by the host."
          />
        ) : null}

        {presence.realtimeDegraded ? (
          <CoWorkAlertBanner
            tone="warning"
            message="Live updates paused — chat and participants refresh every few seconds."
            actionLabel="Reconnect"
            onAction={() => presence.retryRealtime()}
          />
        ) : null}

        {liveKit?.audioQuality.connectionStatus === 'reconnecting' ? (
          <CoWorkAlertBanner
            tone="warning"
            message="Audio connection interrupted — reconnecting automatically."
            actionLabel="Retry"
            onAction={() => void liveKit.audioQuality.retryConnection()}
          />
        ) : null}

        {liveKit?.audioQuality.error ? (
          <CoWorkAlertBanner
            tone="danger"
            message={liveKit.audioQuality.error}
            actionLabel="Audio settings"
            onAction={() => presence.setPanel('audio')}
          />
        ) : null}

        {showError ? (
          <CoWorkAlertBanner
            tone="danger"
            message={presence.error ?? ''}
            actionLabel="Dismiss"
            onAction={() => setDismissedError(presence.error)}
          />
        ) : null}
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

      <XStack
        position={overlayPosition}
        top={Math.max(safeTop, 8) + (chrome.policy === 'landscape-phone' ? 48 : roomy ? 68 : 64)}
        alignSelf="center"
        zIndex={19}
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        opacity={chromeVisible ? 1 : 0}
        gap="$1"
        padding="$1"
        borderRadius={999}
        borderWidth={1}
        borderColor={coworkUi.glassBorder}
        style={coworkGlassStyle(coworkUi)}
      >
        {(['gallery', 'speaker'] as const).map((viewMode) => (
          <Button
            key={viewMode}
            tone={meetingMachine.viewMode === viewMode ? 'primary' : 'ghost'}
            size="$1"
            borderRadius={999}
            onPress={() => dispatchUi({ type: 'SET_VIEW', viewMode })}
            aria-label={viewMode === 'gallery' ? 'Gallery view' : 'Speaker view'}
            aria-pressed={meetingMachine.viewMode === viewMode}
          >
            {viewMode === 'gallery'
              ? narrowPhone
                ? 'Grid'
                : 'Gallery'
              : 'Speaker'}
          </Button>
        ))}
        <Button
          tone={meetingMachine.viewMode === 'screen-share' ? 'primary' : 'ghost'}
          size="$1"
          borderRadius={999}
          onPress={() => dispatchUi({ type: 'SET_VIEW', viewMode: 'screen-share' })}
          aria-label="Screen share view"
          aria-pressed={meetingMachine.viewMode === 'screen-share'}
        >
          {narrowPhone ? 'Share' : 'Screen Share'}
        </Button>
        <Button
          tone={meetingMachine.uiMode === 'maximized' ? 'primary' : 'ghost'}
          size="$1"
          borderRadius={999}
          onPress={() => dispatchUi({ type: 'TOGGLE_UI_MODE' })}
          aria-label={meetingMachine.uiMode === 'maximized' ? 'Normal meeting view' : 'Maximize video'}
          aria-pressed={meetingMachine.uiMode === 'maximized'}
        >
          {meetingMachine.uiMode === 'maximized'
            ? narrowPhone
              ? 'Normal'
              : 'Normal view'
            : narrowPhone
              ? 'Max'
              : 'Maximize'}
        </Button>
        <Button
          tone={meetingMachine.mirrorLocalVideo ? 'primary' : 'ghost'}
          size="$1"
          borderRadius={999}
          onPress={() =>
            dispatchUi({
              type: 'SET_MIRROR_LOCAL_VIDEO',
              enabled: !meetingMachine.mirrorLocalVideo,
            })
          }
          aria-label="Mirror my video"
          aria-pressed={meetingMachine.mirrorLocalVideo}
        >
          {narrowPhone
            ? meetingMachine.mirrorLocalVideo
              ? 'Mirror ON'
              : 'Mirror OFF'
            : meetingMachine.mirrorLocalVideo
              ? 'Mirror my video: ON'
              : 'Mirror my video: OFF'}
        </Button>
      </XStack>

      <MeetingResponsivePanel
        open={!!liveKit && presence.panel === 'audio'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        {liveKit ? (
          <MeetingAudioPanel
            audio={liveKit.audioQuality}
            audioEnabled={liveKit.audioEnabled}
            speakerOn={liveKit.speakerOn}
            onToggleAudio={toggleMeetingAudio}
            onToggleSpeaker={() => void liveKit.toggleSpeaker()}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        ) : null}
      </MeetingResponsivePanel>

      <MeetingResponsivePanel
        open={!!liveKit && presence.panel === 'backgrounds'}
        onClose={() => presence.setPanel('none')}
        presentation={panelPresentation}
        top={panelTop}
        bottom={panelBottom}
        trailingInset={panelTrailingInset}
        width={sidePanelWidth}
        overlayPosition={overlayPosition}
      >
        {liveKit ? (
          <MeetingBackgroundPanel
            userId={userId}
            effects={liveKit.videoEffects}
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
      >
        <MeetingChatPanel
          messages={presence.chatMessages}
          participants={presence.participants}
          currentUserId={userId}
          viewerRole={presence.selfRole}
          participantDisplayNames={participantDisplayNames}
          chatEnabled={chatEnabled}
          privateChatEnabled={privateChatEnabled}
          canManageChat={canModerate}
          onSend={(text, audience, recipientId) =>
            void presence.sendChat(text, audience, recipientId)
          }
          onDelete={canModerate || chatEnabled ? (id) => void presence.deleteChat(id) : undefined}
          onClose={() => presence.setPanel('none')}
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
          participants={presence.participants}
          isHost={isAuthoritativeHost}
          viewerRole={isAuthoritativeHost ? 'host' : presence.selfRole}
          currentUserId={userId}
          isLocked={presence.moderationSettings?.is_locked}
          onAdmit={(id) => void presence.admit(id)}
          onReject={canModerate ? (id) => void presence.reject(id) : undefined}
          onAdmitAll={canModerate ? () => void presence.admitAllWaiting() : undefined}
          onRemove={canModerate ? confirmRemoveParticipant : undefined}
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
          onRemoveAllExceptHost={isAuthoritativeHost ? () => void presence.removeAllExceptHost() : undefined}
          onClose={() => presence.setPanel('none')}
          raisedHands={presence.raisedHands}
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
        lines={captions.visibleLines}
        error={captions.error}
        targetLang={captions.targetLang}
        targetLangName={captions.targetLangName}
        showingTranslation={captions.showingTranslation}
        availableLanguages={captions.availableLanguages}
        collapsed={captions.captionPreferences.collapsed}
        size={captions.captionPreferences.size}
        placement={captions.captionPreferences.placement}
        presentationSafe={
          meetingMachine.viewMode === 'screen-share' || !!liveKit?.screenSharing
        }
        wideLayout={chrome.captionWideLayout}
        topOffset={chrome.captionTopOffset}
        bottomOffset={chrome.captionBottomOffset}
        sideInset={chrome.captionSideInset}
        onTargetLangChange={(language) => {
          captions.setTargetLang(language)
        }}
        onCollapsedChange={captions.setCollapsed}
        onSizeChange={captions.setOverlaySize}
        onPlacementChange={captions.setPlacement}
      />

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
        pointerEvents="auto"
        style={
          chromeVisible
            ? footerFadeStyle(
                'linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.75) 55%)',
                'rgba(12, 8, 10, 0.92)',
              )
            : undefined
        }
      >
        {chromeVisible ? (
          <MeetingControls
            caps={{
              ...caps,
              supportsVideo: true,
              supportsScreenShare: supportsScreenBroadcast,
              supportsRecording: isAuthoritativeHost && allowRecording && !!liveKit,
              supportsLiveCaptions: true,
            }}
            audioEnabled={liveKit?.audioEnabled ?? true}
            videoEnabled={liveKit?.videoEnabled ?? false}
            screenSharing={liveKit?.screenSharing ?? false}
            handRaised={presence.handRaised}
            recording={recording}
            captionsActive={captions.active}
            isHost={isAuthoritativeHost}
            viewerRole={presence.selfRole}
            canModerate={canModerate}
            canChangeCriticalSettings={canChangeCriticalMeetingSettings(presence.selfRole)}
            isLocked={!!presence.moderationSettings?.is_locked}
            panel={presence.panel}
            backgroundActive={(liveKit?.videoEffects.selection.mode ?? 'off') !== 'off'}
            unreadChatCount={presence.unreadChatCount}
            forceCompact={chrome.compactControls}
            raisedHandCount={raisedHandCount}
            reactionTrayOpen={reactionTrayOpen}
            busy={exiting}
            onToggleAudio={toggleMeetingAudio}
            onOpenAudioSettings={liveKit ? () => presence.togglePanel('audio') : undefined}
            onToggleVideo={() => {
              if (!liveKit) {
                toast.show('Still connecting…', {
                  tone: 'info',
                  message: 'Wait a moment for the room to join, then try video again.',
                })
                return
              }
              void presence.syncMediaState({ is_video_off: liveKit.videoEnabled })
              liveKit.toggleVideo()
            }}
            onToggleBackgrounds={() => presence.togglePanel('backgrounds')}
            onToggleScreen={() => void toggleScreenShare()}
            onToggleHand={toggleHand}
            onToggleReactions={() => setReactionTrayOpen((open) => !open)}
            onSendReaction={sendReaction}
            onToggleRecord={toggleRecording}
            onToggleCaptions={toggleCaptions}
            onToggleChat={() => presence.togglePanel('chat')}
            onTogglePeople={() => presence.togglePanel('people')}
            onToggleInfo={() => presence.togglePanel('info')}
            onToggleInvite={() => {
              if (canModerate) presence.togglePanel('invite')
              else setShareOpen(true)
            }}
            onShare={() => setShareOpen(true)}
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
              isAuthoritativeHost ? () => void presence.removeAllExceptHost() : undefined
            }
            onToggleLock={isAuthoritativeHost ? handleToggleLock : undefined}
            onToggleFullscreen={Platform.OS === 'web' ? toggleFullscreen : undefined}
            fullscreenActive={fullscreen.active}
            onMinimize={minimizeMeeting}
            onPictureInPicture={enterMeetingPip}
            onLeave={handleLeave}
            onEnd={handleEnd}
          />
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
              icon={<Icons.ChevronUp size={16} color={coworkUi.text} />}
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

      <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting} />
      <MeetingTransferHostSheet
        open={transferHostOpen}
        onOpenChange={setTransferHostOpen}
        participants={presence.participants}
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
    </YStack>
  )
}
