import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import type { CallType } from '~/chat/lib/calls'
import { endCallsForMeetingCode, fetchCallById, mapCall, updateCallStatus } from '~/chat/lib/calls'
import { Avatar, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { RequireAuth } from '~/components/auth/RequireAuth'
import { LiveKitMeetingRoom, type LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'
import {
  endMeeting,
  fetchMeetingByCode,
  joinMeetingParticipant,
  leaveMeetingParticipant,
} from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'
import { chatRoutes } from '~/lib/routes'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { meetingViewportStyle } from '~/lib/platform/viewport'
import { brandColors } from '~/config/brand-colors'
import { supabase } from '~/lib/supabase/client'

type ChatCallScreenProps = {
  code: string
  callType: CallType
  callId?: string
}

const ACCEPT = brandColors.primary
const DECLINE = '#f2385a'
const MUTED = '#4a3a42'
const SURFACE = '#0f0a0d'

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ChatCallScreen({ code, callType, callId }: ChatCallScreenProps) {
  const router = useRouter()
  const { user, profile, isAuthenticated, isLoading } = useProfile()
  const { safeTop, safeBottom } = useAppLayout()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [resolvedCallType, setResolvedCallType] = useState<CallType>(callType)
  const hungUpRef = useRef(false)

  useEffect(() => {
    setResolvedCallType(callType)
  }, [callType])

  // Prefer DB truth over flaky query params (native routers sometimes drop `?type=`).
  useEffect(() => {
    if (!callId) return
    let cancelled = false
    void fetchCallById(callId).then((row) => {
      if (!cancelled && row) setResolvedCallType(row.callType)
    })
    return () => {
      cancelled = true
    }
  }, [callId])

  const mediaMode = resolvedCallType === 'audio' ? 'audio' : 'video'
  const isHost = !!meeting && !!user && meeting.host_id === user.id
  const peerLabel = useMemo(() => {
    if (!meeting) return 'Call'
    if (isHost) {
      return meeting.invitees?.[0]?.name || meeting.title || 'Contact'
    }
    return meeting.host?.full_name || meeting.host?.username || meeting.title || 'Caller'
  }, [isHost, meeting])
  const peerAvatar = useMemo(() => {
    if (!meeting) return null
    if (isHost) return meeting.invitees?.[0]?.avatar ?? null
    return meeting.host?.avatar_url ?? null
  }, [isHost, meeting])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const row = await fetchMeetingByCode(code)
        if (cancelled) return
        if (!row || row.status === 'ended') {
          setError(row?.status === 'ended' ? 'This call has ended.' : 'Call not found.')
          setMeeting(null)
          return
        }
        setMeeting(row)
        if (row.meeting_options?.defaultVideo === false) {
          setResolvedCallType('audio')
        } else if (row.meeting_options?.defaultVideo === true && !callId) {
          setResolvedCallType('video')
        }
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Could not join the call.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (!meeting || !user) return
    let cancelled = false
    async function join() {
      try {
        await joinMeetingParticipant(meeting!.id, user!.id, meeting!.host_id === user!.id, false)
        if (!cancelled) setJoined(true)
      } catch (joinError) {
        if (cancelled) return
        setError(joinError instanceof Error ? joinError.message : 'Could not join the call.')
      }
    }
    void join()
    return () => {
      cancelled = true
    }
  }, [meeting, user])

  useEffect(() => {
    if (!joined) return
    const started = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [joined])

  useEffect(() => {
    if (!callId) return
    const channel = supabase
      .channel(`chat-call-active:${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        (payload) => {
          const updated = mapCall(payload.new as never)
          if (
            updated.status === 'ended' ||
            updated.status === 'declined' ||
            updated.status === 'missed'
          ) {
            hungUpRef.current = true
            router.replace(chatRoutes.home)
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [callId, router])

  const hangUp = useCallback(async () => {
    if (hungUpRef.current) return
    hungUpRef.current = true
    try {
      if (meeting?.meeting_code) {
        await endCallsForMeetingCode(meeting.meeting_code)
      } else if (callId) {
        await updateCallStatus(callId, 'ended')
      }
      if (meeting && user) {
        await leaveMeetingParticipant(meeting.id, user.id)
        if (meeting.host_id === user.id) {
          await endMeeting(meeting.id)
        }
      }
    } catch {
      // Best-effort hangup — still leave the UI.
    }
    router.replace(chatRoutes.home)
  }, [callId, meeting, router, user])

  if (isLoading && !user) {
    return (
      <ScreenCenter backgroundColor={SURFACE}>
        <Spinner size="large" color={ACCEPT} />
      </ScreenCenter>
    )
  }

  if (!isAuthenticated || !user) {
    return <RequireAuth redirectTo={String(chatRoutes.call(code, { type: callType, callId }))} />
  }

  if (loading) {
    return (
      <ScreenCenter backgroundColor={SURFACE}>
        <Spinner size="large" color={ACCEPT} />
        <Text color="#c9b6c1" marginTop="$3">
          Connecting…
        </Text>
      </ScreenCenter>
    )
  }

  if (error || !meeting) {
    return (
      <ScreenCenter backgroundColor={SURFACE} padding="$6" gap="$3">
        <Text color="#f2385a" fontWeight="700" textAlign="center">
          {error ?? 'Call unavailable'}
        </Text>
        <Text
          color={ACCEPT}
          fontWeight="700"
          cursor="pointer"
          onPress={() => router.replace(chatRoutes.home)}
        >
          Back to chats
        </Text>
      </ScreenCenter>
    )
  }

  if (!supportsLiveKitVideo()) {
    return (
      <ScreenCenter backgroundColor={SURFACE} padding="$6" gap="$3">
        <Text color="#fff" textAlign="center">
          Allow microphone{resolvedCallType === 'video' ? ' and camera' : ''} access to continue this call.
        </Text>
      </ScreenCenter>
    )
  }

  if (!joined || !meeting.room_id) {
    return (
      <ScreenCenter backgroundColor={SURFACE}>
        <Spinner size="large" color={ACCEPT} />
        <Text color="#c9b6c1" marginTop="$3">
          Joining call…
        </Text>
      </ScreenCenter>
    )
  }

  return (
    <ScreenFill
      backgroundColor={SURFACE}
      position="relative"
      style={meetingViewportStyle()}
    >
      <LiveKitMeetingRoom
        meetingId={meeting.id}
        roomId={meeting.room_id}
        displayName={profile?.full_name || profile?.username || 'You'}
        avatarUrl={profile?.avatar_url}
        isHost={isHost}
        enabled
        mediaMode={mediaMode}
        onDisconnected={() => {
          void hangUp()
        }}
        overlay={(liveKit) => (
          <ChatCallOverlay
            callType={resolvedCallType}
            peerName={peerLabel}
            peerAvatar={peerAvatar}
            elapsed={elapsed}
            safeTop={safeTop}
            safeBottom={safeBottom}
            liveKit={liveKit}
            onHangUp={() => void hangUp()}
          />
        )}
      />
    </ScreenFill>
  )
}

function ChatCallOverlay({
  callType,
  peerName,
  peerAvatar,
  elapsed,
  safeTop,
  safeBottom,
  liveKit,
  onHangUp,
}: {
  callType: CallType
  peerName: string
  peerAvatar: string | null
  elapsed: number
  safeTop: number
  safeBottom: number
  liveKit: LiveKitMediaControls | null
  onHangUp: () => void
}) {
  const muted = liveKit ? !liveKit.audioEnabled : false
  const cameraOff = liveKit ? !liveKit.videoEnabled : callType === 'audio'
  const showVideoChrome = callType === 'video'

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200}
      pointerEvents="box-none"
      justifyContent="space-between"
      paddingTop={Math.max(safeTop, 16) + 8}
      paddingBottom={Math.max(safeBottom, 16) + 16}
      paddingHorizontal={20}
    >
      <YStack alignItems="center" gap={6} pointerEvents="none">
        <Text fontSize={13} color="#c9b6c1" fontWeight="600">
          {callType === 'video' ? 'Video call' : 'Voice call'}
        </Text>
        <Text fontSize={22} fontWeight="800" color="#fff" numberOfLines={1}>
          {peerName}
        </Text>
        <Text fontSize={14} color="#c9b6c1">
          {liveKit ? formatDuration(elapsed) : 'Connecting…'}
        </Text>
      </YStack>

      {callType === 'audio' || cameraOff ? (
        <YStack flex={1} alignItems="center" justifyContent="center" pointerEvents="none">
          <Avatar size="$10" name={peerName} src={peerAvatar ?? undefined} />
        </YStack>
      ) : (
        <YStack flex={1} pointerEvents="none" />
      )}

      <XStack
        alignSelf="center"
        alignItems="center"
        justifyContent="center"
        gap={22}
        width="100%"
        maxWidth={360}
        pointerEvents="auto"
      >
        <CallControlButton
          label={muted ? 'Unmute' : 'Mute'}
          color={muted ? DECLINE : MUTED}
          onPress={() => liveKit?.toggleAudio()}
        >
          {muted ? <Icons.MicOff size={24} color="#fff" /> : <Icons.Mic size={24} color="#fff" />}
        </CallControlButton>

        <CallControlButton
          label={
            Platform.OS === 'web'
              ? 'Speaker'
              : liveKit?.speakerOn
                ? 'Speaker'
                : 'Phone'
          }
          color={liveKit?.speakerOn || Platform.OS === 'web' ? ACCEPT : MUTED}
          onPress={() => {
            // Web has no earpiece route — output is OS/browser managed.
            if (Platform.OS === 'web') return
            void liveKit?.toggleSpeaker()
          }}
        >
          {liveKit?.speakerOn || Platform.OS === 'web' ? (
            <Icons.Volume2 size={24} color="#fff" />
          ) : (
            <Icons.Phone size={24} color="#fff" />
          )}
        </CallControlButton>

        {showVideoChrome ? (
          <CallControlButton
            label={cameraOff ? 'Camera on' : 'Camera off'}
            color={cameraOff ? MUTED : '#2a1c24'}
            onPress={() => liveKit?.toggleVideo()}
          >
            {cameraOff ? (
              <Icons.VideoOff size={24} color="#fff" />
            ) : (
              <Icons.Video size={24} color="#fff" />
            )}
          </CallControlButton>
        ) : null}

        <CallControlButton label="End call" color={DECLINE} onPress={onHangUp} large>
          <Icons.PhoneOff size={28} color="#fff" />
        </CallControlButton>
      </XStack>
    </YStack>
  )
}

function CallControlButton({
  children,
  color,
  onPress,
  label,
  large,
}: {
  children: React.ReactNode
  color: string
  onPress: () => void
  label: string
  large?: boolean
}) {
  const size = large ? 72 : 58
  return (
    <YStack alignItems="center" gap={8}>
      <YStack
        width={size}
        height={size}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={color}
        cursor="pointer"
        pressStyle={{ scale: 0.92 }}
        onPress={onPress}
        aria-label={label}
      >
        {children}
      </YStack>
      <Text fontSize={12} color="#c9b6c1">
        {label}
      </Text>
    </YStack>
  )
}
