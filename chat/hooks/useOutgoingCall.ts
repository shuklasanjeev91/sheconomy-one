import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'one'

import {
  CALL_RING_TIMEOUT_MS,
  type CallType,
  type ChatCall,
  fetchCallById,
  logCall,
  mapCall,
  startCall,
  startMultiPartyCall,
  updateCallStatus,
} from '~/chat/lib/calls'
import { fetchConversationParticipants } from '~/chat/lib/chats'
import type { ChatSummary } from '~/chat/lib/types'
import { useAppToast } from '~/components/ui'
import { chatRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type OutgoingCallState = {
  call: ChatCall
  peerName: string
  peerAvatar: string | null
}

const STATUS_POLL_MS = 1_200

/** Places an outbound 1:1 or group call and tracks its ringing lifecycle for the caller. */
export function useOutgoingCall(currentUserId: string) {
  const router = useRouter()
  const toast = useAppToast()
  const [outgoing, setOutgoing] = useState<OutgoingCallState | null>(null)
  const outgoingRef = useRef<ChatCall | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const joiningRef = useRef(false)

  const teardown = useCallback(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    joiningRef.current = false
    outgoingRef.current = null
    setOutgoing(null)
  }, [])

  useEffect(() => teardown, [teardown])

  const joinCallRoom = useCallback(
    (code: string, callType: CallType, callId: string) => {
      router.push(chatRoutes.call(code, { type: callType, callId }))
    },
    [router],
  )

  const start = useCallback(
    async (chat: ChatSummary, callType: CallType) => {
      if (outgoingRef.current) return

      // —— Group / multi-party: ring everyone, host joins immediately (WhatsApp-style).
      if (chat.type === 'group') {
        const participants = await fetchConversationParticipants(chat.id)
        const receivers = Object.values(participants)
          .filter((p) => p.userId !== currentUserId)
          .map((p) => ({ id: p.userId, name: p.name, avatar: p.avatarUrl }))

        const { call, error } = await startMultiPartyCall({
          conversationId: chat.id,
          callerId: currentUserId,
          receivers,
          callType,
          title: chat.name ? `${chat.name} call` : undefined,
        })

        if (error || !call) {
          toast.show('Could not start the call', { message: error ?? undefined, tone: 'danger' })
          return
        }

        void logCall({
          conversationId: chat.id,
          callerId: currentUserId,
          callType,
          outcome: 'answered',
        })

        if (call.meetingCode) {
          joinCallRoom(call.meetingCode, callType, call.id)
        }
        return
      }

      // —— 1:1: wait for accept before joining.
      if (!chat.otherUserId) return

      const { call, error } = await startCall({
        conversationId: chat.id,
        callerId: currentUserId,
        receiverId: chat.otherUserId,
        callType,
        receiverName: chat.name,
        receiverAvatar: chat.avatarUrl,
      })

      if (error || !call) {
        toast.show('Could not start the call', { message: error ?? undefined, tone: 'danger' })
        return
      }

      outgoingRef.current = call
      joiningRef.current = false
      setOutgoing({ call, peerName: chat.name, peerAvatar: chat.avatarUrl })

      const joinWhenAnswered = (updated: ChatCall) => {
        if (joiningRef.current) return
        if (updated.id !== call.id) return

        if (updated.status === 'active') {
          joiningRef.current = true
          const code = updated.meetingCode ?? call.meetingCode
          void logCall({
            conversationId: chat.id,
            callerId: currentUserId,
            callType,
            outcome: 'answered',
          })
          teardown()
          if (code) joinCallRoom(code, callType, call.id)
          return
        }

        if (updated.status === 'declined') {
          joiningRef.current = true
          void logCall({
            conversationId: chat.id,
            callerId: currentUserId,
            callType,
            outcome: 'declined',
          })
          toast.show(`${chat.name} declined the call`, { tone: 'default' })
          teardown()
        }
      }

      channelRef.current = supabase
        .channel(`outgoing-call:${call.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${call.id}` },
          (payload) => {
            joinWhenAnswered(mapCall(payload.new as never))
          },
        )
        .subscribe()

      // Poll as a WhatsApp-style fallback if the realtime UPDATE is missed.
      pollRef.current = setInterval(() => {
        if (!outgoingRef.current || joiningRef.current) return
        void fetchCallById(call.id).then((latest) => {
          if (latest) joinWhenAnswered(latest)
        })
      }, STATUS_POLL_MS)

      timeoutRef.current = setTimeout(() => {
        if (outgoingRef.current?.id === call.id && !joiningRef.current) {
          void updateCallStatus(call.id, 'missed').catch(() => {})
          void logCall({
            conversationId: chat.id,
            callerId: currentUserId,
            callType,
            outcome: 'missed',
          })
          toast.show('No answer', { tone: 'default' })
          teardown()
        }
      }, CALL_RING_TIMEOUT_MS)
    },
    [currentUserId, joinCallRoom, teardown, toast],
  )

  const cancel = useCallback(() => {
    const call = outgoingRef.current
    if (call) {
      void updateCallStatus(call.id, 'missed').catch(() => {})
      void logCall({
        conversationId: call.conversationId ?? '',
        callerId: currentUserId,
        callType: call.callType,
        outcome: 'missed',
      })
    }
    teardown()
  }, [currentUserId, teardown])

  return { outgoing, start, cancel }
}
