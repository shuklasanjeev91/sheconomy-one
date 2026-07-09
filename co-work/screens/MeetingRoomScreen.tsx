import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ScreenCenter } from '~/components/layout'
import { Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkAlertBanner, CoWorkBrandChip, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { LiveKitMeetingRoom, type LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import { MeetingChatPanel } from '~/co-work/components/MeetingChatPanel'
import { MeetingControls } from '~/co-work/components/MeetingControls'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingLiveCaptions } from '~/co-work/components/MeetingLiveCaptions'
import { MeetingParticipantsPanel } from '~/co-work/components/MeetingParticipantsPanel'
import { useLiveCaptions } from '~/co-work/hooks/useLiveCaptions'
import { useMeetingRecording } from '~/co-work/hooks/useMeetingRecording'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, footerFadeStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'
import { coWorkRoutes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

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
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
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
        <Text fontSize={24} fontWeight="800" color={coworkUi.text}>
          Waiting for the host to let you in
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center">
          You&apos;ll join {title} as soon as the host admits you.
        </Text>
        <Text color={coworkUi.textMuted}>Code: {formatMeetingCode(props.meeting.meeting_code)}</Text>
      </ScreenCenter>
    )
  }

  return (
    <LiveKitMeetingRoom
      meetingId={props.meeting.id}
      roomId={props.meeting.room_id ?? ''}
      displayName={props.displayName}
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
  const { isMobile, safeTop } = useAppLayout()
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [meetingState, setMeetingState] = useState(meeting)

  const allowRecording = meeting.security_settings?.allowRecording !== false
  const autoRecord = !!meeting.meeting_options?.autoRecord && isHost && allowRecording

  const captions = useLiveCaptions({
    userId,
    displayName,
    enabled: true,
    remoteCaptions: presence.liveCaptions,
    onFinalCaption: (text) => presence.broadcastCaption(text, displayName),
  })

  const recordingSession = useMeetingRecording({
    room: liveKit?.room,
    meetingCode: meeting.meeting_code,
    enabled: allowRecording && isHost,
    autoStart: autoRecord,
    captionLines: captions.transcriptLines,
    onStarted: () => toast.show('Recording started', { tone: 'success' }),
    onStopped: () => toast.show('Recording saved to your device', { tone: 'success' }),
    onError: (message) => toast.show(message, { tone: 'error' }),
  })

  const showError = presence.error && presence.error !== dismissedError
  const panelFullWidth = isMobile
  const recording = recordingSession.recording

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

  const toggleRecording = useCallback(() => {
    if (!allowRecording) {
      toast.show('Recording is disabled for this meeting', { tone: 'info' })
      return
    }
    if (!isHost) {
      toast.show('Only the host can record this meeting', { tone: 'info' })
      return
    }
    recordingSession.toggleRecording()
  }, [allowRecording, isHost, recordingSession, toast])

  const toggleCaptions = useCallback(() => {
    if (!captions.supported) {
      toast.show('Live captions are not available on this device', { tone: 'info' })
      return
    }
    const turningOn = !captions.active
    captions.toggleCaptions()
    if (turningOn && !captions.canPublish) {
      toast.show('Viewing live captions from the meeting', { tone: 'success' })
      return
    }
    toast.show(turningOn ? 'Live captions on' : 'Live captions off', { tone: 'success' })
  }, [captions, toast])

  const toggleScreenShare = useCallback(async () => {
    if (!liveKit) {
      toast.show('Connect to the meeting to share your screen', { tone: 'info' })
      return
    }

    try {
      liveKit.toggleScreenShare()
    } catch (screenError) {
      toast.show('Screen share failed', {
        tone: 'error',
        message: screenError instanceof Error ? screenError.message : undefined,
      })
    }
  }, [liveKit, toast])

  const toggleHand = useCallback(() => {
    const raising = !presence.handRaised
    presence.toggleHandRaise()
    toast.show(raising ? 'Hand raised — visible in People panel' : 'Hand lowered', { tone: 'success' })
  }, [presence, toast])

  const panelTop = isMobile ? 96 : 88
  const panelBottom = isMobile ? 128 : 112
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
          paddingHorizontal="$4"
          paddingTop={safeTop > 0 ? safeTop : '$3'}
          paddingBottom="$3"
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth={1}
          borderBottomColor={coworkUi.borderSoft}
          style={{
            ...coworkGlassStyle(coworkUi),
            ...controlGradientStyle(coworkGradients.header, coworkUi.surfaceElevated),
          }}
        >
          <YStack gap={4} flex={1}>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <CoWorkBrandChip />
              <Text
                fontSize={isMobile ? 16 : 18}
                fontWeight="800"
                color={coworkUi.text}
                numberOfLines={1}
                flexShrink={1}
                letterSpacing={-0.4}
              >
                {title}
              </Text>
              {presence.handRaised ? <CoWorkStatusPill label="✋ Hand raised" tone="coral" /> : null}
              {recording ? <CoWorkStatusPill label="● Recording" tone="danger" /> : null}
              {captions.active ? <CoWorkStatusPill label="CC" tone="brand" /> : null}
              {liveKit ? <CoWorkStatusPill label="Live" tone="live" /> : null}
            </XStack>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text fontSize={11} color={coworkUi.textMuted} fontWeight="600">
                {formatMeetingCode(meeting.meeting_code)}
              </Text>
              <Text fontSize={11} color={coworkUi.textMuted}>
                ·
              </Text>
              <Text fontSize={11} color={coworkUi.textMuted}>
                {presence.participants.filter((p) => p.status === 'admitted').length} in room
              </Text>
              {liveKit ? (
                <>
                  <Text fontSize={11} color={coworkUi.textMuted}>
                    ·
                  </Text>
                  <Text fontSize={11} color={coworkUi.brandLight} fontWeight="600">
                    {BRAND_NAME} SFU
                  </Text>
                </>
              ) : null}
            </XStack>
          </YStack>
        </XStack>

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
      />

      <YStack
        position={overlayPosition}
        bottom={0}
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
            supportsRecording: isHost && allowRecording && (caps.supportsRecording || !!liveKit),
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
          onToggleRecord={toggleRecording}
          onToggleCaptions={toggleCaptions}
          onToggleChat={() => presence.togglePanel('chat')}
          onTogglePeople={() => presence.togglePanel('people')}
          onToggleInvite={isHost ? () => presence.togglePanel('invite') : undefined}
          onMuteAll={isHost ? () => presence.muteAll() : undefined}
          onLeave={() => {
            void presence.leave()
            router.replace(coWorkRoutes.home)
          }}
          onEnd={() => {
            void presence.hostEnd()
            router.replace(coWorkRoutes.home)
          }}
        />
      </YStack>
    </YStack>
  )
}