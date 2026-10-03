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
  updateMeetingParticipantDisplayName,
  leaveMeetingParticipant,
  removeMeetingParticipant,
  putMeetingParticipantInWaitingRoom,
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
  shouldEndMediaRoomAfterHostLeave,
} from '~/co-work/lib/meeting-end'
import { disconnectMediaParticipant, endMediaRoom } from '~/co-work/lib/meeting-media-moderation'
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
import {
  isMeetingNonverbalStatusId,
  type MeetingNonverbalStatusId,
} from '~/co-work/lib/meeting-nonverbal'
import { canViewerSeeMeetingChatMessage } from '~/co-work/lib/meeting-chat'
import { sanitizeRemoteMeetingChatMessage } from '~/co-work/lib/meeting-chat-attachments'
import { uploadMeetingFile, type MeetingContentSource } from '~/co-work/lib/meeting-content-upload'
import { canManageMeeting } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import {
  applyWhiteboardEvent,
  emptyWhiteboardSession,
  WHITEBOARD_MAX_STROKES,
  type WhiteboardSession,
  type WhiteboardStroke,
} from '~/co-work/lib/meeting-whiteboard'
import {
  MEETING_CONTENT_HEARTBEAT_MS,
  applyMeetingContentEvent,
  createMeetingContentShareId,
  emptyMeetingContentState,
  isMeetingContentShare,
  meetingContentIsStale,
  meetingContentVideoPosition,
  trimToPayloadBudget,
  type MeetingContentItem,
  type MeetingContentShare,
  type MeetingContentState,
} from '~/co-work/lib/meeting-content-share'
import { supabaseConfig } from '~/lib/supabase/env'
import {
  meetingPresenceHealDelayMs,
  meetingPresencePollIntervalMs,
  shouldShowMeetingJoiningOverlay,
  shouldSkipStackedPresenceConnect,
  type MeetingPresencePollMode,
} from '~/co-work/lib/meeting-presence-refresh'

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
  const pollModeRef = useRef<MeetingPresencePollMode | 'off'>('off')
  const realtimeActiveRef = useRef(false)
  const intentionalDisconnectRef = useRef(false)
  const connectInFlightRef = useRef(false)
  const hasJoinedRef = useRef(false)
  const healAttemptRef = useRef(0)
  const participantsInFlightRef = useRef(false)

  const [participants, setParticipants] = useState<MeetingParticipant[]>([])
  const [moderationSettings, setModerationSettings] = useState<MeetingModerationSettings | null>(null)
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([])
  const [panel, setPanel] = useState<
    | 'none'
    | 'chat'
    | 'people'
    | 'invite'
    | 'info'
    | 'recordings'
    | 'backgrounds'
    | 'audio'
    | 'host_tools'
    | 'polls'
    | 'qna'
    | 'breakouts'
    | 'notes'
  >('none')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [removedByHost, setRemovedByHost] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})
  const [liveCaptions, setLiveCaptions] = useState<LiveCaptionLine[]>([])
  const [captionWantedByUser, setCaptionWantedByUser] = useState<Record<string, boolean>>({})
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
  const [liveRecordingSignal, setLiveRecordingSignal] = useState<boolean | null>(null)
  const [nonverbalByUserId, setNonverbalByUserId] = useState<
    Record<string, MeetingNonverbalStatusId>
  >({})
  const [localNonverbal, setLocalNonverbal] = useState<MeetingNonverbalStatusId | null>(null)
  const [liveTopic, setLiveTopic] = useState<string | null>(null)
  const [whiteboard, setWhiteboard] = useState(emptyWhiteboardSession)
  const whiteboardRef = useRef<WhiteboardSession>(whiteboard)
  whiteboardRef.current = whiteboard
  const [contentState, setContentState] = useState<MeetingContentState>(emptyMeetingContentState)
  const contentStateRef = useRef(contentState)
  contentStateRef.current = contentState
  /** Our own late-join request, and requests someone already answered. */
  const shareStateRequestIdRef = useRef<string | null>(null)
  const answeredShareRequestsRef = useRef(new Set<string>())
  /** Host spotlight for everyone — synced via realtime broadcast. */
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null)
  const [webinarMode, setWebinarMode] = useState(false)
  const [interpretationChannelId, setInterpretationChannelId] = useState<string | null>('floor')
  const [breakoutBroadcast, setBreakoutBroadcast] = useState<{
    id: string
    message: string
  } | null>(null)
  const [breakoutEndsAt, setBreakoutEndsAt] = useState<number | null>(null)
  const [remoteControlRequest, setRemoteControlRequest] = useState<{
    from: string
    name: string
    timestamp: number
  } | null>(null)
  const [recordingRequest, setRecordingRequest] = useState<{
    from: string
    name: string
    timestamp: number
  } | null>(null)
  const [annotationStrokes, setAnnotationStrokes] = useState<
    Array<{
      id: string
      color: string
      width: number
      points: Array<{ x: number; y: number }>
      from: string
      createdAt: number
    }>
  >([])
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const displayNameByUserRef = useRef<Record<string, string>>({})
  const participantsCountRef = useRef(0)

  const panelRef = useRef(panel)
  panelRef.current = panel
  participantsCountRef.current = participants.length

  const selfParticipant = participants.find((p) => p.user_id === userId)
  // Prefer the meeting host_id over a stale meeting_roles row — otherwise the
  // real host loses Make co-host / End Meeting when roles lag behind.
  const selfRole: MeetingRole = isHost
    ? 'host'
    : selfParticipant?.role === 'co_host' || selfParticipant?.role === 'host'
      ? selfParticipant.role
      : 'participant'
  const selfRoleRef = useRef(selfRole)
  selfRoleRef.current = selfRole
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
    if (participantsInFlightRef.current) return
    participantsInFlightRef.current = true
    try {
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
    } finally {
      participantsInFlightRef.current = false
    }
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
    setChatMessages(
      rows.filter((row) =>
        canViewerSeeMeetingChatMessage({
          message: row,
          viewerId: userId,
          viewerRole: selfRoleRef.current,
        }),
      ),
    )
  }, [meeting.id])

  const ingestRemoteChatMessage = useCallback(
    (incoming: MeetingChatMessage) => {
      if (!incoming?.id) return
      const message = sanitizeRemoteMeetingChatMessage(incoming, supabaseConfig.url)
      if (
        !canViewerSeeMeetingChatMessage({
          message,
          viewerId: userId,
          viewerRole: selfRoleRef.current,
        })
      ) {
        return
      }
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

      // Join/leave system lines stay in chat history only — no toast over the stage.
      if (
        message.audience === 'system' ||
        message.message_type === 'system' ||
        message.system_event_type
      ) {
        const event = message.system_event_type
        const text = message.message_text || ''
        if (
          event === 'participant_left' ||
          event === 'participant_joined' ||
          event === 'participant_admitted' ||
          / (left|joined|was admitted)$/i.test(text.trim())
        ) {
          return
        }
      }

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
    pollModeRef.current = 'off'
  }, [])

  const startPolling = useCallback((mode: MeetingPresencePollMode) => {
    if (pollRef.current && pollModeRef.current === mode) return
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    pollModeRef.current = mode
    const tick = () => {
      void refreshParticipants().catch(() => undefined)
      void refreshModerationSettings().catch(() => undefined)
      void refreshControls().catch(() => undefined)
      if (mode === 'degraded' || !realtimeActiveRef.current) {
        void refreshChat().catch(() => undefined)
      }
    }
    const interval = meetingPresencePollIntervalMs({
      mode,
      participantCount: participantsCountRef.current,
    })
    pollRef.current = setInterval(tick, interval)
  }, [refreshChat, refreshControls, refreshModerationSettings, refreshParticipants])

  const sendSignal = useCallback((payload: SignalPayload): boolean => {
    if (!channelRef.current) return false
    broadcastSignal(channelRef.current, payload)
    return true
  }, [])

  const handleConnectionState = useCallback(
    (connected: boolean) => {
      if (intentionalDisconnectRef.current) return
      console.debug(
        `[presence] handleConnectionState meeting=${meeting.id} user=${userId} connected=${connected} time=${new Date().toISOString()}`,
      )
      realtimeActiveRef.current = connected
      setIsRealtimeConnected(connected)
      if (!connected) {
        setRealtimeDegraded(true)
        startPolling('degraded')
      } else {
        setRealtimeDegraded(false)
        healAttemptRef.current = 0
        startPolling('healthy')
      }
    },
    [meeting.id, startPolling, userId],
  )

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

  /** Our share with the video position brought up to now, for re-broadcasts. */
  const freshOwnContentShare = useCallback((): MeetingContentShare | null => {
    const { share, receivedAt } = contentStateRef.current
    if (!share || share.from !== userId) return null
    const now = Date.now()
    return { ...share, positionSec: meetingContentVideoPosition(share, receivedAt, now), updatedAt: now }
  }, [userId])

  const answerShareStateRequest = useCallback(
    (requestId: string) => {
      const own = freshOwnContentShare()
      if (own) sendSignal({ type: 'content-share', from: userId, share: own })
      const board = whiteboardRef.current
      if (!board.active) return
      // Whoever started the board answers first; others only if nobody has.
      const delay = board.startedBy === userId ? 0 : 300 + Math.floor(Math.random() * 900)
      setTimeout(() => {
        if (answeredShareRequestsRef.current.has(requestId)) return
        const latest = whiteboardRef.current
        if (!latest.active) return
        answeredShareRequestsRef.current.add(requestId)
        sendSignal({
          type: 'whiteboard-sync',
          from: userId,
          requestId,
          startedBy: latest.startedBy,
          strokes: trimToPayloadBudget(latest.strokes),
        })
      }, delay)
    },
    [freshOwnContentShare, sendSignal, userId],
  )

  const handleSignal = useCallback(
    (payload: SignalPayload) => {
      if (payload.type === 'content-share') {
        const share = payload.share
        if (!isMeetingContentShare(share, supabaseConfig.url) || share.from !== payload.from) return
        setContentState((current) =>
          applyMeetingContentEvent(current, { type: 'share', share, receivedAt: Date.now() }),
        )
        return
      }
      if (payload.type === 'content-share-stop') {
        setContentState((current) =>
          current.share?.from === payload.from
            ? applyMeetingContentEvent(current, { type: 'stop', id: payload.id })
            : current,
        )
        return
      }
      if (payload.type === 'share-state-request') {
        if (payload.from !== userId && typeof payload.requestId === 'string') {
          answerShareStateRequest(payload.requestId)
        }
        return
      }
      if (payload.type === 'whiteboard-sync') {
        if (answeredShareRequestsRef.current.size > 200) answeredShareRequestsRef.current.clear()
        answeredShareRequestsRef.current.add(payload.requestId)
        if (payload.requestId !== shareStateRequestIdRef.current) return
        shareStateRequestIdRef.current = null
        const incoming = Array.isArray(payload.strokes) ? payload.strokes.filter((row) => !!row?.id) : []
        setWhiteboard((current) => {
          const seen = new Set(current.strokes.map((row) => row.id))
          return {
            active: true,
            startedBy: current.startedBy ?? payload.startedBy ?? payload.from,
            strokes: [...incoming.filter((row) => !seen.has(row.id)), ...current.strokes].slice(
              -WHITEBOARD_MAX_STROKES,
            ),
          }
        })
        return
      }
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
      if (payload.type === 'nonverbal-feedback') {
        const status = payload.status
        setNonverbalByUserId((prev) => {
          if (status == null) {
            if (!(payload.from in prev)) return prev
            const next = { ...prev }
            delete next[payload.from]
            return next
          }
          if (!isMeetingNonverbalStatusId(status)) return prev
          if (prev[payload.from] === status) return prev
          return { ...prev, [payload.from]: status }
        })
        return
      }
      if (payload.type === 'lower-all-hands') {
        handRaisedRef.current = false
        setHandRaised(false)
        setRaisedHands({})
        return
      }
      if (payload.type === 'lower-hand' && payload.targetUserId) {
        const target = payload.targetUserId
        if (target === userId) {
          handRaisedRef.current = false
          setHandRaised(false)
        }
        setRaisedHands((prev) => {
          if (!prev[target]) return prev
          const next = { ...prev }
          delete next[target]
          return next
        })
        return
      }
      if (payload.type === 'clear-all-feedback') {
        setLocalNonverbal(null)
        setNonverbalByUserId({})
        return
      }
      if (payload.type === 'meeting-topic' && payload.title?.trim()) {
        setLiveTopic(payload.title.trim())
        return
      }
      // Moderation controls are intentionally not trusted from broadcast
      // payloads. Only server-authorized meeting_control_events are applied.
      // Live captions: accept finals + interim so peers see Zoom-style live text.
      if (payload.type === 'caption' && payload.from !== userId) {
        // Stable interim id per speaker so viewers can cache/translate without
        // cancelling work on every STT partial (timestamp churn).
        const nextLine: LiveCaptionLine = {
          id: payload.isFinal
            ? `${payload.from}-${payload.timestamp}-f`
            : `${payload.from}-interim`,
          userId: payload.from,
          speaker: payload.speaker,
          text: payload.text,
          originalText: payload.text,
          sourceLang: payload.sourceLang ?? null,
          isFinal: !!payload.isFinal,
          timestamp: payload.timestamp,
        }
        setLiveCaptions((current) => {
          const withoutPeerInterim = current.filter(
            (line) => !(line.userId === payload.from && !line.isFinal),
          )
          if (!payload.isFinal) {
            return [...withoutPeerInterim.slice(-80), nextLine]
          }
          return [...withoutPeerInterim.slice(-80), nextLine]
        })
        return
      }
      if (payload.type === 'caption-wanted' && payload.from !== userId) {
        setCaptionWantedByUser((current) => {
          if (!payload.wanted) {
            const next = { ...current }
            delete next[payload.from]
            return next
          }
          if (current[payload.from]) return current
          return { ...current, [payload.from]: true }
        })
        return
      }
      if (payload.type === 'meeting-ended' && payload.from !== userId) {
        mediaHandlersRef.current.onMeetingEnded?.()
        return
      }
      if (payload.type === 'whiteboard-open') {
        setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'open', from: payload.from }))
        return
      }
      if (payload.type === 'whiteboard-close') {
        setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'close' }))
        return
      }
      if (payload.type === 'whiteboard-stroke' && payload.stroke) {
        setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'stroke', stroke: payload.stroke }))
        return
      }
      if (payload.type === 'whiteboard-undo') {
        setWhiteboard((current) =>
          applyWhiteboardEvent(current, { type: 'undo', strokeId: payload.strokeId, from: payload.from }),
        )
        return
      }
      if (payload.type === 'whiteboard-clear') {
        setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'clear' }))
        return
      }
      if (payload.type === 'spotlight') {
        setSpotlightUserId(payload.targetUserId ? String(payload.targetUserId) : null)
        return
      }
      if (payload.type === 'webinar-mode') {
        setWebinarMode(!!payload.enabled)
        return
      }
      if (payload.type === 'interpretation-channel') {
        setInterpretationChannelId(payload.channelId ? String(payload.channelId) : 'floor')
        return
      }
      if (payload.type === 'breakout-broadcast') {
        setBreakoutBroadcast({
          id: `bo-bcast-${payload.timestamp}`,
          message: payload.message,
        })
        setLatestChatNotice({
          id: `bo-bcast-${payload.timestamp}`,
          title: 'Breakout broadcast',
          message: payload.message,
        })
        return
      }
      if (payload.type === 'breakout-timer') {
        setBreakoutEndsAt(typeof payload.endsAt === 'number' ? payload.endsAt : null)
        return
      }
      if (payload.type === 'annotation-open') {
        setAnnotationOpen(true)
        return
      }
      if (payload.type === 'annotation-close') {
        setAnnotationOpen(false)
        setAnnotationStrokes([])
        return
      }
      if (payload.type === 'annotation-clear') {
        setAnnotationStrokes([])
        return
      }
      if (payload.type === 'annotation-stroke' && payload.stroke) {
        setAnnotationOpen(true)
        setAnnotationStrokes((current) => [...current, payload.stroke].slice(-200))
        return
      }
      if (payload.type === 'remote-control-request' && payload.to === userId) {
        setRemoteControlRequest({
          from: payload.from,
          name: payload.name || 'Someone',
          timestamp: payload.timestamp,
        })
        return
      }
      if (payload.type === 'remote-control-response' && payload.to === userId) {
        setLatestChatNotice({
          id: `rc-resp-${payload.timestamp}`,
          title: 'Remote control',
          message: payload.accepted
            ? 'Your remote control request was accepted'
            : 'Your remote control request was denied',
        })
        return
      }
      if (payload.type === 'recording-request' && payload.from !== userId) {
        setRecordingRequest({
          from: payload.from,
          name: payload.name || 'Someone',
          timestamp: payload.timestamp,
        })
        return
      }
      if (payload.type === 'recording-response') {
        // Any host answering closes the prompt for the other hosts too.
        setRecordingRequest((current) => (current?.from === payload.to ? null : current))
        if (payload.to === userId) {
          setLatestChatNotice({
            id: `rec-resp-${payload.timestamp}`,
            title: 'Recording',
            message: payload.accepted
              ? 'The host started recording this meeting'
              : 'The host declined your recording request',
          })
        }
        return
      }
      if (payload.type === 'host-transferred') {
        void refreshParticipants()
        return
      }
      if (payload.type === 'recording-status') {
        setLiveRecordingSignal(payload.isRecording)
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
    [answerShareStateRequest, ingestRemoteChatMessage, pushFloatingReaction, userId],
  )

  const waitingRoomEnabled = !isHost && !!meeting.security_settings?.waitingRoom

  const connect = useCallback(async (opts?: { heal?: boolean }) => {
    if (!enabled) return
    if (shouldSkipStackedPresenceConnect(connectInFlightRef.current)) return

    const heal = !!opts?.heal && hasJoinedRef.current
    const showJoining = shouldShowMeetingJoiningOverlay({
      heal,
      hasJoined: hasJoinedRef.current,
    })
    connectInFlightRef.current = true
    const generation = ++connectGenerationRef.current
    intentionalDisconnectRef.current = false
    setError(null)
    setConnectionFailed(false)
    if (showJoining) {
      setRemovedByHost(false)
      setIsConnecting(true)
    }
    if (heal) {
      healAttemptRef.current += 1
    }

    try {
      if (!heal) {
        await joinMeetingParticipant(
          meeting.id,
          userId,
          isHost,
          waitingRoomEnabled,
          sessionIdRef.current,
          displayName,
        )
        // Host reopen: startMeeting refreshes DB status (ignore stale client cache).
        if (isHost) {
          await startMeeting(meeting.id)
        }
        if (generation !== connectGenerationRef.current) return
        await refreshParticipants()
        await refreshModerationSettings()
        hasJoinedRef.current = true
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
              return
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
        healAttemptRef.current = 0
        startPolling('healthy')
        // Broadcast has no history: ask presenters for the board and content on stage.
        const requestId = `${userId}-${Date.now()}`
        shareStateRequestIdRef.current = requestId
        setTimeout(() => {
          if (channelRef.current !== channel) return
          broadcastSignal(channel, { type: 'share-state-request', from: userId, requestId })
        }, 800)
        await refreshChat()
      } catch {
        if (generation !== connectGenerationRef.current) return

        realtimeActiveRef.current = false
        setIsRealtimeConnected(false)
        setRealtimeDegraded(true)
        startPolling('degraded')
        await refreshChat()
      }
    } catch (joinError) {
      if (generation !== connectGenerationRef.current) return
      const message = joinError instanceof Error ? joinError.message : 'Failed to join meeting'
      setError(message)
      setRemovedByHost(/removed from this meeting/i.test(message))
      setConnectionFailed(!/removed from this meeting/i.test(message))
      setIsConnecting(false)
    } finally {
      connectInFlightRef.current = false
      if (showJoining && generation === connectGenerationRef.current) {
        setIsConnecting(false)
      }
    }
  }, [
    enabled,
    displayName,
    handleSignal,
    handleConnectionState,
    ingestRemoteChatMessage,
    isHost,
    meeting.id,
    refreshChat,
    refreshModerationSettings,
    refreshParticipants,
    startPolling,
    userId,
    waitingRoomEnabled,
  ])

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true
    connectInFlightRef.current = false
    stopPolling()
    realtimeActiveRef.current = false
    setIsRealtimeConnected(false)
    setWhiteboard(emptyWhiteboardSession())
    setOnlineUserIds([])
    const channel = channelRef.current
    const ownShare = contentStateRef.current.share
    if (channel && ownShare?.from === userId) {
      broadcastSignal(channel, { type: 'content-share-stop', from: userId, id: ownShare.id })
    }
    setContentState(emptyMeetingContentState())
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

    hasJoinedRef.current = false
    healAttemptRef.current = 0
    connectInFlightRef.current = false
    void connect()

    return () => {
      connectGenerationRef.current += 1
      hasJoinedRef.current = false
      connectInFlightRef.current = false
      void disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meeting.id, userId])

  useEffect(() => {
    if (!hasJoinedRef.current) return
    void updateMeetingParticipantDisplayName(meeting.id, sessionIdRef.current, displayName)
      .then(() => refreshParticipants())
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName])

  const sendChat = useCallback(
    async (
      text: string,
      audience: MeetingChatAudience = 'everyone',
      recipientId?: string | null,
      source?: MeetingContentSource,
    ) => {
      const uploaded = source ? await uploadMeetingFile(meeting.id, userId, source) : null
      const message = await sendMeetingChatMessage(meeting.id, userId, text, {
        audience:
          audience === 'hosts' ? 'hosts' : audience === 'private' ? 'private' : 'everyone',
        recipientId: audience === 'private' ? recipientId ?? null : null,
        attachment: uploaded ? { ...uploaded, size: uploaded.size || null } : undefined,
      })
      setChatMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        return [...prev, message]
      })
      sendSignal({ type: 'chat', from: userId, message })
    },
    [meeting.id, sendSignal, userId],
  )

  const sendChatAttachment = useCallback(
    (source: MeetingContentSource, audience?: MeetingChatAudience, recipientId?: string | null) =>
      sendChat('', audience, recipientId, source),
    [sendChat],
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

  const setNonverbalFeedback = useCallback(
    (status: MeetingNonverbalStatusId | null) => {
      setLocalNonverbal(status)
      setNonverbalByUserId((prev) => {
        if (status == null) {
          if (!(userId in prev)) return prev
          const next = { ...prev }
          delete next[userId]
          return next
        }
        return { ...prev, [userId]: status }
      })
      sendSignal({
        type: 'nonverbal-feedback',
        from: userId,
        status,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const lowerAllHands = useCallback(() => {
    handRaisedRef.current = false
    setHandRaised(false)
    setRaisedHands({})
    sendSignal({ type: 'lower-all-hands', from: userId, timestamp: Date.now() })
  }, [sendSignal, userId])

  const lowerHandFor = useCallback(
    (targetUserId: string) => {
      const target = String(targetUserId || '').trim()
      if (!target) return
      if (target === userId) {
        handRaisedRef.current = false
        setHandRaised(false)
      }
      setRaisedHands((prev) => {
        if (!prev[target]) return prev
        const next = { ...prev }
        delete next[target]
        return next
      })
      sendSignal({
        type: 'lower-hand',
        from: userId,
        targetUserId: target,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const clearAllFeedback = useCallback(() => {
    setLocalNonverbal(null)
    setNonverbalByUserId({})
    sendSignal({ type: 'clear-all-feedback', from: userId, timestamp: Date.now() })
  }, [sendSignal, userId])

  const setMeetingTopicLive = useCallback(
    (title: string) => {
      const next = title.trim()
      if (!next) return
      setLiveTopic(next)
      sendSignal({ type: 'meeting-topic', from: userId, title: next, timestamp: Date.now() })
    },
    [sendSignal, userId],
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
      if (meeting.room_id) {
        // Best-effort: the removed client also leaves the SFU on its own.
        await disconnectMediaParticipant(meeting.id, meeting.room_id, participant.user_id).catch(() => {})
      }
      await refreshParticipants()
    },
    [meeting.id, meeting.room_id, participants, refreshParticipants],
  )

  const putInWaitingRoom = useCallback(
    async (participantId: string) => {
      const participant = participants.find((row) => row.id === participantId)
      if (!participant || participant.is_host) return
      await putMeetingParticipantInWaitingRoom(meeting.id, participant.user_id)
      if (meeting.room_id) {
        // Best-effort: the removed client also leaves the SFU on its own.
        await disconnectMediaParticipant(meeting.id, meeting.room_id, participant.user_id).catch(() => {})
      }
      await refreshParticipants()
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
          shouldEndMediaRoomAfterHostLeave({
            previousRole: roleAtLeave,
            meetingStatus: latest?.status,
          })
        ) {
          await endMediaRoom(meeting.id, meeting.room_id)
        }
      } catch {
        // Transfer keeps the media room alive; ending is best-effort.
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
      if (meeting.room_id) await endMediaRoom(meeting.id, meeting.room_id)
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

  const transferHost = useCallback(
    async (targetUserId: string) => {
      await transferMeetingHost(meeting.id, targetUserId)
      sendSignal({
        type: 'host-transferred',
        from: userId,
        newHostId: targetUserId,
        timestamp: Date.now(),
      })
      await refreshParticipants()
    },
    [meeting.id, refreshParticipants, sendSignal, userId],
  )

  const broadcastRecordingStatus = useCallback(
    (isRecording: boolean) => {
      setLiveRecordingSignal(isRecording)
      sendSignal({
        type: 'recording-status',
        from: userId,
        isRecording,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const broadcastCaption = useCallback(
    (text: string, speaker: string, sourceLang?: string, isFinal = true) => {
      const trimmed = text.trim()
      if (!trimmed) return
      sendSignal({
        type: 'caption',
        from: userId,
        speaker,
        text: trimmed,
        isFinal,
        timestamp: Date.now(),
        sourceLang: sourceLang || undefined,
      })
    },
    [sendSignal, userId],
  )

  const setCaptionWanted = useCallback(
    (wanted: boolean) => {
      setCaptionWantedByUser((current) => {
        if (wanted) {
          if (current[userId]) return current
          return { ...current, [userId]: true }
        }
        if (!current[userId]) return current
        const next = { ...current }
        delete next[userId]
        return next
      })
      sendSignal({
        type: 'caption-wanted',
        from: userId,
        wanted,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  // `caption-wanted` is only broadcast on toggle, so re-announce ours to peers
  // who join afterwards or they never start publishing their speech.
  const seenOnlineUserIdsRef = useRef<Set<string>>(new Set())
  const captionAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wantsCaptionsSelf = !!captionWantedByUser[userId]
  const wantsCaptionsSelfRef = useRef(wantsCaptionsSelf)
  wantsCaptionsSelfRef.current = wantsCaptionsSelf
  useEffect(() => {
    const seen = seenOnlineUserIdsRef.current
    const newcomers = onlineUserIds.filter((id) => id !== userId && !seen.has(id))
    seenOnlineUserIdsRef.current = new Set(onlineUserIds)
    if (!wantsCaptionsSelf || newcomers.length === 0 || captionAnnounceTimerRef.current) return
    captionAnnounceTimerRef.current = setTimeout(() => {
      captionAnnounceTimerRef.current = null
      if (!wantsCaptionsSelfRef.current) return
      sendSignal({ type: 'caption-wanted', from: userId, wanted: true, timestamp: Date.now() })
    }, 800)
  }, [onlineUserIds, sendSignal, userId, wantsCaptionsSelf])
  useEffect(
    () => () => {
      if (captionAnnounceTimerRef.current) clearTimeout(captionAnnounceTimerRef.current)
    },
    [],
  )

  const roomWantsCaptions = Object.entries(captionWantedByUser).some(
    ([id, wanted]) =>
      wanted &&
      (id === userId || !isRealtimeConnected || onlineUserIds.length === 0 || onlineUserIds.includes(id)),
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

  const togglePanel = useCallback(
    (
      next:
        | 'chat'
        | 'people'
        | 'invite'
        | 'info'
        | 'recordings'
        | 'backgrounds'
        | 'audio'
        | 'host_tools'
        | 'polls'
        | 'qna'
        | 'breakouts'
        | 'notes',
    ) => {
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
    (
      next:
        | 'none'
        | 'chat'
        | 'people'
        | 'invite'
        | 'info'
        | 'recordings'
        | 'backgrounds'
        | 'audio'
        | 'host_tools'
        | 'polls'
        | 'qna'
        | 'breakouts'
        | 'notes',
    ) => {
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
    healAttemptRef.current = 0
    void connect({ heal: hasJoinedRef.current })
  }, [connect])

  const connectRef = useRef(connect)
  connectRef.current = connect

  // Auto-heal the realtime channel after a drop. Never remount the room UI
  // (heal skips isConnecting) and never stack on an in-flight join/retry.
  useEffect(() => {
    if (!enabled || !realtimeDegraded || isRealtimeConnected) return
    let cancelled = false
    let handle: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (handle) clearTimeout(handle)
      const delay = meetingPresenceHealDelayMs(healAttemptRef.current)
      handle = setTimeout(() => {
        if (cancelled) return
        void connectRef.current({ heal: true }).finally(() => {
          if (cancelled || realtimeActiveRef.current) return
          schedule()
        })
      }, delay)
    }

    schedule()
    return () => {
      cancelled = true
      if (handle) clearTimeout(handle)
    }
  }, [enabled, isRealtimeConnected, realtimeDegraded])

  const retryJoinRequest = useCallback(async () => {
    setError(null)
    await connect()
  }, [connect])

  const openWhiteboard = useCallback(() => {
    setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'open', from: userId }))
    sendSignal({ type: 'whiteboard-open', from: userId, name: displayName })
  }, [displayName, sendSignal, userId])

  const closeWhiteboard = useCallback(
    (stopForEveryone = false) => {
      if (!stopForEveryone) return
      setWhiteboard(emptyWhiteboardSession())
      sendSignal({ type: 'whiteboard-close', from: userId })
    },
    [sendSignal, userId],
  )

  const addWhiteboardStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'stroke', stroke }))
      sendSignal({ type: 'whiteboard-stroke', from: userId, stroke })
    },
    [sendSignal, userId],
  )

  const undoWhiteboardStroke = useCallback(
    (strokeId: string) => {
      setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'undo', strokeId, from: userId }))
      sendSignal({ type: 'whiteboard-undo', from: userId, strokeId })
    },
    [sendSignal, userId],
  )

  const clearWhiteboard = useCallback(() => {
    setWhiteboard((current) => applyWhiteboardEvent(current, { type: 'clear' }))
    sendSignal({ type: 'whiteboard-clear', from: userId })
  }, [sendSignal, userId])

  const publishOwnContentShare = useCallback(
    (share: MeetingContentShare) => {
      const next = { share, receivedAt: Date.now() }
      contentStateRef.current = next
      setContentState(next)
      sendSignal({ type: 'content-share', from: userId, share })
    },
    [sendSignal, userId],
  )

  const startContentShare = useCallback(
    (items: MeetingContentItem[]) => {
      const now = Date.now()
      publishOwnContentShare({
        id: createMeetingContentShareId(userId, now),
        from: userId,
        presenterName: displayName,
        items,
        index: 0,
        page: 1,
        playing: false,
        positionSec: 0,
        startedAt: now,
        updatedAt: now,
      })
    },
    [displayName, publishOwnContentShare, userId],
  )

  /** Presenter only: slide, page or playback changes follow on every viewer. */
  const updateContentShare = useCallback(
    (patch: Partial<Pick<MeetingContentShare, 'index' | 'page' | 'playing' | 'positionSec'>>) => {
      const { share } = contentStateRef.current
      if (!share || share.from !== userId) return
      const next: MeetingContentShare = { ...share, ...patch, updatedAt: Date.now() }
      if (patch.index !== undefined && patch.index !== share.index) {
        next.page = patch.page ?? 1
        next.playing = patch.playing ?? false
        next.positionSec = patch.positionSec ?? 0
      }
      publishOwnContentShare(next)
    },
    [publishOwnContentShare, userId],
  )

  const stopContentShare = useCallback(() => {
    const { share } = contentStateRef.current
    if (!share || share.from !== userId) return
    const stop: SignalPayload = { type: 'content-share-stop', from: userId, id: share.id }
    sendSignal(stop)
    // Broadcasts are fire-and-forget; a dropped stop would leave viewers on the share until it goes stale.
    for (const delay of [1_000, 3_000]) setTimeout(() => sendSignal(stop), delay)
    contentStateRef.current = emptyMeetingContentState()
    setContentState(contentStateRef.current)
  }, [sendSignal, userId])

  const contentShare = contentState.share
  const presentingContentId = contentShare?.from === userId ? contentShare.id : null
  useEffect(() => {
    if (!presentingContentId) return
    const timer = setInterval(() => {
      const own = freshOwnContentShare()
      if (own) sendSignal({ type: 'content-share', from: userId, share: own })
    }, MEETING_CONTENT_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [freshOwnContentShare, presentingContentId, sendSignal, userId])

  // Viewers drop a share whose presenter went quiet or left the meeting.
  const viewingContentFrom = contentShare && contentShare.from !== userId ? contentShare.from : null
  useEffect(() => {
    if (!viewingContentFrom) return
    const timer = setInterval(() => {
      const { share, receivedAt } = contentStateRef.current
      if (share && share.from !== userId && meetingContentIsStale(receivedAt)) {
        setContentState(emptyMeetingContentState())
      }
    }, 5_000)
    return () => clearInterval(timer)
  }, [userId, viewingContentFrom])

  const contentPresenterStatus = viewingContentFrom
    ? participants.find((row) => row.user_id === viewingContentFrom)?.status ?? null
    : null
  useEffect(() => {
    if (!viewingContentFrom) return
    if (contentPresenterStatus && contentPresenterStatus !== 'admitted') {
      setContentState((current) =>
        current.share?.from === viewingContentFrom ? emptyMeetingContentState() : current,
      )
    }
  }, [contentPresenterStatus, viewingContentFrom])

  const setSpotlight = useCallback(
    (targetUserId: string | null) => {
      const next = targetUserId ? String(targetUserId) : null
      setSpotlightUserId(next)
      sendSignal({
        type: 'spotlight',
        from: userId,
        targetUserId: next,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const setWebinarModeLive = useCallback(
    (enabled: boolean) => {
      setWebinarMode(enabled)
      sendSignal({
        type: 'webinar-mode',
        from: userId,
        enabled,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const setInterpretationChannelLive = useCallback(
    (channelId: string | null) => {
      const next = channelId ? String(channelId) : 'floor'
      setInterpretationChannelId(next)
      sendSignal({
        type: 'interpretation-channel',
        from: userId,
        channelId: next,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const broadcastToBreakouts = useCallback(
    (message: string) => {
      const text = message.trim()
      if (!text) return
      sendSignal({
        type: 'breakout-broadcast',
        from: userId,
        message: text,
        timestamp: Date.now(),
      })
      setBreakoutBroadcast({ id: `bo-bcast-local-${Date.now()}`, message: text })
    },
    [sendSignal, userId],
  )

  const setBreakoutTimer = useCallback(
    (endsAt: number | null) => {
      setBreakoutEndsAt(endsAt)
      sendSignal({
        type: 'breakout-timer',
        from: userId,
        endsAt,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const requestRemoteControl = useCallback(
    (toUserId: string) => {
      sendSignal({
        type: 'remote-control-request',
        from: userId,
        to: toUserId,
        name: displayName,
        timestamp: Date.now(),
      })
    },
    [displayName, sendSignal, userId],
  )

  const respondRemoteControl = useCallback(
    (toUserId: string, accepted: boolean) => {
      sendSignal({
        type: 'remote-control-response',
        from: userId,
        to: toUserId,
        accepted,
        timestamp: Date.now(),
      })
      setRemoteControlRequest(null)
    },
    [sendSignal, userId],
  )

  const clearRemoteControlRequest = useCallback(() => {
    setRemoteControlRequest(null)
  }, [])

  const requestRecording = useCallback(() => {
    sendSignal({ type: 'recording-request', from: userId, name: displayName, timestamp: Date.now() })
  }, [displayName, sendSignal, userId])

  const respondRecording = useCallback(
    (toUserId: string, accepted: boolean) => {
      sendSignal({
        type: 'recording-response',
        from: userId,
        to: toUserId,
        accepted,
        timestamp: Date.now(),
      })
      setRecordingRequest(null)
    },
    [sendSignal, userId],
  )

  const publishAnnotationStroke = useCallback(
    (stroke: {
      id: string
      color: string
      width: number
      points: Array<{ x: number; y: number }>
      from: string
      createdAt: number
    }) => {
      setAnnotationOpen(true)
      setAnnotationStrokes((current) => [...current, stroke].slice(-200))
      sendSignal({
        type: 'annotation-stroke',
        from: userId,
        stroke,
        timestamp: Date.now(),
      })
    },
    [sendSignal, userId],
  )

  const clearAnnotations = useCallback(() => {
    setAnnotationStrokes([])
    sendSignal({ type: 'annotation-clear', from: userId, timestamp: Date.now() })
  }, [sendSignal, userId])

  const setAnnotationSessionOpen = useCallback(
    (open: boolean) => {
      setAnnotationOpen(open)
      sendSignal({
        type: open ? 'annotation-open' : 'annotation-close',
        from: userId,
        timestamp: Date.now(),
      })
      if (!open) setAnnotationStrokes([])
    },
    [sendSignal, userId],
  )

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
    roomWantsCaptions,
    setCaptionWanted,
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
    nonverbalByUserId,
    localNonverbal,
    setNonverbalFeedback,
    lowerAllHands,
    lowerHandFor,
    clearAllFeedback,
    liveTopic,
    setMeetingTopicLive,
    setPanel: setPanelSafe,
    togglePanel,
    sendChat,
    sendChatAttachment,
    deleteChat,
    admit,
    reject,
    admitAllWaiting,
    remove,
    putInWaitingRoom,
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
    whiteboard,
    openWhiteboard,
    closeWhiteboard,
    addWhiteboardStroke,
    undoWhiteboardStroke,
    clearWhiteboard,
    contentShare,
    contentShareReceivedAt: contentState.receivedAt,
    startContentShare,
    updateContentShare,
    stopContentShare,
    spotlightUserId,
    setSpotlight,
    webinarMode,
    setWebinarModeLive,
    interpretationChannelId,
    setInterpretationChannelLive,
    breakoutBroadcast,
    breakoutEndsAt,
    broadcastToBreakouts,
    setBreakoutTimer,
    requestRemoteControl,
    respondRemoteControl,
    clearRemoteControlRequest,
    remoteControlRequest,
    requestRecording,
    respondRecording,
    recordingRequest,
    annotationOpen,
    annotationStrokes,
    publishAnnotationStroke,
    clearAnnotations,
    setAnnotationSessionOpen,
    liveRecordingSignal,
    broadcastRecordingStatus,
  }
}
