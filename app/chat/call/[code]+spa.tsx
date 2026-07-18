import { useLocalSearchParams } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ChatCallScreen } from '~/chat/screens/ChatCallScreen'
import type { CallType } from '~/chat/lib/calls'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function ChatCallRoute() {
  const params = useLocalSearchParams<{
    code: string | string[]
    type?: string | string[]
    callId?: string | string[]
  }>()
  const code = readRouteParam(params.code)
  const typeRaw = readRouteParam(params.type).toLowerCase()
  // Default to audio. Only treat as video when explicitly requested — missing
  // query params previously turned voice calls into video on some platforms.
  const callType: CallType = typeRaw === 'video' ? 'video' : 'audio'
  const callId = readRouteParam(params.callId) || undefined

  return (
    <AppErrorBoundary scope="ChatCall">
      <ChatCallScreen code={code} callType={callType} callId={callId} />
    </AppErrorBoundary>
  )
}
