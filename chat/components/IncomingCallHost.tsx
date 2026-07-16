import { useRouter } from 'one'

import { useIncomingCalls } from '~/chat/hooks/useIncomingCalls'
import { useAppToast } from '~/components/ui'
import { chatRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

import { CallOverlay } from './CallOverlay'

/**
 * App-wide listener that rings for inbound 1:1 calls anywhere in the app.
 * Mounted once near the shell root.
 */
export function IncomingCallHost() {
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { incoming, caller, accept, decline } = useIncomingCalls(user?.id)

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
        void accept()
          .then((code) => {
            if (code) {
              router.push(
                chatRoutes.call(code, {
                  type: callType,
                  callId,
                }),
              )
            }
          })
          .catch((error: unknown) => {
            toast.show('Could not answer the call', {
              message: error instanceof Error ? error.message : undefined,
              tone: 'danger',
            })
          })
      }}
      onDecline={() => void decline().catch(() => {})}
    />
  )
}
