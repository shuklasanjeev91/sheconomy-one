import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  allowMeetingParticipantRejoin,
  admitParticipant,
  assignMeetingCoHost,
  createMeetingSessionId,
  rejectParticipant,
  endMeeting,
  fetchMeetingById,
  fetchMeetingChat,
  fetchMeetingControlEvents,
  fetchMeetingModerationSettings,
  fetchMeetingParticipants,
  joinMeetingParticipant,
  leaveMeetingParticipant,
  removeMeetingParticipant,
  removeMeetingCoHost,
  sendMeetingControl,
  sendMeetingChatMessage,
  softDeleteMeetingChatMessage,
  startMeeting,
  setMeetingHostLeaveBehavior,
  setMeetingLocked,
  transferMeetingHost,
  updateParticipantMedia,
} from '~/co-work/lib/meetings'
import {
  hostLeaveConfirmCopy,
  shouldEndLiveKitRoomAfterHostLeave,
} from '~/co-work/lib/meeting-end'
import { disconnectLiveKitParticipant, endLiveKitRoom } from '~/co-work/lib/livekit'
import {
  broadcastSignal,
  joinMeetingChannel,
  unsubscribeMeetingChannel,
} from '~/co-work/lib/signaling'
import type {
  Meeting,
  MeetingChatMessage,
  MeetingModerationSettings,
  MeetingParticipant,
  MeetingRole,
  SignalPayload,
} from '~/co-work/lib/types'
import type { LiveCaptionLine } from '~/co-work/lib/live-captions'
import type { FloatingMeetingReaction } from '~/co-work/lib/meeting-reactions'
import { canManageMeeting } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

type UseMeetingPresenceOptions = {
  meeting: Meeting
  userId: string
  displayName: string
  isHost: boolean
  enabled: boolean
}

type MediaHandlers = {
  onMuteAll?: () => void
  onMuteRequested?: () => void
  onForceMute?: () => void
  onAskToUnmute?: () => void
  onStopVideo?: () => void
  onMeetingEnded?: () => void
}

const POLL_INTERVAL_MS = 4000

