import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKeepAwake } from 'expo-keep-awake'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { ScreenFill } from '~/components/layout'
import { getMeetingStageCss } from '~/co-work/components/meeting-stage-css'
import { MeetingLifecycleBanner } from '~/co-work/components/MeetingLifecycleBanner'
import { MediasoupVideoStage } from '~/co-work/components/MediasoupVideoStage.web'
import {
  useMediasoupMeeting,
  type MediasoupMeetingPlatform,
} from '~/co-work/hooks/useMediasoupMeeting'
import { useMeetingLifecycle } from '~/co-work/hooks/useMeetingLifecycle.web'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.web'
import type { MeetingRoomProps } from '~/co-work/lib/meeting-media-controls'
import type { MediasoupCredentials } from '~/co-work/lib/mediasoup/mediasoup-credentials'
import type { MediasoupRemotePeer } from '~/co-work/lib/mediasoup/mediasoup-room'
import { mediasoupViewingScreenShare } from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import {
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  mapWebScreenShareError,
  meetingWebUnsupportedMessage,
  unlockWebAudioPlayback,
} from '~/co-work/lib/meeting-web'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { pageGradientStyle } from '~/lib/platform/crossStyles'
import { meetingViewportStyle } from '~/lib/platform/viewport'

async function playWebTestTone() {
  const AudioContextCtor =
    typeof window !== 'undefined'
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined
  if (!AudioContextCtor) return
  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 660
  gain.gain.value = 0.08
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  await new Promise((resolve) => setTimeout(resolve, 450))
  oscillator.stop()
  await context.close().catch(() => {})
}

const WEB_PLATFORM: MediasoupMeetingPlatform = {
  native: false,
  initialSpeakerOn: true,
  useVideoEffects: useMeetingVideoEffects,
  errorMessage: (kind, cause) => {
    if (kind === 'screen_share') return mapWebScreenShareError(cause)
    if (kind === 'speaker') return 'Could not change the audio output.'
    return mapWebMediaPermissionError(kind, cause)
  },
  beforeMicEnable: async () => {
    const caps = detectMeetingWebCapabilities()
    if (!caps.secureContext) return meetingWebUnsupportedMessage('secure_context')
    if (!caps.getUserMedia) return meetingWebUnsupportedMessage('microphone')
    unlockWebAudioPlayback()
    return null
  },
  beforeScreenShare: async () => {
    const caps = detectMeetingWebCapabilities()
    if (!caps.secureContext) throw new Error(meetingWebUnsupportedMessage('secure_context'))
    if (!caps.getDisplayMedia) throw new Error(meetingWebUnsupportedMessage('screen_share'))
  },
  screenShareConstraints: (options) =>
    ({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 } },
      audio: !!options?.shareComputerSound,
      // Prefer another tab/window over the meeting page itself (blank recursion).
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      preferCurrentTab: false,
    }) as DisplayMediaStreamOptions,
  devices: {
    enumerate: async () => (await navigator.mediaDevices?.enumerateDevices?.()) ?? [],
    playTestTone: playWebTestTone,
  },
}

type SinkableAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }

function RemoteAudio({
  track,
  outputDeviceId,
  onBlocked,
}: {
  track: MediaStreamTrack
  outputDeviceId: string | null
  onBlocked: (blocked: boolean) => void
}) {
  const ref = useRef<SinkableAudio | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.srcObject = new MediaStream([track])
    node
      .play()
      .then(() => onBlocked(false))
      .catch(() => onBlocked(true))
    return () => {
      node.srcObject = null
    }
  }, [onBlocked, track])
  useEffect(() => {
    const node = ref.current
    if (!node || !outputDeviceId || typeof node.setSinkId !== 'function') return
    void node.setSinkId(outputDeviceId).catch(() => {})
  }, [outputDeviceId])
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} data-sheconomy-remote-audio />
}

/**
 * Browsers block audio playback until the page gets a user gesture; hosts who
 * arrive via navigation hit this most. Any tap or key replays every element.
 */
function useRemoteAudioUnlock() {
  const [audioBlocked, setAudioBlocked] = useState(false)
  const onBlocked = useCallback((blocked: boolean) => {
    if (blocked) setAudioBlocked(true)
  }, [])
  const unlockAudio = useCallback(() => {
    unlockWebAudioPlayback()
    const elements = document.querySelectorAll<HTMLAudioElement>('audio[data-sheconomy-remote-audio]')
    void Promise.all(Array.from(elements, (element) => element.play()))
      .then(() => setAudioBlocked(false))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!audioBlocked || typeof document === 'undefined') return
    const handler = () => unlockAudio()
    document.addEventListener('pointerdown', handler, { capture: true })
    document.addEventListener('keydown', handler, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', handler, { capture: true })
      document.removeEventListener('keydown', handler, { capture: true })
    }
  }, [audioBlocked, unlockAudio])
  return { audioBlocked, onBlocked, unlockAudio }
}

