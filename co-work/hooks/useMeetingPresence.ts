import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  admitParticipant,
  rejectParticipant,
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
import type { FloatingMeetingReaction } from '~/co-work/lib/meeting-reactions'

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
  const [panel, setPanel] = useState<
    'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds'
  >('none')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})
  const [liveCaptions, setLiveCaptions] = useState<LiveCaptionLine[]>([])
  const [realtimeDegraded, setRealtimeDegraded] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [latestChatNotice, setLatestChatNotice] = useState<{
    id: string
    title: string
    message: string
  } | null>(null)
  const [latestHandNotice, setLatestHandNotice] = useState<{
    id: string
    title: string
    message: string
  } | null>(null)
  const [floatingReactions, setFloatingReactions] = useState<FloatingMeetingReaction[]>([])
  const displayNameByUserRef = useRef<Record<string, string>>({})

  const panelRef = useRef(panel)
  panelRef.current = panel

  const selfParticipant = participants.find((p) => p.user_id === userId)
  const isWaiting = selfParticipant?.status === 'waiting'
  const isRejected = selfParticipant?.status === 'rejected'
  const waitingParticipants = participants.filter((p) => p.status === 'waiting')

  const refreshParticipants = useCallback(async () => {
    const rows = await fetchMeetingParticipants(meeting.id)
    setParticipants(rows)
    displayNameByUserRef.current = Object.fromEntries(
      rows.map((row) => {
        const name =
          row.profile?.full_name?.trim() ||
          row.profile?.username?.trim() ||
          'Participant'
        return [row.user_id, name]
      }),
    )
  }, [meeting.id])

  const refreshChat = useCallback(async () => {
    const rows = await fetchMeetingChat(meeting.id)
    setChatMessages(rows)
  }, [meeting.id])

  const ingestRemoteChatMessage = useCallback(
    (message: MeetingChatMessage) => {
      if (!message?.id || message.sender_id === userId) return

      let isNew = false
      setChatMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        isNew = true
        return [...prev, message]
      })

      if (!isNew || panelRef.current === 'chat') return

      setUnreadChatCount((count) => count + 1)
      const senderName =
        message.sender?.full_name || message.sender?.username || 'Someone'
      setLatestChatNotice({
        id: message.id,
        title: `${senderName} in chat`,
        message: message.message_text,
      })
    },
    [userId],
  )

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

  const sendSignal = useCallback((payload: SignalPayload): boolean => {
    if (!channelRef.current) return false
    broadcastSignal(channelRef.current, payload)
    return true
  }, [])

  const pushFloatingReaction = useCallback(
    (input: { from: string; emoji: string; name?: string; timestamp?: number }) => {
      const createdAt = input.timestamp ?? Date.now()
      const id = `${input.from}-${createdAt}-${Math.random().toString(36).slice(2, 7)}`
      const name =
        input.name?.trim() ||
        displayNameByUserRef.current[input.from] ||
        (input.from === userId ? 'You' : 'Participant')
      setFloatingReactions((prev) => [
        ...prev.slice(-18),
        {
          id,
          emoji: input.emoji,
          from: input.from,
          name,
          createdAt,
          lane: Math.floor(Math.random() * 80),
        },
      ])
    },
    [userId],
  )

  const expireFloatingReaction = useCallback((id: string) => {
    setFloatingReactions((prev) => prev.filter((row) => row.id !== id))
  }, [])

  const handleSignal = useCallback(
    (payload: SignalPayload) => {
      if (payload.type === 'chat' && payload.from !== userId) {
        ingestRemoteChatMessage(payload.message)
        return
      }
      if (payload.type === 'reaction') {
        pushFloatingReaction({
          from: payload.from,
          emoji: payload.emoji,
          name: payload.name,
          timestamp: payload.timestamp,
        })
        return
      }
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
            originalText: payload.text,
            sourceLang: payload.sourceLang ?? null,
            isFinal: true,
            timestamp: payload.timestamp,
          },
        ])
        return
      }
      if (payload.type !== 'presence' || payload.from === userId) return

      const handUp = !!payload.hand
      setRaisedHands((prev) => {
        if (!!prev[payload.from] === handUp) return prev
        return { ...prev, [payload.from]: handUp }
      })

      if (handUp) {
        const name = displayNameByUserRef.current[payload.from] || 'Someone'
        setLatestHandNotice({
          id: `${payload.from}-${Date.now()}`,
          title: `${name} raised a hand`,
          message: 'Open Participants to see raised hands',
        })
      }
    },
    [ingestRemoteChatMessage, pushFloatingReaction, userId],
  )

  const connect = useCallback(async () => {
    if (!enabled) return

    const generation = ++connectGenerationRef.current
    setIsConnecting(true)
    setError(null)

    try {
      const waitingRoom = !isHost && !!meeting.security_settings?.waitingRoom
      await joinMeetingParticipant(meeting.id, userId, isHost, waitingRoom)
      // `ended` included: the host reopening a finished meeting restarts it.
      if (isHost && meeting.status !== 'active') {
        await startMeeting(meeting.id)
      }
      await refreshParticipants()
    } catch (joinError) {
      if (generation !== connectGenerationRef.current) return
      setError(joinError instanceof Error ? joinError.message : 'Failed to join meeting')
      setIsConnecting(false)
      return
    }

    // Unlock the room UI as soon as DB join succeeds. Realtime can stall
    // (Strict Mode remount / channel timeout) and must not block "Joining…".
    if (generation === connectGenerationRef.current) {
      setIsConnecting(false)
    }

    try {
      const channel = await joinMeetingChannel(meeting.id, userId, {
        onSignal: handleSignal,
        onParticipantChange: () => void refreshParticipants(),
        onChatMessage: (row) => {
          if (row?.id && !row.is_deleted) {
            ingestRemoteChatMessage({
              id: row.id,
              meeting_id: row.meeting_id,
              sender_id: row.sender_id,
              message_text: row.message_text,
              message_type: row.message_type,
              created_at: row.created_at,
              sender: null,
            })
          }
          void refreshChat()
        },
      })

      if (generation !== connectGenerationRef.current) {
        await unsubscribeMeetingChannel(channel)
        return
      }

      channelRef.current = channel
      realtimeActiveRef.current = true
      setRealtimeDegraded(false)
      stopPolling()
      await refreshChat()
    } catch {
      if (generation !== connectGenerationRef.current) return

      realtimeActiveRef.current = false
      setRealtimeDegraded(true)
      startPolling()
      await refreshChat()
    }
  }, [
    enabled,
    handleSignal,
    ingestRemoteChatMessage,
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
    if (channel) {
      try {
        await unsubscribeMeetingChannel(channel)
      } catch {
        // Best-effort — still leave the participant row.
      }
    }
    try {
      await leaveMeetingParticipant(meeting.id, userId)
    } catch {
      // Navigation / UI exit must not hang on a failed leave update.
    }
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
      const message = await sendMeetingChatMessage(meeting.id, userId, text)
      setChatMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        return [...prev, message]
      })
      sendSignal({ type: 'chat', from: userId, message })
    },
    [meeting.id, sendSignal, userId],
  )

  const clearChatNotice = useCallback(() => {
    setLatestChatNotice(null)
  }, [])

  const clearHandNotice = useCallback(() => {
    setLatestHandNotice(null)
  }, [])

  const sendReaction = useCallback(
    (emoji: string, name: string) => {
      const timestamp = Date.now()
      const payload: SignalPayload = {
        type: 'reaction',
        from: userId,
        emoji,
        name: name.trim() || 'You',
        timestamp,
      }
      pushFloatingReaction(payload)
      sendSignal(payload)
    },
    [pushFloatingReaction, sendSignal, userId],
  )

  const admit = useCallback(
    async (participantId: string) => {
      await admitParticipant(participantId)
      await refreshParticipants()
    },
    [refreshParticipants],
  )

  const reject = useCallback(
    async (participantId: string) => {
      await rejectParticipant(participantId)
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
    try {
      await endMeeting(meeting.id)
    } catch {
      // Still disconnect locally so the host can exit the room UI.
    }
    connectGenerationRef.current += 1
    await disconnect()
  }, [disconnect, meeting.id])

  const toggleHandRaise = useCallback(() => {
    const next = !handRaisedRef.current
    handRaisedRef.current = next
    setHandRaised(next)
    setRaisedHands((prev) => ({ ...prev, [userId]: next }))
    sendSignal({
      type: 'presence',
      from: userId,
      audio: true,
      video: false,
      screen: false,
      hand: next,
    })
  }, [sendSignal, userId])

  const muteAll = useCallback((): boolean => {
    return sendSignal({ type: 'mute-all', from: userId })
  }, [sendSignal, userId])

  const broadcastCaption = useCallback(
    (text: string, speaker: string, sourceLang?: string) => {
      sendSignal({
        type: 'caption',
        from: userId,
        speaker,
        text,
        isFinal: true,
        timestamp: Date.now(),
        sourceLang: sourceLang || undefined,
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

  const togglePanel = useCallback((next: 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds') => {
    setPanel((current) => {
      const opening = current !== next
      if (opening && next === 'chat') {
        setUnreadChatCount(0)
        setLatestChatNotice(null)
      }
      return opening ? next : 'none'
    })
  }, [])

  const setPanelSafe = useCallback(
    (next: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds') => {
      if (next === 'chat') {
        setUnreadChatCount(0)
        setLatestChatNotice(null)
      }
      setPanel(next)
    },
    [],
  )

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
    isRejected,
    waitingParticipants,
    handRaised,
    raisedHands,
    liveCaptions,
    realtimeDegraded,
    unreadChatCount,
    latestChatNotice,
    clearChatNotice,
    latestHandNotice,
    clearHandNotice,
    floatingReactions,
    expireFloatingReaction,
    sendReaction,
    setPanel: setPanelSafe,
    togglePanel,
    sendChat,
    admit,
    reject,
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
