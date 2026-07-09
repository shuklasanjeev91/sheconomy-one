import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ScreenCenter } from '~/components/layout'
import { Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkAlertBanner, CoWorkBrandChip, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { LiveKitMeetingRoom, type LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import { MeetingChatPanel } from '~/co-work/components/MeetingChatPanel'
import { MeetingControls } from '~/co-work/components/MeetingControls'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingParticipantsPanel } from '~/co-work/components/MeetingParticipantsPanel'
import { useMeetingPresence } from '~/co-work/hooks/useMeetingPresence'
import { getMediaCapabilities } from '~/co-work/lib/media'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
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
  const useLiveKit = Platform.OS === 'web' && !!props.meeting.room_id

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
  const router = useRouter()
  const toast = useAppToast()
  const { isMobile, safeTop } = useAppLayout()
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [meetingState, setMeetingState] = useState(meeting)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])

  const showError = presence.error && presence.error !== dismissedError
  const panelFullWidth = isMobile

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
    return () => {
      recorderRef.current?.stop()
      recorderRef.current = null
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (Platform.OS !== 'web') {
      toast.show('Recording is available on web', { tone: 'info' })
      return
    }

    if (!liveKit?.room) {
      toast.show('Connect to the meeting before recording', { tone: 'error' })
      return
    }

    if (recording) {
      recorderRef.current?.stop()
      return
    }

    const stream = new MediaStream()
    liveKit.room.localParticipant.trackPublications.forEach((publication) => {
      const track = publication.track?.mediaStreamTrack
      if (track) stream.addTrack(track)
    })

    if (stream.getTracks().length === 0) {
      toast.show('Turn on your camera or mic to record', { tone: 'error' })
      return
    }

    try {
      const recorder = new MediaRecorder(stream)
      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `sheconomy-${meeting.meeting_code}-${Date.now()}.webm`
        anchor.click()
        URL.revokeObjectURL(url)
        setRecording(false)
        recorderRef.current = null
        toast.show('Recording saved to your device', { tone: 'success' })
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      toast.show('Recording started', { tone: 'success' })
    } catch (recordError) {
      toast.show('Could not start recording', {
        tone: 'error',
        message: recordError instanceof Error ? recordError.message : undefined,
      })
    }
  }, [liveKit, meeting.meeting_code, recording, toast])

  const toggleScreenShare = useCallback(async () => {
    if (!liveKit) {
      if (Platform.OS !== 'web') {
        toast.show('Screen share works in the mobile browser meeting view', { tone: 'info' })
      }
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
            ...(Platform.OS === 'web' ? { backgroundImage: coworkGradients.header } : {}),
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

      <YStack
        position={overlayPosition}
        bottom={0}
        left={0}
        right={0}
        zIndex={30}
        pointerEvents="auto"
        style={
          Platform.OS === 'web'
            ? { background: 'linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.75) 55%)' }
            : undefined
        }
      >
        <MeetingControls
          caps={{
            ...caps,
            supportsVideo: !!liveKit || caps.supportsVideo,
            supportsScreenShare: !!liveKit || caps.supportsScreenShare || Platform.OS !== 'web',
            supportsRecording: isHost && (!!liveKit || caps.supportsRecording),
          }}
          audioEnabled={liveKit?.audioEnabled ?? true}
          videoEnabled={liveKit?.videoEnabled ?? false}
          screenSharing={liveKit?.screenSharing ?? false}
          handRaised={presence.handRaised}
          recording={recording}
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