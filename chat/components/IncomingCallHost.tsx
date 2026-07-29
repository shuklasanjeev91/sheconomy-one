import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { useIncomingCalls } from '~/chat/hooks/useIncomingCalls'
import { parseIncomingCallPush } from '~/chat/lib/incoming-call-push'
import {
  fetchCallById,
  updateCallStatus,
} from '~/chat/lib/calls'
import {
  displayNativeIncomingCall,
  endNativeIncomingCall,
  markNativeIncomingCallActive,
  setupNativeIncomingCalls,
} from '~/chat/lib/native-incoming-call'
import { CallOverlay } from '~/chat/components/CallOverlay'
import { useAppToast } from '~/components/ui'
import pushClient from '~/lib/notifications/push-client'
import { resolveOneSignalAppId } from '~/lib/notifications/push-config'
import { chatRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * App-wide listener that rings for inbound 1:1 calls anywhere in the app.
 * On native, also drives CallKit / ConnectionService (system in-call UI) so
 * closed or backgrounded devices can answer like a phone call.
 * Mounted once near the shell root.
 */
export function IncomingCallHost() {
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { incoming, caller, accept, decline } = useIncomingCalls(user?.id)
  const incomingRef = useRef(incoming)
  const lastRingingIdRef = useRef<string | null>(null)
  const answeredRef = useRef(false)
  const acceptRef = useRef(accept)
  const declineRef = useRef(decline)
  incomingRef.current = incoming
  acceptRef.current = accept
  declineRef.current = decline

  useEffect(() => {
    if (Platform.OS === 'web') return

    let unsubscribe = () => {}
    void setupNativeIncomingCalls({
      onAnswer: (callId) => {
        const current = incomingRef.current
        if (current && current.id.toLowerCase() !== callId.toLowerCase()) return
        answeredRef.current = true

        const join = async () => {
          if (current) {
            const code = await acceptRef.current()
            if (!code) throw new Error('Call is no longer available')
            return { code, callType: current.callType }
          }

          const row = await fetchCallById(callId)
          if (!row?.meetingCode || row.status !== 'ringing') {
            throw new Error('Call is no longer available')
          }
          await updateCallStatus(callId, 'active')
          return { code: row.meetingCode, callType: row.callType }
        }

        void join()
          .then(({ code, callType }) => {
            markNativeIncomingCallActive(callId)
            router.push(
              chatRoutes.call(code, {
                type: callType,
                callId,
              }),
            )
          })
          .catch((error: unknown) => {
            answeredRef.current = false
            endNativeIncomingCall(callId)
            toast.show('Could not answer the call', {
              message: error instanceof Error ? error.message : undefined,
              tone: 'danger',
            })
          })
      },
      onDecline: (callId) => {
        const current = incomingRef.current
        if (current && current.id.toLowerCase() !== callId.toLowerCase()) return
        answeredRef.current = false
        if (current) {
          void declineRef.current().catch(() => {})
        } else {
          void updateCallStatus(callId, 'declined').catch(() => {})
        }
        endNativeIncomingCall(callId)
      },
    }).then((unsub) => {
      unsubscribe = unsub
    })

    return () => unsubscribe()
  }, [router, toast])

  useEffect(() => {
    if (Platform.OS === 'web') return

    if (!incoming) {
      const previousId = lastRingingIdRef.current
      if (previousId && !answeredRef.current) {
        endNativeIncomingCall(previousId)
      }
      lastRingingIdRef.current = null
      answeredRef.current = false
      return
    }

    lastRingingIdRef.current = incoming.id
    answeredRef.current = false
    displayNativeIncomingCall({
      callId: incoming.id,
      callerName: caller?.name ?? 'Incoming call',
      hasVideo: incoming.callType === 'video',
      handle: caller?.name ?? 'SHEconomy',
    })
  }, [incoming, caller?.name])

  // When a high-priority call push wakes the process before realtime reconnects,
  // show the system in-call UI immediately from the push payload.
  useEffect(() => {
    if (Platform.OS === 'web') return
    let unsubFg = () => {}
    let unsubClick = () => {}
    let cancelled = false

    void (async () => {
      const appId = await resolveOneSignalAppId()
      if (cancelled || !appId) return

      const presentFromPush = (payload: Parameters<typeof parseIncomingCallPush>[0]) => {
        const parsed = parseIncomingCallPush(payload)
        if (!parsed) return
        displayNativeIncomingCall({
          callId: parsed.callId,
          callerName: parsed.callerName,
          hasVideo: parsed.callType === 'video',
          handle: parsed.callerName,
        })
      }

      unsubFg = pushClient.onForegroundNotification(presentFromPush)
      unsubClick = pushClient.onNotificationClick(presentFromPush)
    })()

    return () => {
      cancelled = true
      unsubFg()
      unsubClick()
    }
  }, [])

  if (!incoming) return null

  return (
    <CallOverlay
      name={caller?.name ?? 'Incoming call'}
      avatarUrl={caller?.avatarUrl ?? null}
      callType={incoming.callType}
      variant="incoming"
      statusText={incoming.callType === 'video' ? 'Incoming video call…' : 'Incoming voice call…'}
      onAccept={() => {
        const callType = incoming.callType
        const callId = incoming.id
        answeredRef.current = true
        void accept()
          .then((code) => {
            if (code) {
              markNativeIncomingCallActive(callId)
              router.push(
                chatRoutes.call(code, {
                  type: callType,
                  callId,
                }),
              )
            } else {
              answeredRef.current = false
              endNativeIncomingCall(callId)
            }
          })
          .catch((error: unknown) => {
            answeredRef.current = false
            endNativeIncomingCall(callId)
            toast.show('Could not answer the call', {
              message: error instanceof Error ? error.message : undefined,
              tone: 'danger',
            })
          })
      }}
      onDecline={() => {
        const callId = incoming.id
        answeredRef.current = false
        void decline()
          .then(() => endNativeIncomingCall(callId))
          .catch(() => endNativeIncomingCall(callId))
      }}
    />
  )
}
