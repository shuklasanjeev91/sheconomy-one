import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { ConnectionState, RoomEvent, Track } from 'livekit-client'

import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useTracks,
} from '@livekit/react-native'

import { Spinner, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import type { LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'

type NativeLiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

export function NativeLiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  enabled,
  onDisconnected,
  overlay,
}: NativeLiveKitMeetingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof fetchLiveKitCredentials>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void AudioSession.startAudioSession()
    return () => {
      void AudioSession.stopAudioSession()
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void fetchLiveKitConfig().then(setConfig)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !roomId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const liveKitConfig = await fetchLiveKitConfig()
        if (cancelled) return
        setConfig(liveKitConfig)
        if (!liveKitConfig.enabled) {
          throw new Error('Video meetings are temporarily unavailable. Please try again later.')
        }
        const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName)
        if (cancelled) return
        setCredentials(creds)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [displayName, enabled, meetingId, roomId])

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
    <ScreenFill backgroundColor={coworkUi.pageBg} position="relative">
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio
        video
        options={getLiveKitRoomOptions()}
        onDisconnected={onDisconnected}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <NativeLiveKitMeetingContent overlay={overlay} />
      </LiveKitRoom>
    </ScreenFill>
  )
}

function NativeLiveKitMeetingContent({
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
    <YStack flex={1} width="100%" height="100%" position="relative">
      <NativeMeetingVideoStage />
      <YStack position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="box-none" zIndex={100}>
        {overlay?.(liveKit)}
      </YStack>
    </YStack>
  )
}

function NativeMeetingVideoStage() {
  const { ui: coworkUi } = useCoWorkTheme()
  const { width } = useWindowDimensions()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: true })
  const videoTracks = useMemo(
    () => tracks.filter((track) => isTrackReference(track) && track.publication?.kind === 'video'),
    [tracks],
  )
  const columns = width > 720 ? 2 : 1

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: 72,
        paddingBottom: 108,
        paddingHorizontal: 12,
        gap: 12,
      }}
      style={{ flex: 1 }}
    >
      {videoTracks.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" minHeight={240}>
          <Text color={coworkUi.textSecondary}>Waiting for video…</Text>
        </YStack>
      ) : (
        <YStack flexDirection="row" flexWrap="wrap" gap="$3" justifyContent="center">
          {videoTracks.map((trackRef) => (
            <YStack
              key={trackRef.publication?.trackSid ?? trackRef.participant.identity}
              width={columns === 2 ? '48%' : '100%'}
              aspectRatio={16 / 9}
              borderRadius={coworkUi.radius.tile}
              overflow="hidden"
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              backgroundColor={coworkUi.tileBg}
            >
              <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%' }} objectFit="cover" />
            </YStack>
          ))}
        </YStack>
      )}
    </ScrollView>
  )
}
