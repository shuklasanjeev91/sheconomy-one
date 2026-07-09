import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  admitParticipant,
  endMeeting,
  fetchMeetingChat,
  fetchMeetingParticipants,
  joinMeetingParticipant,
  leaveMeetingParticipant,
  sendMeetingChatMessage,
  startMeeting,
  updateParticipantMedia,
} from '~/co-work/lib/meetings'
import {
  broadcastSignal,
  joinMeetingChannel,
  unsubscribeMeetingChannel,
} from '~/co-work/lib/signaling'
import type { Meeting, MeetingChatMessage, MeetingParticipant, SignalPayload } from '~/co-work/lib/types'
import type { LiveCaptionLine } from '~/co-work/lib/live-captions'

type UseMeetingPresenceOptions = {
  meeting: Meeting
  userId: string
  isHost: boolean
  enabled: boolean
}

type MediaHandlers = {
  onMuteAll?: () => void
}

const POLL_INTERVAL_MS = 5000

/** Supabase-backed meeting presence: participants, chat, waiting room (no media). */
export function useMeetingPresence({
  meeting,
  userId,
  isHost,
  enabled,
}: UseMeetingPresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const connectGenerationRef = useRef(0)
  const handRaisedRef = useRef(false)
  const mediaHandlersRef = useRef<MediaHandlers>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeActiveRef = useRef(false)

  const [participants, setParticipants] = useState<MeetingParticipant[]>([])
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([])
  const [panel, setPanel] = useState<'none' | 'chat' | 'people' | 'invite'>('none')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})
  const [liveCaptions, setLiveCaptions] = useState<LiveCaptionLine[]>([])
  const [realtimeDegraded, setRealtimeDegraded] = useState(false)

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

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(() => {
      void refreshParticipants()
      void refreshChat()
    }, POLL_INTERVAL_MS)
  }, [refreshChat, refreshParticipants])

  const sendSignal = useCallback((payload: SignalPayload) => {
    if (channelRef.current) broadcastSignal(channelRef.current, payload)
  }, [])

  const handleSignal = useCallback(
    (payload: SignalPayload) => {
      if (payload.type === 'mute-all' && payload.from !== userId) {
        mediaHandlersRef.current.onMuteAll?.()
        return
      }
      if (payload.type === 'caption' && payload.from !== userId && payload.isFinal) {
        setLiveCaptions((current) => [
          ...current.slice(-80),
          {
            id: `${payload.from}-${payload.timestamp}`,
            userId: payload.from,
            speaker: payload.speaker,
            text: payload.text,
            isFinal: true,
            timestamp: payload.timestamp,
          },
        ])
        return
      }
      if (payload.type !== 'presence' || payload.from === userId) return
      setRaisedHands((prev) => ({
        ...prev,
        [payload.from]: !!payload.hand,
      }))
    },
    [userId],
  )

  const connect = useCallback(async () => {
    if (!enabled) return

    const generation = ++connectGenerationRef.current
    setIsConnecting(true)
    setError(null)

    try {
      const waitingRoom = !isHost && !!meeting.security_settings?.waitingRoom
      await joinMeetingParticipant(meeting.id, userId, isHost, waitingRoom)
      if (isHost && meeting.status === 'scheduled') await startMeeting(meeting.id)

      const channel = await joinMeetingChannel(meeting.id, userId, {
        onSignal: handleSignal,
        onParticipantChange: () => void refreshParticipants(),
        onChatMessage: () => void refreshChat(),
      })

      if (generation !== connectGenerationRef.current) {
        await unsubscribeMeetingChannel(channel)
        return
      }

      channelRef.current = channel
      realtimeActiveRef.current = true
      setRealtimeDegraded(false)
      stopPolling()
      await refreshParticipants()
      await refreshChat()
    } catch (connectError) {
      if (generation !== connectGenerationRef.current) return

      realtimeActiveRef.current = false
      setRealtimeDegraded(true)
      startPolling()
      await refreshParticipants()
      await refreshChat()

      const message = connectError instanceof Error ? connectError.message : 'Failed to join meeting'
      if (!message.includes('postgres_changes')) {
        setError(message)
      }
    } finally {
      if (generation === connectGenerationRef.current) {
        setIsConnecting(false)
      }
    }
  }, [
    enabled,
    handleSignal,
    isHost,
    meeting,
    refreshChat,
    refreshParticipants,
    startPolling,
    stopPolling,
    userId,
  ])

  const disconnect = useCallback(async () => {
    stopPolling()
    realtimeActiveRef.current = false
    const channel = channelRef.current
    channelRef.current = null
    if (channel) await unsubscribeMeetingChannel(channel)
    await leaveMeetingParticipant(meeting.id, userId)
  }, [meeting.id, stopPolling, userId])

  useEffect(() => {
    if (!enabled) return

    void connect()

    return () => {
      connectGenerationRef.current += 1
      void disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meeting.id, userId])

  const sendChat = useCallback(
    async (text: string) => {
      await sendMeetingChatMessage(meeting.id, userId, text)
      await refreshChat()
    },
    [meeting.id, refreshChat, userId],
  )

  const admit = useCallback(
    async (participantId: string) => {
      await admitParticipant(participantId)
      await refreshParticipants()
    },
    [refreshParticipants],
  )

  const admitAllWaiting = useCallback(async () => {
    const waiting = participants.filter((p) => p.status === 'waiting')
    await Promise.all(waiting.map((p) => admitParticipant(p.id)))
    await refreshParticipants()
  }, [participants, refreshParticipants])

  const leave = useCallback(async () => {
    connectGenerationRef.current += 1
    await disconnect()
  }, [disconnect])

  const hostEnd = useCallback(async () => {
    await endMeeting(meeting.id)
    connectGenerationRef.current += 1
    await disconnect()
  }, [disconnect, meeting.id])

  const toggleHandRaise = useCallback(() => {
    const next = !handRaisedRef.current
    handRaisedRef.current = next
    setHandRaised(next)
    sendSignal({
      type: 'presence',
      from: userId,
      audio: true,
      video: false,
      screen: false,
      hand: next,
    })
  }, [sendSignal, userId])

  const muteAll = useCallback(() => {
    sendSignal({ type: 'mute-all', from: userId })
  }, [sendSignal, userId])

  const broadcastCaption = useCallback(
    (text: string, speaker: string) => {
      sendSignal({
        type: 'caption',
        from: userId,
        speaker,
        text,
        isFinal: true,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const syncMediaState = useCallback(
    async (patch: { is_muted?: boolean; is_video_off?: boolean }) => {
      await updateParticipantMedia(meeting.id, userId, patch)
    },
    [meeting.id, userId],
  )

  const registerMediaHandlers = useCallback((handlers: MediaHandlers) => {
    mediaHandlersRef.current = handlers
  }, [])

  const togglePanel = useCallback((next: 'chat' | 'people' | 'invite') => {
    setPanel((current) => (current === next ? 'none' : next))
  }, [])

  const retryRealtime = useCallback(() => {
    setError(null)
    void connect()
  }, [connect])

  return {
    participants,
    chatMessages,
    panel,
    error,
    isConnecting,
    isWaiting,
    waitingParticipants,
    handRaised,
    raisedHands,
    liveCaptions,
    realtimeDegraded,
    setPanel,
    togglePanel,
    sendChat,
    admit,
    admitAllWaiting,
    leave,
    hostEnd,
    toggleHandRaise,
    muteAll,
    broadcastCaption,
    syncMediaState,
    registerMediaHandlers,
    retryRealtime,
    refreshParticipants,
  }
}
