// Keep first: `livekit-client` extends DOMException while it evaluates, and a
// universal link can make this the very first screen module Hermes loads.
import '~/lib/polyfills/install-dom-exception'

import { Alert, Platform } from 'react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RoomEvent } from 'livekit-client'

import { ShareSheet } from '~/components/share'
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
import { MeetingWaitingRoom } from '~/co-work/components/MeetingWaitingRoom'
import { MeetingWaitingRoomRequests } from '~/co-work/components/MeetingWaitingRoomRequests'
import { useLiveCaptions } from '~/co-work/hooks/useLiveCaptions'
import {
  useMeetingRecording,
  useMeetingRecordingIndicator,
} from '~/co-work/hooks/useMeetingRecording'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import { connectionStatusLabel } from '~/co-work/lib/meeting-audio-quality'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { buildMeetingSharePayload } from '~/co-work/lib/meeting-share'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, footerFadeStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'
import { navigateApp } from '~/lib/platform/navigate'
import { coWorkRoutes } from '~/lib/routes'
import { copyShareLink } from '~/lib/share'

const MUTE_ALL_DATA_TOPIC = 'sheconomy.mute-all'

function encodeMuteAllPayload(from: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ type: MUTE_ALL_DATA_TOPIC, from }))
}

function decodeMuteAllPayload(payload: Uint8Array): { from?: string } | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; from?: string }
    if (parsed?.type !== MUTE_ALL_DATA_TOPIC) return null
    return { from: parsed.from }
  } catch {
    return null
  }
}

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
  const { ui: coworkUi } = useCoWorkTheme()
  const presence = useMeetingPresence({
    meeting: props.meeting,
    userId: props.userId,
    isHost: props.isHost,
    enabled: true,
  })

  const title = useMemo(() => props.meeting.title, [props.meeting.title])
  const caps = useMemo(() => getMediaCapabilities(), [])
  const useLiveKit = supportsLiveKitVideo() && !!props.meeting.room_id
  const [mediaReconnectFailed, setMediaReconnectFailed] = useState(false)
  const [mediaReconnectKey, setMediaReconnectKey] = useState(0)
  const handleMediaDisconnected = useCallback(() => setMediaReconnectFailed(true), [])

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
  isHost,
  onLeave,
  presence,
  caps,
  title,
  liveKit,
}: MeetingRoomScreenProps & {
  presence: PresenceState
  caps: MediaCaps
  title: string
  liveKit?: LiveKitMediaControls
}) {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const toast = useAppToast()
  const { isMobile, isTablet, isDesktop, safeTop } = useAppLayout()
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [meetingState, setMeetingState] = useState(meeting)
  const [shareOpen, setShareOpen] = useState(false)
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const exitingRef = useRef(false)

  const allowRecording = meeting.security_settings?.allowRecording !== false
  const autoRecord = !!meeting.meeting_options?.autoRecord && isHost && allowRecording
  const admittedCount = presence.participants.filter((p) => p.status === 'admitted').length
  const waitingCount = presence.waitingParticipants.length
  const roomy = isTablet || isDesktop
  const narrowPhone = isMobile && !isTablet && !isDesktop

  const captions = useLiveCaptions({
    userId,
    displayName,
    enabled: true,
    remoteCaptions: presence.liveCaptions,
    onFinalCaption: (text, sourceLang) =>
      presence.broadcastCaption(text, displayName, sourceLang),
  })

  const recordingSession = useMeetingRecording({
    room: liveKit?.room,
    meetingId: meeting.id,
    meetingCode: meeting.meeting_code,
    enabled: allowRecording && isHost,
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
    allowRecording && !isHost,
  )

  const showError = presence.error && presence.error !== dismissedError
  // Full-bleed side panels only on phones — tablets keep a Zoom-style right dock.
  const panelFullWidth = narrowPhone
  const recording = isHost
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
    })

    const onData = (payload: Uint8Array, participant?: { identity?: string }) => {
      const decoded = decodeMuteAllPayload(payload)
      if (!decoded) return
      if (participant?.identity === liveKit.localParticipant.identity) return
      if (decoded.from === userId) return
      applyRemoteMuteAll()
    }

    liveKit.room.on(RoomEvent.DataReceived, onData)
    return () => {
      liveKit.room.off(RoomEvent.DataReceived, onData)
      presence.registerMediaHandlers({})
    }
  }, [liveKit, presence.registerMediaHandlers, presence.syncMediaState, userId])

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
    if (!isHost) {
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
  }, [allowRecording, isHost, recordingSession, toast])

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
    if (!caps.supportsScreenShare) {
      toast.show('Screen share is not available on this device', {
        tone: 'info',
        message:
          Platform.OS === 'android'
            ? 'Present from iPhone, iPad, or the website. Android meetings can still view a shared screen.'
            : Platform.OS === 'web'
              ? 'Use Chrome or Edge, or update your browser to enable screen sharing.'
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
              : undefined,
      })
    } catch (screenError) {
      const message =
        screenError instanceof Error
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
  }, [caps.supportsScreenShare, liveKit, toast])

  const toggleHand = useCallback(() => {
    const raising = !presence.handRaised
    presence.toggleHandRaise()
    toast.show(raising ? 'Hand raised' : 'Hand lowered', {
      tone: 'success',
      message: raising ? 'Others can see your raised hand on your tile' : undefined,
    })
  }, [presence, toast])

  const toggleMeetingAudio = useCallback(() => {
    if (!liveKit) {
      toast.show('Still connecting…', {
        tone: 'info',
        message: 'Wait a moment for the room to join, then try mute again.',
      })
      return
    }
    void presence.syncMediaState({ is_muted: liveKit.audioEnabled })
    liveKit.toggleAudio()
  }, [liveKit, presence, toast])

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

  const disconnectLiveKit = useCallback(() => {
    const room = liveKit?.room
    if (!room) return
    try {
      room.disconnect(true)
    } catch {
      // Room may already be tearing down.
    }
  }, [liveKit?.room])

  const handleMuteAll = useCallback(() => {
    if (!isHost) return
    const signaled = presence.muteAll()
    let published = false
    if (liveKit?.room) {
      try {
        void liveKit.room.localParticipant.publishData(encodeMuteAllPayload(userId), {
          reliable: true,
        })
        published = true
      } catch {
        published = false
      }
    }
    if (signaled || published) {
      toast.show('Mute all sent', {
        tone: 'success',
        message: 'Participants will be asked to mute their microphones.',
      })
      return
    }
    toast.show('Could not mute all', {
      tone: 'danger',
      message: 'Live updates are disconnected. Reconnect and try again.',
    })
  }, [isHost, liveKit?.room, presence, toast, userId])

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

  const handleLeave = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    void (async () => {
      try {
        if (isHost && recordingSession.recording) {
          await withTimeout(recordingSession.stopRecording(), 4000)
        }
        disconnectLiveKit()
        await withTimeout(presence.leave(), 4000)
      } finally {
        exitToCoWork()
      }
    })()
  }, [
    disconnectLiveKit,
    exitToCoWork,
    isHost,
    presence,
    recordingSession,
  ])

  const handleEnd = useCallback(() => {
    if (!isHost || exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    void (async () => {
      try {
        if (recordingSession.recording) {
          await withTimeout(recordingSession.stopRecording(), 4000)
        }
        disconnectLiveKit()
        await withTimeout(presence.hostEnd(), 4000)
      } finally {
        exitToCoWork()
      }
    })()
  }, [disconnectLiveKit, exitToCoWork, isHost, presence, recordingSession])

  const panelTop = roomy ? 92 : 96
  // Meeting routes are chromeless (no app tab bar). Only clear the home indicator.
  const controlsBottom = 0
  const panelBottom = 100
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
      <YStack position={overlayPosition} top={0} left={0} right={0} zIndex={20} pointerEvents="auto">
        <XStack
          paddingHorizontal={roomy ? '$5' : '$3'}
          paddingTop={safeTop > 0 ? safeTop : '$3'}
          paddingBottom="$2.5"
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
                      isHost && recordingSession.isProcessing
                        ? 'Processing'
                        : 'REC'
                    }
                    tone={isHost && recordingSession.isProcessing ? 'warning' : 'danger'}
                  />
                ) : null}
                {captions.active ? <CoWorkStatusPill label="CC" tone="brand" /> : null}
                {presence.handRaised ? <CoWorkStatusPill label="✋" tone="coral" /> : null}
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
              {waitingCount > 0 && isHost ? ` +${waitingCount}` : ''}
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

        {!isHost && recordingIndicator.isRecording ? (
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
        {isHost && presence.waitingParticipants.length > 0 ? (
          <MeetingWaitingRoomRequests
            participants={presence.waitingParticipants}
            onAdmit={presence.admit}
            onReject={presence.reject}
            onAdmitAll={presence.admitAllWaiting}
            onReview={() => presence.setPanel('people')}
          />
        ) : null}
      </YStack>

      {liveKit && presence.panel === 'audio' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingAudioPanel
            audio={liveKit.audioQuality}
            audioEnabled={liveKit.audioEnabled}
            speakerOn={liveKit.speakerOn}
            onToggleAudio={toggleMeetingAudio}
            onToggleSpeaker={() => void liveKit.toggleSpeaker()}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {liveKit && presence.panel === 'backgrounds' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingBackgroundPanel
            userId={userId}
            effects={liveKit.videoEffects}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {presence.panel === 'chat' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingChatPanel
            messages={presence.chatMessages}
            currentUserId={userId}
            onSend={(text) => void presence.sendChat(text)}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {presence.panel === 'people' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingParticipantsPanel
            participants={presence.participants}
            isHost={isHost}
            onAdmit={(id) => void presence.admit(id)}
            onReject={isHost ? (id) => void presence.reject(id) : undefined}
            onAdmitAll={isHost ? () => void presence.admitAllWaiting() : undefined}
            onRemove={isHost ? confirmRemoveParticipant : undefined}
            onAllowRejoin={
              isHost
                ? (id) =>
                    void presence
                      .allowRejoin(id)
                      .then(() => toast.show('Participant may request to rejoin', { tone: 'success' }))
                : undefined
            }
            onClose={() => presence.setPanel('none')}
            raisedHands={presence.raisedHands}
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {presence.panel === 'info' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingInfoPanel
            meeting={meetingState}
            participantCount={admittedCount}
            isHost={isHost}
            onClose={() => presence.setPanel('none')}
            onInvite={
              isHost
                ? () => {
                    presence.setPanel('invite')
                  }
                : undefined
            }
            onOpenRecordings={
              isHost && allowRecording
                ? () => {
                    presence.setPanel('recordings')
                  }
                : undefined
            }
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {isHost && presence.panel === 'recordings' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingRecordingsPanel
            meetingId={meeting.id}
            meetingTitle={title}
            isHost={isHost}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
          />
        </YStack>
      ) : null}

      {isHost && presence.panel === 'invite' ? (
        <YStack
          position={overlayPosition}
          top={panelTop}
          right={panelFullWidth ? 0 : 12}
          left={panelFullWidth ? 0 : undefined}
          bottom={panelBottom}
          zIndex={25}
          pointerEvents="auto"
        >
          <MeetingInvitePanel
            meeting={meetingState}
            hostId={userId}
            hostName={displayName}
            onClose={() => presence.setPanel('none')}
            fullWidth={panelFullWidth}
            onInviteesUpdated={(invitees) => setMeetingState((current) => ({ ...current, invitees }))}
          />
        </YStack>
      ) : null}

      <MeetingLiveCaptions
        active={captions.active}
        currentCaption={captions.currentCaption}
        lines={captions.visibleLines}
        error={captions.error}
        targetLangName={captions.targetLangName}
        showingTranslation={captions.showingTranslation}
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
        zIndex={30}
        pointerEvents="auto"
        style={footerFadeStyle(
          'linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.75) 55%)',
          'rgba(12, 8, 10, 0.92)',
        )}
      >
        <MeetingControls
          caps={{
            ...caps,
            supportsVideo: true,
            supportsScreenShare: Platform.OS !== 'android',
            supportsRecording: isHost && allowRecording && !!liveKit,
            supportsLiveCaptions: true,
          }}
          audioEnabled={liveKit?.audioEnabled ?? true}
          videoEnabled={liveKit?.videoEnabled ?? false}
          screenSharing={liveKit?.screenSharing ?? false}
          handRaised={presence.handRaised}
          recording={recording}
          captionsActive={captions.active}
          isHost={isHost}
          panel={presence.panel}
          backgroundActive={(liveKit?.videoEffects.selection.mode ?? 'off') !== 'off'}
          unreadChatCount={presence.unreadChatCount}
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
          onToggleInvite={isHost ? () => presence.togglePanel('invite') : undefined}
          onShare={() => setShareOpen(true)}
          onMuteAll={isHost ? handleMuteAll : undefined}
          onLeave={handleLeave}
          onEnd={handleEnd}
        />
      </YStack>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share meeting"
        copyLabel="Copy meeting link"
        copyToastMessage="Meeting link copied to clipboard."
        payload={buildMeetingSharePayload(meeting)}
      />
    </YStack>
  )
}
