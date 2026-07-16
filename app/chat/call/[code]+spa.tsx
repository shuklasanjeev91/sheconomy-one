import { useLocalSearchParams } from 'one'

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
  const callType: CallType = typeRaw === 'audio' ? 'audio' : 'video'
  const callId = readRouteParam(params.callId) || undefined

  return <ChatCallScreen code={code} callType={callType} callId={callId} />
}
