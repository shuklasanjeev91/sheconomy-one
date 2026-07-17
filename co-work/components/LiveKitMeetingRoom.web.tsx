import { useCallback, useEffect, useState } from 'react'
import { ConnectionState, RoomEvent, type Room } from 'livekit-client'

import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { MeetingVideoStage } from '~/co-work/components/MeetingVideoStage'
import { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import { buildParticipantMetadata } from '~/co-work/lib/participant-avatar'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { bindRemoteScreenShareQuality } from '~/co-work/lib/livekit-screen-share'
import type { LiveKitMediaControls, LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'
import { useCoWorkTheme, type CoWorkShadows, type CoWorkUiTokens } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { pageGradientStyle } from '~/lib/platform/crossStyles'
import { meetingViewportStyle } from '~/lib/platform/viewport'

export type { LiveKitMediaControls, LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'
export { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'

function getSheconomyLivekitCss(ui: CoWorkUiTokens, shadows: CoWorkShadows) {
  return `
  .sheconomy-livekit-room {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 100%;
    pointer-events: none;
  }
  .sheconomy-video-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #0c080a;
    padding: 88px 12px 112px;
    box-sizing: border-box;
  }
  .sheconomy-video-gallery {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 10px;
    box-sizing: border-box;
    align-items: stretch;
    justify-items: stretch;
  }
  .sheconomy-video-gallery--solo {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }
  .sheconomy-video-gallery--solo .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    flex: 1;
  }
  .sheconomy-video-pip {
    position: absolute;
    right: 20px;
    bottom: 120px;
    width: min(28vw, 240px);
    aspect-ratio: 16 / 9;
    z-index: 15;
    border-radius: ${ui.radius.tile}px;
    overflow: hidden;
    border: 1px solid ${ui.glassBorder};
    box-shadow: ${shadows.tile};
    background: ${ui.tileBg};
    pointer-events: auto;
  }
  .sheconomy-video-pip .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    border-radius: ${ui.radius.tile}px;
  }
  @media (max-width: 768px) {
    .sheconomy-video-pip {
      width: min(40vw, 148px);
      right: 12px;
      bottom: 112px;
    }
  }
  .sheconomy-participant-tile.lk-participant-tile {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-radius: ${ui.radius.tile}px;
    border: 1px solid ${ui.glassBorder};
    background: ${ui.tileBg};
    overflow: hidden;
    box-shadow: ${shadows.tile};
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .sheconomy-participant-tile video,
  .sheconomy-participant-tile .lk-video-track {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center center;
    background: #0c080a;
  }
  .sheconomy-participant-tile[data-lk-source='screen_share'] video,
  .sheconomy-participant-tile[data-lk-source='screen_share'] .lk-video-track,
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] video {
    object-fit: contain !important;
    background: #0c080a;
  }
  .sheconomy-video-gallery--screen {
    display: flex;
    align-items: stretch;
    justify-content: center;
  }
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
  }
  .sheconomy-video-gallery .lk-participant-placeholder {
    background: #1a1216;
  }
  .sheconomy-participant-tile .lk-participant-placeholder[data-camera-off='true'] {
    opacity: 1;
  }
  .sheconomy-participant-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
  }
  .sheconomy-participant-avatar-wrap .sheconomy-participant-avatar-label,
  .sheconomy-participant-avatar-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
  }
  .sheconomy-participant-tile.lk-participant-tile[data-lk-speaking='true'] {
    border-color: ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow}, ${shadows.tile};
  }
  .sheconomy-hand-raised {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: rgba(12, 8, 10, 0.78);
    border: 1px solid ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow};
  }
  .sheconomy-hand-raised-inline {
    margin-left: 6px;
  }
  .sheconomy-participant-tile .lk-participant-metadata {
    background: linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.88) 100%);
    padding: 12px 14px;
    backdrop-filter: blur(8px);
  }
  .sheconomy-participant-tile .lk-participant-metadata-item {
    color: ${ui.text};
    font-size: 12px;
    font-weight: 600;
  }
  .sheconomy-participant-tile .lk-focus-toggle-button,
  .sheconomy-participant-tile .lk-connection-quality {
    display: none !important;
  }
  .sheconomy-video-gallery .lk-pagination-control,
  .sheconomy-video-gallery .lk-pagination-indicator {
    color: ${ui.textSecondary};
  }
  .sheconomy-livekit-room .lk-control-bar,
  .sheconomy-livekit-room .lk-chat-toggle,
  .sheconomy-livekit-room .lk-settings-toggle,
  .sheconomy-livekit-room .lk-disconnect-button,
  .sheconomy-livekit-room .lk-button-group-menu,
  .sheconomy-livekit-room .lk-video-conference {
    display: none !important;
  }
  .sheconomy-meeting-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`
}

export function LiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  avatarUrl,
  enabled,
  mediaMode = 'meeting',
  onDisconnected,
  overlay,
}: LiveKitMeetingRoomProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof fetchLiveKitCredentials>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supportsLiveKitVideo() || !enabled) return
    void fetchLiveKitConfig().then(setConfig)
  }, [enabled])

  const loadCredentials = useCallback(async () => {
    if (!enabled || !roomId) return
    setLoading(true)
    setError(null)
    try {
      const liveKitConfig = await fetchLiveKitConfig()
      setConfig(liveKitConfig)
      if (!liveKitConfig.enabled) {
        throw new Error('Video meetings are temporarily unavailable. Please try again later.')
      }
      const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName, avatarUrl)
      setCredentials(creds)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
    } finally {
      setLoading(false)
    }
  }, [avatarUrl, displayName, enabled, meetingId, roomId])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  if (!supportsLiveKitVideo()) {
    return (
      <ScreenFill padding="$5" alignItems="center" justifyContent="center" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.textSecondary} textAlign="center" lineHeight={22}>
          Allow camera and microphone access in your browser to join with video.
        </Text>
        {overlay?.(null)}
      </ScreenFill>
    )
  }

  if (!roomId) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.danger}>Meeting room is not ready. Refresh and try again.</Text>
      </ScreenFill>
    )
  }

  if (config && !config.enabled) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg} gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Co-Work video not configured
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          Co-Work video is not available right now. Please try again later or contact support if this continues.
        </Text>
      </ScreenFill>
    )
  }

  if (error) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg} gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Could not join video room
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          {error}
        </Text>
        <Text
          color={coworkUi.brand}
          fontWeight="600"
          cursor="pointer"
          onPress={() => void loadCredentials()}
        >
          Try again
        </Text>
        {overlay?.(null)}
      </ScreenFill>
    )
  }

  if (loading || !credentials) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Joining Co-Work room…
        </Text>
      </ScreenCenter>
    )
  }

  return (
    <ScreenFill
      backgroundColor={coworkUi.pageBg}
      position="relative"
      style={{ ...meetingViewportStyle(), ...pageGradientStyle(coworkGradients.page, coworkUi.pageBg) }}
    >
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio
        video={mediaMode !== 'audio'}
        options={getLiveKitRoomOptions('web')}
        onDisconnected={onDisconnected}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <WebLiveKitMeetingContent overlay={overlay} mediaMode={mediaMode} avatarUrl={avatarUrl} />
      </LiveKitRoom>
      <style>{getSheconomyLivekitCss(coworkUi, coworkShadows)}</style>
    </ScreenFill>
  )
}

