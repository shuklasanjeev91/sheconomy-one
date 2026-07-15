import { useCallback, useEffect, useState } from 'react'
import { ConnectionState, RoomEvent } from 'livekit-client'

import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { Spinner, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { MeetingVideoStage } from '~/co-work/components/MeetingVideoStage'
import { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
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
    background: ${ui.tileBg};
    width: 100%;
    height: 100%;
  }
  .sheconomy-participant-tile.lk-participant-tile[data-lk-speaking='true'] {
    border-color: ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow}, ${shadows.tile};
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
      const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName)
      setCredentials(creds)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
    } finally {
      setLoading(false)
    }
  }, [displayName, enabled, meetingId, roomId])

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
        <WebLiveKitMeetingContent overlay={overlay} mediaMode={mediaMode} />
      </LiveKitRoom>
      <style>{getSheconomyLivekitCss(coworkUi, coworkShadows)}</style>
    </ScreenFill>
  )
}

function WebLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
}) {
  const liveKit = useLiveKitMediaControls()

  useEffect(() => {
    const room = liveKit.room
    if (!room) return

    const reinforceVoiceProcessing = async () => {
      if (!room.localParticipant.isMicrophoneEnabled) return
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: true,
      })
    }

    const reinforceCallMedia = async () => {
      // Voice calls must never leave camera on; video calls prefer camera on.
      if (mediaMode === 'audio') {
        if (room.localParticipant.isCameraEnabled) {
          await room.localParticipant.setCameraEnabled(false)
        }
        if (!room.localParticipant.isMicrophoneEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          })
        }
        return
      }
      if (mediaMode === 'video' && !room.localParticipant.isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(true)
      }
    }

    const unbindScreenShare = bindRemoteScreenShareQuality(room)

    const onConnected = () => {
      void reinforceVoiceProcessing()
      void reinforceCallMedia()
    }

    room.on(RoomEvent.Connected, onConnected)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      unbindScreenShare()
    }
  }, [liveKit.room, mediaMode])

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
        <MeetingVideoStage />
        <RoomAudioRenderer />
      </YStack>
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
