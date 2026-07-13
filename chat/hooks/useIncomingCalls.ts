import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CALL_RING_TIMEOUT_MS,
  type CallerProfile,
  type ChatCall,
  fetchCallerProfile,
  mapCall,
  updateCallStatus,
} from '~/chat/lib/calls'
import { supabase } from '~/lib/supabase/client'

/**
 * Global listener for inbound 1:1 calls. Surfaces the current ringing call and
 * the caller's profile, and exposes accept/decline actions.
 */
export function useIncomingCalls(userId: string | null | undefined) {
  const [incoming, setIncoming] = useState<ChatCall | null>(null)
  const [caller, setCaller] = useState<CallerProfile | null>(null)
  const incomingRef = useRef<ChatCall | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    incomingRef.current = null
    setIncoming(null)
    setCaller(null)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const call = mapCall(payload.new as never)
          if (call.status !== 'ringing' || !call.meetingCode) return
          // Ignore stale rows (e.g. replayed history).
          if (Date.now() - new Date(call.createdAt).getTime() > CALL_RING_TIMEOUT_MS) return
          if (incomingRef.current) return // already handling a call

          incomingRef.current = call
          setIncoming(call)
          void fetchCallerProfile(call.callerId).then(setCaller)

          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => {
            if (incomingRef.current?.id === call.id) clear()
          }, CALL_RING_TIMEOUT_MS)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const call = mapCall(payload.new as never)
          // Caller hung up / canceled before we answered.
          if (incomingRef.current?.id === call.id && call.status !== 'ringing') {
            clear()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [userId, clear])

  const accept = useCallback(async (): Promise<string | null> => {
    const call = incomingRef.current
    if (!call) return null
    await updateCallStatus(call.id, 'accepted')
    clear()
    return call.meetingCode
  }, [clear])

  const decline = useCallback(async () => {
    const call = incomingRef.current
    if (!call) return
    await updateCallStatus(call.id, 'declined')
    clear()
  }, [clear])

  return { incoming, caller, accept, decline }
}
