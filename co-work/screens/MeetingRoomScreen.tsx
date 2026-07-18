import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ShareSheet } from '~/components/share'
import { ScreenCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkAlertBanner, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { LiveKitMeetingRoom, type LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import { MeetingChatPanel } from '~/co-work/components/MeetingChatPanel'
import { MeetingControls } from '~/co-work/components/MeetingControls'
import { MeetingInfoPanel } from '~/co-work/components/MeetingInfoPanel'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingLiveCaptions } from '~/co-work/components/MeetingLiveCaptions'
import { MeetingLiveSignalsProvider } from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingParticipantsPanel } from '~/co-work/components/MeetingParticipantsPanel'
import { MeetingReactionsOverlay } from '~/co-work/components/MeetingReactionsOverlay'
import { MeetingRecordingsPanel } from '~/co-work/components/MeetingRecordingsPanel'
import { useLiveCaptions } from '~/co-work/hooks/useLiveCaptions'
import {
  useMeetingRecording,
  useMeetingRecordingIndicator,
} from '~/co-work/hooks/useMeetingRecording'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { formatMeetingCode, getMeetingShareUrl } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, footerFadeStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'
import { coWorkRoutes } from '~/lib/routes'
import { copyShareLink } from '~/lib/share'

type MeetingRoomScreenProps = {
  meeting: Meeting
  userId: string
  displayName: string
  avatarUrl?: string | null
  isHost: boolean
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

  if (presence.isWaiting) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
        <YStack
          width={56}
          height={56}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={coworkUi.brandMuted}
          borderWidth={1}
          borderColor={coworkUi.borderAccent}
        >
          <Icons.Shield size={24} color={coworkUi.brandLight} />
        </YStack>
        <Text fontSize={24} fontWeight="800" color={coworkUi.text} textAlign="center">
          Waiting for the host to let you in
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center">
          You&apos;ll join {title} as soon as the host admits you.
        </Text>
        <Text color={coworkUi.textMuted}>Meeting ID: {formatMeetingCode(props.meeting.meeting_code)}</Text>
      </ScreenCenter>
    )
  }

  return (
    <MeetingLiveSignalsProvider
      localUserId={props.userId}
      handRaised={presence.handRaised}
      raisedHands={presence.raisedHands}
    >
      <LiveKitMeetingRoom
        meetingId={props.meeting.id}
        roomId={props.meeting.room_id ?? ''}
        displayName={props.displayName}
        avatarUrl={props.avatarUrl}
        isHost={props.isHost}
        enabled={!presence.isWaiting}
        onDisconnected={() => {
          void presence.leave()
        }}
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

function MeetingRoomOverlay({
  meeting,
  userId,
  displayName,
  isHost,
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
  const router = useRouter()
  const toast = useAppToast()
  const { isMobile, isTablet, isDesktop, safeTop } = useAppLayout()
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [meetingState, setMeetingState] = useState(meeting)
  const [shareOpen, setShareOpen] = useState(false)
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false)

  const allowRecording = meeting.security_settings?.allowRecording !== false
  const autoRecord = !!meeting.meeting_options?.autoRecord && isHost && allowRecording
  const shareUrl = getMeetingShareUrl(meeting.meeting_code)
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
    onError: (message) => toast.show(message, { tone: 'danger' }),
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
    presence.registerMediaHandlers({
      onMuteAll: () => {
        if (liveKit.audioEnabled) {
          void presence.syncMediaState({ is_muted: true })
          liveKit.toggleAudio()
        }
      },
    })
    return () => presence.registerMediaHandlers({})
  }, [liveKit, presence.registerMediaHandlers, presence.syncMediaState])

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
          Platform.OS === 'web'
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

        {showError ? (
          <CoWorkAlertBanner
            tone="danger"
            message={presence.error ?? ''}
            actionLabel="Dismiss"
            onAction={() => setDismissedError(presence.error)}
          />
        ) : null}
      </YStack>

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
            onAdmitAll={isHost ? () => void presence.admitAllWaiting() : undefined}
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
            supportsVideo: !!liveKit || caps.supportsVideo,
            supportsScreenShare: !!liveKit || caps.supportsScreenShare,
            supportsRecording: isHost && allowRecording && !!liveKit,
            supportsLiveCaptions: caps.supportsLiveCaptions,
          }}
          audioEnabled={liveKit?.audioEnabled ?? true}
          videoEnabled={liveKit?.videoEnabled ?? false}
          screenSharing={liveKit?.screenSharing ?? false}
          handRaised={presence.handRaised}
          recording={recording}
          captionsActive={captions.active}
          isHost={isHost}
          panel={presence.panel}
          unreadChatCount={presence.unreadChatCount}
          raisedHandCount={raisedHandCount}
          reactionTrayOpen={reactionTrayOpen}
          onToggleAudio={() => {
            if (!liveKit) return
            void presence.syncMediaState({ is_muted: liveKit.audioEnabled })
            liveKit.toggleAudio()
          }}
          onToggleVideo={() => {
            if (!liveKit) return
            void presence.syncMediaState({ is_video_off: liveKit.videoEnabled })
            liveKit.toggleVideo()
          }}
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
          onMuteAll={isHost ? () => presence.muteAll() : undefined}
          onLeave={() => {
            void (async () => {
              if (isHost && recordingSession.recording) {
                await recordingSession.stopRecording()
              }
              await presence.leave()
              router.replace(coWorkRoutes.home)
            })()
          }}
          onEnd={() => {
            void (async () => {
              if (recordingSession.recording) {
                await recordingSession.stopRecording()
              }
              await presence.hostEnd()
              router.replace(coWorkRoutes.home)
            })()
          }}
        />
      </YStack>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share meeting"
        copyLabel="Copy meeting link"
        copyToastMessage="Meeting link copied to clipboard."
        payload={{
          url: shareUrl,
          title: meeting.title,
        }}
      />
    </YStack>
  )
}
