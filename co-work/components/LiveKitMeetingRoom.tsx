import { Platform } from 'react-native'
import { useCallback, useEffect, useState } from 'react'

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { ConnectionState, RoomEvent } from 'livekit-client'

import { Spinner, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { MeetingVideoStage } from '~/co-work/components/MeetingVideoStage'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { meetingViewportStyle } from '~/lib/platform/viewport'

export type LiveKitMediaControls = {
  room: ReturnType<typeof useRoomContext>
  localParticipant: ReturnType<typeof useLocalParticipant>['localParticipant']
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  toggleAudio: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void
}

type LiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

const SHECONOMY_LIVEKIT_CSS = `
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
    background: transparent;
    padding: 72px 12px 108px;
    box-sizing: border-box;
  }
  .sheconomy-video-gallery {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 12px;
    box-sizing: border-box;
    align-items: stretch;
    justify-items: stretch;
  }
  .sheconomy-video-gallery--solo {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sheconomy-video-gallery--solo .sheconomy-participant-tile {
    width: min(100%, 72rem, calc((100dvh - 200px) * 16 / 9));
    height: min(100%, calc(100dvh - 200px));
    max-height: 100%;
    flex: none;
  }
  .sheconomy-video-pip {
    position: absolute;
    right: 20px;
    bottom: 120px;
    width: min(28vw, 220px);
    aspect-ratio: 16 / 9;
    z-index: 15;
    border-radius: ${coworkUi.radius.tile}px;
    overflow: hidden;
    border: 2px solid ${coworkUi.brand};
    box-shadow: ${coworkShadows.tile};
    pointer-events: none;
  }
  .sheconomy-video-pip .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
  }
  @media (max-width: 768px) {
    .sheconomy-video-pip {
      width: min(36vw, 140px);
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
    border-radius: ${coworkUi.radius.tile}px;
    border: 1px solid ${coworkUi.glassBorder};
    background: ${coworkUi.tileBg};
    overflow: hidden;
    box-shadow: ${coworkShadows.tile};
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .sheconomy-participant-tile video,
  .sheconomy-participant-tile .lk-video-track {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center center;
  }
  .sheconomy-video-gallery .lk-participant-placeholder {
    background: ${coworkUi.tileBg};
    width: 100%;
    height: 100%;
  }
  .sheconomy-participant-tile.lk-participant-tile[data-lk-speaking='true'] {
    border-color: ${coworkUi.brandLight};
    box-shadow: 0 0 0 2px ${coworkUi.brandGlow}, ${coworkShadows.tile};
  }
  .sheconomy-participant-tile .lk-participant-metadata {
    background: linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.88) 100%);
    padding: 12px 14px;
    backdrop-filter: blur(8px);
  }
  .sheconomy-participant-tile .lk-participant-metadata-item {
    color: ${coworkUi.text};
    font-size: 12px;
    font-weight: 600;
  }
  .sheconomy-participant-tile .lk-focus-toggle-button,
  .sheconomy-participant-tile .lk-connection-quality {
    display: none !important;
  }
  .sheconomy-video-gallery .lk-pagination-control,
  .sheconomy-video-gallery .lk-pagination-indicator {
    color: ${coworkUi.textSecondary};
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

export function LiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  isHost,
  enabled,
  onDisconnected,
  overlay,
}: LiveKitMeetingRoomProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof fetchLiveKitCredentials>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return
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

  if (Platform.OS !== 'web') {
    return (
      <ScreenFill
        padding="$5"
        alignItems="center"
        justifyContent="center"
        backgroundColor={coworkUi.pageBg}
      >
        <YStack
          maxWidth={420}
          padding="$5"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          gap="$3"
          alignItems="center"
          style={coworkGlassStyle(coworkUi, true)}
        >
          <Text fontSize={18} fontWeight="800" color={coworkUi.text} textAlign="center">
            Co-Work on mobile
          </Text>
          <Text color={coworkUi.textSecondary} textAlign="center" lineHeight={22}>
            Chat, people, and hand raise work here. For HD video and screen share, open this meeting in your mobile
            browser.
          </Text>
        </YStack>
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

  if (error) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.danger}>{error}</Text>
      </ScreenFill>
    )
  }

  return (
    <ScreenFill
      backgroundColor={coworkUi.pageBg}
      position="relative"
      style={{ ...meetingViewportStyle(), background: coworkGradients.page }}
    >
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio
        video
        options={getLiveKitRoomOptions()}
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
        <LiveKitMeetingContent overlay={overlay} />
      </LiveKitRoom>
      <style>{SHECONOMY_LIVEKIT_CSS}</style>
    </ScreenFill>
  )
}

function LiveKitMeetingContent({
  overlay,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
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

    room.on(RoomEvent.Connected, reinforceVoiceProcessing)
    if (room.state === ConnectionState.Connected) {
      void reinforceVoiceProcessing()
    }

    return () => {
      room.off(RoomEvent.Connected, reinforceVoiceProcessing)
    }
  }, [liveKit.room])

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

export function useLiveKitMediaControls(): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()

  return {
    room,
    localParticipant,
    audioEnabled: isMicrophoneEnabled,
    videoEnabled: isCameraEnabled,
    screenSharing: isScreenShareEnabled,
    toggleAudio: () => {
      const next = !isMicrophoneEnabled
      void localParticipant.setMicrophoneEnabled(next, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: true,
      })
    },
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare: () => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled),
  }
}