import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'one'

import {
  CALL_RING_TIMEOUT_MS,
  type CallType,
  type ChatCall,
  logCall,
  mapCall,
  startCall,
  updateCallStatus,
} from '~/chat/lib/calls'
import type { ChatSummary } from '~/chat/lib/types'
import { useAppToast } from '~/components/ui'
import { chatRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type OutgoingCallState = {
  call: ChatCall
  peerName: string
  peerAvatar: string | null
}

/** Places an outbound call and tracks its ringing lifecycle for the caller. */
export function useOutgoingCall(currentUserId: string) {
  const router = useRouter()
  const toast = useAppToast()
  const [outgoing, setOutgoing] = useState<OutgoingCallState | null>(null)
  const outgoingRef = useRef<ChatCall | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const teardown = useCallback(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    outgoingRef.current = null
    setOutgoing(null)
  }, [])

  useEffect(() => teardown, [teardown])

  const start = useCallback(
    async (chat: ChatSummary, callType: CallType) => {
      if (outgoingRef.current || !chat.otherUserId) return

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
      setOutgoing({ call, peerName: chat.name, peerAvatar: chat.avatarUrl })

      channelRef.current = supabase
        .channel(`outgoing-call:${call.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${call.id}` },
          (payload) => {
            const updated = mapCall(payload.new as never)
            if (updated.status === 'accepted') {
              const code = updated.meetingCode ?? call.meetingCode
              void logCall({ conversationId: chat.id, callerId: currentUserId, callType, outcome: 'answered' })
              teardown()
              if (code) {
                router.push(chatRoutes.call(code, { type: callType, callId: call.id }))
              }
            } else if (updated.status === 'declined') {
              void logCall({ conversationId: chat.id, callerId: currentUserId, callType, outcome: 'declined' })
              toast.show(`${chat.name} declined the call`, { tone: 'default' })
              teardown()
            }
          },
        )
        .subscribe()

      timeoutRef.current = setTimeout(() => {
        if (outgoingRef.current?.id === call.id) {
          void updateCallStatus(call.id, 'missed')
          void logCall({ conversationId: chat.id, callerId: currentUserId, callType, outcome: 'missed' })
          toast.show('No answer', { tone: 'default' })
          teardown()
        }
      }, CALL_RING_TIMEOUT_MS)
    },
    [currentUserId, router, teardown, toast],
  )

  const cancel = useCallback(() => {
    const call = outgoingRef.current
    if (call) {
      void updateCallStatus(call.id, 'canceled')
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