function remoteAudioTracks(peers: MediasoupRemotePeer[]) {
  return peers.flatMap((peer) =>
    [peer.audio, peer.screenAudio].flatMap((remote) =>
      remote ? [{ key: remote.consumerId, track: remote.track }] : [],
    ),
  )
}

export function MediasoupMeetingRoom({
  credentials,
  displayName,
  avatarUrl,
  mediaMode = 'meeting',
  initialAudio = true,
  initialVideo = true,
  onConnected,
  onDisconnected,
  onOpenParticipantProfile,
  overlay,
}: MeetingRoomProps & { credentials: MediasoupCredentials }) {
  // The web wake lock activates asynchronously; a fast remount releases it first.
  useKeepAwake('sheconomy-meeting-web', { suppressDeactivateWarnings: true })
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const meeting = useMediasoupMeeting({
    credentials,
    displayName,
    avatarUrl,
    mediaMode,
    initialAudio,
    initialVideo,
    onConnected,
    onDisconnected,
    platform: WEB_PLATFORM,
  })
  const { audioBlocked, onBlocked, unlockAudio } = useRemoteAudioUnlock()
  const audioTracks = useMemo(() => remoteAudioTracks(meeting.snapshot.peers), [meeting.snapshot.peers])
  const connection = meeting.snapshot.connection

  const viewingScreenShare = mediasoupViewingScreenShare(meeting.snapshot)
  const lifecycle = useMeetingLifecycle({
    room: meeting.room,
    connection,
    mediaMode,
    screenSharing: meeting.snapshot.local.screenSharing,
    viewingScreenShare,
    cameraEnabled: meeting.snapshot.local.cameraEnabled,
    onForegroundAudio: unlockAudio,
  })

  const lifecycleNotice =
    lifecycle.notice ?? (connection === 'connecting' ? 'Connecting audio and video…' : null)

  return (
    <ScreenFill
      backgroundColor={coworkUi.pageBg}
      position="relative"
      style={{ ...meetingViewportStyle(), ...pageGradientStyle(coworkGradients.page, coworkUi.pageBg) }}
    >
      <YStack flex={1} width="100%" height="100%" position="relative" style={{ minHeight: 0, overflow: 'hidden' }}>
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          className="sheconomy-media-room"
          pointerEvents="none"
        >
          {mediaMode === 'audio' ? null : (
            <MediasoupVideoStage
              meeting={meeting}
              onOpenParticipantProfile={onOpenParticipantProfile}
            />
          )}
          {audioTracks.map(({ key, track }) => (
            <RemoteAudio
              key={key}
              track={track}
              outputDeviceId={meeting.outputDeviceId}
              onBlocked={onBlocked}
            />
          ))}
        </YStack>
        <MeetingLifecycleBanner notice={lifecycleNotice} topOffset={80} />
        {audioBlocked ? (
          <XStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            zIndex={400}
            alignItems="center"
            justifyContent="center"
            gap="$3"
            paddingVertical="$2.5"
            paddingHorizontal="$4"
            backgroundColor="rgba(24, 24, 24, 0.96)"
            borderBottomWidth={1}
            borderBottomColor="rgba(255,255,255,0.12)"
            cursor="pointer"
            pointerEvents="auto"
            onPress={unlockAudio}
            role="button"
            aria-label="Join computer audio"
          >
            <Icons.Volume2 size={16} color="#fff" />
            <Text fontSize={13} fontWeight="600" color="#fff" flexShrink={1}>
              Click Join Audio to hear others
            </Text>
            <XStack paddingHorizontal="$3" paddingVertical="$1.5" borderRadius={8} backgroundColor="#0E72ED">
              <Text fontSize={13} fontWeight="800" color="#fff">
                Join Audio
              </Text>
            </XStack>
          </XStack>
        ) : null}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          className="sheconomy-meeting-overlay"
          pointerEvents="box-none"
        >
          {overlay?.(meeting.media)}
        </YStack>
      </YStack>
      <style>{getMeetingStageCss(coworkUi, coworkShadows)}</style>
    </ScreenFill>
  )
}