/** Supabase-backed meeting presence + chat (signaling / participant state). Media is SFU-only via MeetingProvider. */
export function useMeetingPresence({
  meeting,
  userId,
  displayName,
  isHost,
  enabled,
}: UseMeetingPresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sessionIdRef = useRef(createMeetingSessionId())
  const connectGenerationRef = useRef(0)
  const handRaisedRef = useRef(false)
  const mediaHandlersRef = useRef<MediaHandlers>({})
  const controlsSinceRef = useRef(new Date().toISOString())
  const seenControlIdsRef = useRef(new Set<string>())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeActiveRef = useRef(false)
  const intentionalDisconnectRef = useRef(false)

  const [participants, setParticipants] = useState<MeetingParticipant[]>([])
  const [moderationSettings, setModerationSettings] = useState<MeetingModerationSettings | null>(null)
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([])
  const [panel, setPanel] = useState<
    'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio'
  >('none')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [removedByHost, setRemovedByHost] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})
  const [liveCaptions, setLiveCaptions] = useState<LiveCaptionLine[]>([])
  const [realtimeDegraded, setRealtimeDegraded] = useState(false)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
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
  // Prefer the meeting host_id over a stale meeting_roles row — otherwise the
  // real host loses Make co-host / End Meeting when roles lag behind.
  const selfRole: MeetingRole = isHost
    ? 'host'
    : selfParticipant?.role === 'co_host' || selfParticipant?.role === 'host'
      ? selfParticipant.role
      : 'participant'
  const canModerate = canManageMeeting(selfRole)
  const isWaiting = selfParticipant?.status === 'waiting'
  const isRejected = selfParticipant?.status === 'rejected'
  const isRemoved = removedByHost || selfParticipant?.status === 'removed'
  const waitingParticipants = participants.filter((p) => p.status === 'waiting')
  const hostParticipant = participants.find((p) => p.is_host || p.user_id === meeting.host_id)
  const isHostPresent =
    isHost ||
    onlineUserIds.includes(meeting.host_id) ||
    (!isRealtimeConnected && hostParticipant?.status === 'admitted')

  const refreshParticipants = useCallback(async () => {
    const rows = await fetchMeetingParticipants(meeting.id)
    setParticipants(rows)
    displayNameByUserRef.current = Object.fromEntries(
      rows.map((row) => {
        const name = safeMeetingDisplayName(
          row.display_name?.trim() ||
            row.profile?.full_name?.trim() ||
            row.profile?.username?.trim(),
          'Participant',
        )
        return [row.user_id, name]
      }),
    )
  }, [meeting.id])

  const refreshModerationSettings = useCallback(async () => {
    setModerationSettings(await fetchMeetingModerationSettings(meeting.id))
  }, [meeting.id])

  const refreshControls = useCallback(async () => {
    const events = await fetchMeetingControlEvents(meeting.id, controlsSinceRef.current)
    for (const event of events) {
      controlsSinceRef.current = event.created_at
      if (seenControlIdsRef.current.has(event.id) || event.actor_id === userId) continue
      seenControlIdsRef.current.add(event.id)
      if (event.target_user_id && event.target_user_id !== userId) continue
      if (event.action === 'request_mute' || event.action === 'ask_all_to_mute') {
        mediaHandlersRef.current.onMuteRequested?.()
      } else if (event.action === 'force_mute') {
        mediaHandlersRef.current.onForceMute?.()
      } else if (event.action === 'ask_to_unmute' || event.action === 'ask_all_to_unmute') {
        mediaHandlersRef.current.onAskToUnmute?.()
      } else if (event.action === 'stop_video') {
        mediaHandlersRef.current.onStopVideo?.()
      } else if (event.action === 'mute_all') {
        mediaHandlersRef.current.onMuteAll?.()
      } else if (event.action === 'meeting_ended') {
        mediaHandlersRef.current.onMeetingEnded?.()
      }
    }
  }, [meeting.id, userId])

  const refreshChat = useCallback(async () => {
    const rows = await fetchMeetingChat(meeting.id)
    setChatMessages(rows)
  }, [meeting.id])

  const ingestRemoteChatMessage = useCallback(
    (message: MeetingChatMessage) => {
      if (!message?.id) return
      // Own echoes arrive via local send; remote system messages use host/actor ids.
      if (message.sender_id === userId && message.audience !== 'system' && message.message_type !== 'system') {
        return
      }

      let isNew = false
      setChatMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        isNew = true
        return [...prev, message]
      })

      if (!isNew || panelRef.current === 'chat') return

      setUnreadChatCount((count) => count + 1)
      const senderName =
        message.audience === 'system' || message.message_type === 'system'
          ? 'Meeting'
          : displayNameByUserRef.current[message.sender_id] ||
            message.sender?.full_name ||
            message.sender?.username ||
            'Someone'
      setLatestChatNotice({
        id: message.id,
        title: message.audience === 'system' || message.message_type === 'system' ? 'Meeting update' : `${senderName} in chat`,
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
      void refreshParticipants().catch(() => undefined)
      void refreshModerationSettings().catch(() => undefined)
      void refreshControls().catch(() => undefined)
      if (!realtimeActiveRef.current) {
        void refreshChat().catch(() => undefined)
      }
    }, POLL_INTERVAL_MS)
  }, [refreshChat, refreshControls, refreshModerationSettings, refreshParticipants])

  const sendSignal = useCallback((payload: SignalPayload): boolean => {
    if (!channelRef.current) return false
    broadcastSignal(channelRef.current, payload)
    return true
  }, [])

  const handleConnectionState = useCallback((connected: boolean) => {
    if (intentionalDisconnectRef.current) return
    realtimeActiveRef.current = connected
    setIsRealtimeConnected(connected)
    if (!connected) setRealtimeDegraded(true)
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
      // Moderation controls are intentionally not trusted from broadcast
      // payloads. Only server-authorized meeting_control_events are applied.
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
      if (payload.type === 'meeting-ended' && payload.from !== userId) {
        mediaHandlersRef.current.onMeetingEnded?.()
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
    intentionalDisconnectRef.current = false
    setIsConnecting(true)
    setError(null)
    setConnectionFailed(false)
    setRemovedByHost(false)
    setIsRealtimeConnected(false)

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
      if (isHost && meeting.status !== 'active') {
        await startMeeting(meeting.id)
      }
      await refreshParticipants()
      await refreshModerationSettings()
    } catch (joinError) {
      if (generation !== connectGenerationRef.current) return
      const message = joinError instanceof Error ? joinError.message : 'Failed to join meeting'
      setError(message)
      setRemovedByHost(/removed from this meeting/i.test(message))
      setConnectionFailed(!/removed from this meeting/i.test(message))
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
        onPresenceSync: setOnlineUserIds,
        onConnectionState: handleConnectionState,
        onChatMessage: (row) => {
          if (row?.id && !row.is_deleted) {
            ingestRemoteChatMessage({
              id: row.id,
              meeting_id: row.meeting_id,
              sender_id: row.sender_id,
              message_text: row.message_text,
              message_type: row.message_type,
              created_at: row.created_at,
              audience: (row.audience as MeetingChatMessage['audience']) ?? 'everyone',
              recipient_id: row.recipient_id ?? null,
              system_event_type: row.system_event_type ?? null,
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
      setIsRealtimeConnected(true)
      setRealtimeDegraded(false)
      // Realtime events can be dropped while an app sleeps or changes network.
      // Keep a cheap participant reconciliation poll so waiting-room decisions
      // are observed within a few seconds instead of leaving guests stuck.
      startPolling()
      await refreshChat()
    } catch {
      if (generation !== connectGenerationRef.current) return

      realtimeActiveRef.current = false
      setIsRealtimeConnected(false)
      setRealtimeDegraded(true)
      startPolling()
      await refreshChat()
    }
  }, [
    enabled,
    displayName,
    handleSignal,
    handleConnectionState,
    ingestRemoteChatMessage,
    isHost,
    meeting,
    refreshChat,
    refreshModerationSettings,
    refreshParticipants,
    startPolling,
    stopPolling,
    userId,
  ])

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true
    stopPolling()
    realtimeActiveRef.current = false
    setIsRealtimeConnected(false)
    setOnlineUserIds([])
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
      await leaveMeetingParticipant(meeting.id, userId, sessionIdRef.current)
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
    async (
      text: string,
      audience: MeetingChatAudience = 'everyone',
      recipientId?: string | null,
    ) => {
      const message = await sendMeetingChatMessage(meeting.id, userId, text, {
        audience:
          audience === 'hosts' ? 'hosts' : audience === 'private' ? 'private' : 'everyone',
        recipientId: audience === 'private' ? recipientId ?? null : null,
      })
      setChatMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        return [...prev, message]
      })
      sendSignal({ type: 'chat', from: userId, message })
    },
    [meeting.id, sendSignal, userId],
  )

  const deleteChat = useCallback(
    async (messageId: string) => {
      await softDeleteMeetingChatMessage(messageId)
      setChatMessages((prev) => prev.filter((row) => row.id !== messageId))
      await refreshChat()
    },
    [refreshChat],
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

  const remove = useCallback(
    async (participantId: string) => {
      const participant = participants.find((row) => row.id === participantId)
      if (!participant || participant.is_host) return
      await removeMeetingParticipant(meeting.id, participant.user_id)
      try {
        if (meeting.room_id) {
          await disconnectLiveKitParticipant(meeting.id, meeting.room_id, participant.user_id)
        }
      } finally {
        await refreshParticipants()
      }
    },
    [meeting.id, meeting.room_id, participants, refreshParticipants],
  )

  const allowRejoin = useCallback(
    async (participantId: string) => {
      await allowMeetingParticipantRejoin(participantId)
      await refreshParticipants()
    },
    [refreshParticipants],
  )

  const leave = useCallback(async () => {
    const roleAtLeave = selfRole
    connectGenerationRef.current += 1
    // Notify peers before tearing down the channel when host leave will end the room.
    if (roleAtLeave === 'host') {
      const outcome = hostLeaveConfirmCopy({
        behavior: moderationSettings?.host_leave_behavior,
        participants,
        hostUserId: userId,
      })
      if (outcome.willEndMeeting) {
        sendSignal({ type: 'meeting-ended', from: userId, timestamp: Date.now() })
      }
    }
    // Server leave_meeting_participant transfers host or ends the meeting.
    await disconnect()
    if (roleAtLeave === 'host' && meeting.room_id) {
      try {
        const latest = await fetchMeetingById(meeting.id)
        if (
          shouldEndLiveKitRoomAfterHostLeave({
            previousRole: roleAtLeave,
            meetingStatus: latest?.status,
          })
        ) {
          await endLiveKitRoom(meeting.id, meeting.room_id)
        }
      } catch {
        // Transfer keeps the LiveKit room alive; ending is best-effort.
      }
    }
  }, [
    disconnect,
    meeting.id,
    meeting.room_id,
    moderationSettings?.host_leave_behavior,
    participants,
    selfRole,
    sendSignal,
    userId,
  ])

  const hostEnd = useCallback(async () => {
    try {
      // Notify peers immediately (control-event poll is the authoritative path).
      sendSignal({ type: 'meeting-ended', from: userId, timestamp: Date.now() })
      await endMeeting(meeting.id)
      if (meeting.room_id) await endLiveKitRoom(meeting.id, meeting.room_id)
    } catch {
      // Still disconnect locally so the host can exit the room UI.
    }
    connectGenerationRef.current += 1
    await disconnect()
  }, [disconnect, meeting.id, meeting.room_id, sendSignal, userId])

  const setHostLeaveBehavior = useCallback(
    async (behavior: MeetingModerationSettings['host_leave_behavior']) => {
      await setMeetingHostLeaveBehavior(meeting.id, behavior)
      await refreshModerationSettings()
    },
    [meeting.id, refreshModerationSettings],
  )

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

  const muteAll = useCallback(async () => {
    await sendMeetingControl(meeting.id, 'mute_all')
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const askAllToMute = useCallback(async () => {
    await sendMeetingControl(meeting.id, 'ask_all_to_mute')
  }, [meeting.id])

  const askAllToUnmute = useCallback(async () => {
    await sendMeetingControl(meeting.id, 'ask_all_to_unmute')
  }, [meeting.id])

  const requestMute = useCallback(async (targetUserId: string) => {
    await sendMeetingControl(meeting.id, 'request_mute', targetUserId)
  }, [meeting.id])

  const forceMute = useCallback(async (targetUserId: string) => {
    await sendMeetingControl(meeting.id, 'force_mute', targetUserId)
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const askToUnmute = useCallback(async (targetUserId: string) => {
    await sendMeetingControl(meeting.id, 'ask_to_unmute', targetUserId)
  }, [meeting.id])

  const stopVideo = useCallback(async (targetUserId: string) => {
    await sendMeetingControl(meeting.id, 'stop_video', targetUserId)
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const removeAllExceptHost = useCallback(async () => {
    await sendMeetingControl(meeting.id, 'remove_all_except_host')
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const setLocked = useCallback(async (locked: boolean) => {
    await setMeetingLocked(meeting.id, locked)
    await refreshModerationSettings()
  }, [meeting.id, refreshModerationSettings])

  const assignCoHost = useCallback(async (targetUserId: string) => {
    await assignMeetingCoHost(meeting.id, targetUserId)
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const removeCoHost = useCallback(async (targetUserId: string) => {
    await removeMeetingCoHost(meeting.id, targetUserId)
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

  const transferHost = useCallback(async (targetUserId: string) => {
    await transferMeetingHost(meeting.id, targetUserId)
    await refreshParticipants()
  }, [meeting.id, refreshParticipants])

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
      await updateParticipantMedia(meeting.id, userId, patch, sessionIdRef.current)
    },
    [meeting.id, userId],
  )

  const registerMediaHandlers = useCallback((handlers: MediaHandlers) => {
    mediaHandlersRef.current = handlers
  }, [])

  const togglePanel = useCallback((next: 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio') => {
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
    (next: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio') => {
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

  // Auto-heal Supabase realtime after brief network blips so chat/participants
  // do not stay stuck on "Live updates paused" until the user taps Reconnect.
  useEffect(() => {
    if (!enabled || !realtimeDegraded || isRealtimeConnected) return
    const handle = setTimeout(() => {
      void connect()
    }, 3500)
    return () => clearTimeout(handle)
  }, [connect, enabled, isRealtimeConnected, realtimeDegraded])

  const retryJoinRequest = useCallback(async () => {
    setError(null)
    await connect()
  }, [connect])

  return {
    participants,
    moderationSettings,
    selfRole,
    canModerate,
    chatMessages,
    panel,
    error,
    isConnecting,
    isWaiting,
    isRejected,
    isRemoved,
    connectionFailed,
    waitingParticipants,
    handRaised,
    raisedHands,
    liveCaptions,
    realtimeDegraded,
    isRealtimeConnected,
    isHostPresent,
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
    deleteChat,
    admit,
    reject,
    admitAllWaiting,
    remove,
    allowRejoin,
    leave,
    hostEnd,
    setHostLeaveBehavior,
    toggleHandRaise,
    muteAll,
    askAllToMute,
    askAllToUnmute,
    requestMute,
    forceMute,
    askToUnmute,
    stopVideo,
    removeAllExceptHost,
    setLocked,
    assignCoHost,
    removeCoHost,
    transferHost,
    broadcastCaption,
    syncMediaState,
    registerMediaHandlers,
    retryRealtime,
    retryJoinRequest,
    refreshParticipants,
  }
}
