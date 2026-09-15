import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import {
  admitParticipant,
  createMeetingSessionId,
  endMeeting,
  fetchMeetingChat,
  fetchMeetingParticipants,
  joinMeetingParticipant,
  leaveMeetingParticipant,
  sendMeetingChatMessage,
  startMeeting,
  updateParticipantMedia,
} from '~/co-work/lib/meetings'
import { createMediaSession, getMediaCapabilities } from '~/co-work/lib/media'
import {
  broadcastSignal,
  joinMeetingChannel,
  unsubscribeMeetingChannel,
} from '~/co-work/lib/signaling'
import type {
  Meeting,
  MeetingChatMessage,
  MeetingParticipant,
  RemoteParticipantState,
  SignalPayload,
} from '~/co-work/lib/types'

type UseMeetingSessionOptions = {
  meeting: Meeting
  userId: string
  displayName: string
  isHost: boolean
  enabled: boolean
}

export function useMeetingSession({
  meeting,
  userId,
  displayName,
  isHost,
  enabled,
}: UseMeetingSessionOptions) {
  const caps = useMemo(() => getMediaCapabilities(), [])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sessionIdRef = useRef(createMeetingSessionId())
  const connectGenerationRef = useRef(0)
  const mediaRef = useRef<ReturnType<typeof createMediaSession>>(null)
  const [participants, setParticipants] = useState<MeetingParticipant[]>([])
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([])
  const [remotePeers, setRemotePeers] = useState<Record<string, RemoteParticipantState>>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(caps.supportsVideo)
  const [screenSharing, setScreenSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [recording, setRecording] = useState(false)
  const [panel, setPanel] = useState<'none' | 'chat' | 'people'>('none')
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const selfParticipant = participants.find((p) => p.user_id === userId)
  const isWaiting = selfParticipant?.status === 'waiting'
  const waitingParticipants = participants.filter((p) => p.status === 'waiting')

  const refreshParticipants = useCallback(async () => {
    const rows = await fetchMeetingParticipants(meeting.id)
    setParticipants(rows)
  }, [meeting.id])

  const refreshChat = useCallback(async () => {
    const rows = await fetchMeetingChat(meeting.id)
    setChatMessages(rows)
  }, [meeting.id])

  const sendSignal = useCallback(
    (payload: SignalPayload) => {
      if (channelRef.current) broadcastSignal(channelRef.current, payload)
    },
    [],
  )

  const connect = useCallback(async () => {
    if (!enabled) return

    const generation = ++connectGenerationRef.current
    setIsConnecting(true)
    setError(null)

    try {
      const waitingRoom = !isHost && !!meeting.security_settings?.waitingRoom
      await joinMeetingParticipant(
        meeting.id,
        userId,
        isHost,
        waitingRoom,
        sessionIdRef.current,
        displayName,
      )
      // `ended` included: the host reopening a finished meeting restarts it.
      if (isHost && meeting.status !== 'active') await startMeeting(meeting.id)

      const channel = await joinMeetingChannel(meeting.id, userId, {
        onSignal: (payload) => {
          void mediaRef.current?.handleSignal(payload)
          if (payload.type === 'presence' && payload.from !== userId) {
            setRemotePeers((prev) => ({
              ...prev,
              [payload.from]: {
                ...(prev[payload.from] ?? {
                  peerId: payload.from,
                  userId: payload.from,
                  displayName: 'Participant',
                  isHost: false,
                }),
                audioEnabled: payload.audio,
                videoEnabled: payload.video,
                screenSharing: payload.screen,
                handRaised: payload.hand,
              },
            }))
          }
        },
        onParticipantChange: () => void refreshParticipants(),
        onChatMessage: () => void refreshChat(),
      })

      if (generation !== connectGenerationRef.current) {
        await unsubscribeMeetingChannel(channel)
        return
      }

      channelRef.current = channel
      await refreshParticipants()
      await refreshChat()

      if (caps.supportsVideo) {
        mediaRef.current = createMediaSession(userId, sendSignal, {
          onRemoteStream: (peerId, stream) => {
            setRemotePeers((prev) => ({
              ...prev,
              [peerId]: {
                ...(prev[peerId] ?? {
                  peerId,
                  userId: peerId,
                  displayName: 'Participant',
                  isHost: false,
                  audioEnabled: true,
                  videoEnabled: true,
                  screenSharing: false,
                  handRaised: false,
                }),
                stream,
              },
            }))
          },
          onRemoteScreenStream: (peerId, stream) => {
            setRemotePeers((prev) => ({
              ...prev,
              [peerId]: {
                ...(prev[peerId] ?? {
                  peerId,
                  userId: peerId,
                  displayName: 'Participant',
                  isHost: false,
                  audioEnabled: true,
                  videoEnabled: true,
                  screenSharing: false,
                  handRaised: false,
                }),
                screenStream: stream,
                screenSharing: !!stream,
              },
            }))
          },
          onPeerDisconnected: (peerId) => {
            setRemotePeers((prev) => {
              const next = { ...prev }
              delete next[peerId]
              return next
            })
          },
        })

        if (!waitingRoom) {
          const stream = await mediaRef.current?.startLocalMedia(
            meeting.meeting_options?.defaultVideo ?? true,
            meeting.meeting_options?.defaultAudio ?? true,
          )
          setLocalStream(stream ?? null)
          setAudioEnabled(mediaRef.current?.isAudioEnabled() ?? true)
          setVideoEnabled(mediaRef.current?.isVideoEnabled() ?? false)
          mediaRef.current?.broadcastPresence(false)
        }
      }
    } catch (connectError) {
      if (generation === connectGenerationRef.current) {
        setError(connectError instanceof Error ? connectError.message : 'Failed to join meeting')
      }
    } finally {
      if (generation === connectGenerationRef.current) {
        setIsConnecting(false)
      }
    }
  }, [
    caps.supportsVideo,
    displayName,
    enabled,
    isHost,
    meeting,
    refreshChat,
    refreshParticipants,
    sendSignal,
    userId,
  ])

  const disconnect = useCallback(async () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    await mediaRef.current?.destroy()
    mediaRef.current = null
    if (channelRef.current) await unsubscribeMeetingChannel(channelRef.current)
    channelRef.current = null
    await leaveMeetingParticipant(meeting.id, userId, sessionIdRef.current)
    setLocalStream(null)
  }, [meeting.id, userId])

  useEffect(() => {
    if (!enabled) return
    void connect()
    return () => {
      connectGenerationRef.current += 1
      void disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meeting.id, userId])

  useEffect(() => {
    if (!enabled || isWaiting || !mediaRef.current) return
    const joined = participants.filter((p) => p.status === 'joined' && p.user_id !== userId)
    for (const p of joined) {
      void mediaRef.current.connectToPeer(p.user_id, userId > p.user_id)
    }
  }, [enabled, isWaiting, participants, userId])

  const toggleAudio = useCallback(async () => {
    const next = mediaRef.current?.toggleAudio() ?? !audioEnabled
    setAudioEnabled(next)
    await updateParticipantMedia(meeting.id, userId, { is_muted: !next }, sessionIdRef.current)
  }, [audioEnabled, meeting.id, userId])

  const toggleVideo = useCallback(async () => {
    const next = mediaRef.current?.toggleVideo() ?? !videoEnabled
    setVideoEnabled(next)
    await updateParticipantMedia(meeting.id, userId, { is_video_off: !next }, sessionIdRef.current)
  }, [meeting.id, userId, videoEnabled])

  const toggleScreenShare = useCallback(async () => {
    if (!caps.supportsScreenShare) return
    if (screenSharing) {
      await mediaRef.current?.stopScreenShare()
      setScreenSharing(false)
      return
    }
    const stream = await mediaRef.current?.startScreenShare()
    setScreenSharing(!!stream)
  }, [caps.supportsScreenShare, screenSharing])

  const toggleHandRaise = useCallback(() => {
    const next = !handRaised
    setHandRaised(next)
    sendSignal({
      type: 'presence',
      from: userId,
      audio: audioEnabled,
      video: videoEnabled,
      screen: screenSharing,
      hand: next,
    })
  }, [audioEnabled, handRaised, screenSharing, sendSignal, userId, videoEnabled])

  const sendChat = useCallback(
    async (text: string) => {
      const message = await sendMeetingChatMessage(meeting.id, userId, text)
      await refreshChat()
      sendSignal({ type: 'chat', from: userId, message })
    },
    [meeting.id, refreshChat, sendSignal, userId],
  )

  const admit = useCallback(
    async (participantId: string) => {
      await admitParticipant(participantId)
      await refreshParticipants()
    },
    [refreshParticipants],
  )

  const leave = useCallback(async () => {
    await disconnect()
  }, [disconnect])

  const hostEnd = useCallback(async () => {
    await endMeeting(meeting.id)
    await disconnect()
  }, [disconnect, meeting.id])

  const muteAll = useCallback(() => {
    sendSignal({ type: 'mute-all', from: userId })
  }, [sendSignal, userId])

  const toggleRecording = useCallback(() => {
    if (!caps.supportsRecording || !localStream) return
    if (recording) {
      recorderRef.current?.stop()
      recorderRef.current = null
      setRecording(false)
      return
    }
    const recorder = new MediaRecorder(localStream)
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }, [caps.supportsRecording, localStream, recording])

  return {
    caps,
    participants,
    chatMessages,
    remotePeers,
    localStream,
    audioEnabled,
    videoEnabled,
    screenSharing,
    handRaised,
    recording,
    panel,
    layout,
    error,
    isConnecting,
    isWaiting,
    waitingParticipants,
    displayName,
    setPanel,
    setLayout,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleHandRaise,
    toggleRecording,
    sendChat,
    admit,
    leave,
    hostEnd,
    muteAll,
    refreshParticipants,
  }
}