/**
 * Browsers block audio element playback until the page gets a user gesture
 * (autoplay policy). LiveKit reports this via `canPlaybackAudio`; remote
 * participants stay silent until `room.startAudio()` runs inside a gesture.
 * This hits hosts hardest: they land in the room via navigation (start
 * meeting / call accepted) without clicking anything on the meeting page.
 */
function useWebAudioPlaybackUnlock(room: Room | undefined) {
  const [audioBlocked, setAudioBlocked] = useState(false)

  useEffect(() => {
    if (!room) return

    const syncPlaybackStatus = () => setAudioBlocked(!room.canPlaybackAudio)

    room.on(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackStatus)
    syncPlaybackStatus()

    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackStatus)
    }
  }, [room])

  const unlockAudio = useCallback(() => {
    if (!room) return
    void room.startAudio().catch(() => {
      // Still blocked — the banner stays visible for another explicit tap.
    })
  }, [room])

  // Any interaction anywhere on the page counts as the unlocking gesture.
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

  return { audioBlocked, unlockAudio }
}

function WebLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
  avatarUrl,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
  avatarUrl?: string | null
}) {
  const liveKit = useLiveKitMediaControls()
  const { audioBlocked, unlockAudio } = useWebAudioPlaybackUnlock(liveKit.room)

  useEffect(() => {
    const room = liveKit.room
    if (!room) return

    const reinforceVoiceProcessing = async () => {
      // Always (re)publish mic with AEC/NS so both sides hear each other.
      await room.localParticipant.setMicrophoneEnabled(true, { ...CALL_AUDIO_CAPTURE })
    }

    const reinforceCallMedia = async () => {
      // Voice calls must never leave camera on; video calls prefer camera on.
      if (mediaMode === 'audio') {
        if (room.localParticipant.isCameraEnabled) {
          await room.localParticipant.setCameraEnabled(false)
        }
        if (!room.localParticipant.isMicrophoneEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true, { ...CALL_AUDIO_CAPTURE })
        }
        return
      }
      if (mediaMode === 'video' && !room.localParticipant.isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(true)
      }
      if (!room.localParticipant.isMicrophoneEnabled) {
        await room.localParticipant.setMicrophoneEnabled(true, { ...CALL_AUDIO_CAPTURE })
      }
    }

    const unbindScreenShare = bindRemoteScreenShareQuality(room)

    const syncAvatarMetadata = async () => {
      if (!avatarUrl) return
      try {
        await room.localParticipant.setMetadata(buildParticipantMetadata({ avatarUrl }))
      } catch {
        // Metadata sync is best-effort; token metadata usually already has the avatar.
      }
    }

    const onConnected = () => {
      void reinforceVoiceProcessing()
      void reinforceCallMedia()
      void syncAvatarMetadata()
    }

    room.on(RoomEvent.Connected, onConnected)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      unbindScreenShare()
    }
  }, [avatarUrl, liveKit.room, mediaMode])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" style={{ minHeight: 0, overflow: 'hidden' }}>
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        className="sheconomy-livekit-room"
        pointerEvents="none"
      >
        {mediaMode === 'audio' ? null : <MeetingVideoStage />}
        <RoomAudioRenderer />
      </YStack>
      {audioBlocked ? (
        <XStack
          position="absolute"
          top={16}
          alignSelf="center"
          zIndex={300}
          alignItems="center"
          gap="$2"
          paddingVertical="$2"
          paddingHorizontal="$4"
          borderRadius={999}
          backgroundColor="rgba(12, 8, 10, 0.9)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.25)"
          cursor="pointer"
          pointerEvents="auto"
          onPress={unlockAudio}
          role="button"
          aria-label="Enable meeting audio"
        >
          <Icons.Volume2 size={16} color="#fff" />
          <Text fontSize={13} fontWeight="700" color="#fff">
            Tap to enable audio
          </Text>
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
        {overlay?.(liveKit)}
      </YStack>
    </YStack>
  )
}
