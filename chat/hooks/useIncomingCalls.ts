import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import {
  CALL_RING_TIMEOUT_MS,
  type CallerProfile,
  type ChatCall,
  fetchCallerProfile,
  fetchPendingIncomingCall,
  mapCall,
  updateCallStatus,
} from '~/chat/lib/calls'
import { supabase } from '~/lib/supabase/client'

/**
 * Global listener for inbound 1:1 calls. Surfaces the current ringing call and
 * the caller's profile, and exposes accept/decline actions.
 *
 * Also re-checks on AppState `active` so a push can wake a backgrounded /
 * killed app and still show the accept UI (realtime INSERT is missed offline).
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

  const presentIncoming = useCallback(
    (call: ChatCall) => {
      if (call.status !== 'ringing' || !call.meetingCode) return
      if (Date.now() - new Date(call.createdAt).getTime() > CALL_RING_TIMEOUT_MS) return
      if (incomingRef.current) return

      incomingRef.current = call
      setIncoming(call)
      void fetchCallerProfile(call.callerId).then(setCaller)

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const remaining = Math.max(
        1_000,
        CALL_RING_TIMEOUT_MS - (Date.now() - new Date(call.createdAt).getTime()),
      )
      timeoutRef.current = setTimeout(() => {
        if (incomingRef.current?.id === call.id) clear()
      }, remaining)
    },
    [clear],
  )

  const refreshPending = useCallback(async () => {
    if (!userId || incomingRef.current) return
    const pending = await fetchPendingIncomingCall(userId)
    if (pending) presentIncoming(pending)
  }, [presentIncoming, userId])

  useEffect(() => {
    if (!userId) return

    void refreshPending()

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
          presentIncoming(mapCall(payload.new as never))
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

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void refreshPending()
    }
    const appSub = AppState.addEventListener('change', onAppState)

    return () => {
      void supabase.removeChannel(channel)
      appSub.remove()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [userId, clear, presentIncoming, refreshPending])

  const accept = useCallback(async (): Promise<string | null> => {
    const call = incomingRef.current
    if (!call) return null
    // DB check constraint uses `active` (not `accepted`) — this is what the
    // caller watches for before leaving the ringing overlay.
    await updateCallStatus(call.id, 'active')
    const code = call.meetingCode
    clear()
    return code
  }, [clear])

  const decline = useCallback(async () => {
    const call = incomingRef.current
    if (!call) return
    await updateCallStatus(call.id, 'declined')
    clear()
  }, [clear])

  return { incoming, caller, accept, decline }
}
