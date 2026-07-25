import type { PushClickPayload } from '~/lib/notifications/push-client.types'

export type IncomingCallPushData = {
  callId: string
  meetingCode: string | null
  callType: 'audio' | 'video'
  callerName: string
  actionUrl: string | null
}

export function isIncomingCallPush(payload: {
  url?: string | null
  data?: Record<string, unknown> | null
}): boolean {
  const kind = payload.data?.notification_kind
  if (kind === 'incoming_call') return true
  const url = payload.url ?? ''
  return typeof url === 'string' && (url.includes('ring=1') || /\/chat\/call\//.test(url))
}

export function parseIncomingCallPush(
  payload: PushClickPayload,
): IncomingCallPushData | null {
  if (!isIncomingCallPush(payload)) return null
  const data = payload.data ?? {}
  const callId =
    (typeof data.call_id === 'string' && data.call_id) ||
    (typeof data.callId === 'string' && data.callId) ||
    ''
  if (!callId) return null

  const meetingCode =
    (typeof data.meeting_code === 'string' && data.meeting_code) ||
    (typeof data.meetingCode === 'string' && data.meetingCode) ||
    null
  const callTypeRaw =
    (typeof data.call_type === 'string' && data.call_type) ||
    (typeof data.callType === 'string' && data.callType) ||
    'audio'
  const callerName =
    (typeof data.caller_name === 'string' && data.caller_name) ||
    payload.title?.replace(/\s+is calling…?$/i, '').trim() ||
    'Incoming call'
  const actionUrl =
    payload.url ||
    (typeof data.action_url === 'string' ? data.action_url : null) ||
    (typeof data.url === 'string' ? data.url : null)

  return {
    callId,
    meetingCode,
    callType: callTypeRaw.toLowerCase() === 'video' ? 'video' : 'audio',
    callerName,
    actionUrl,
  }
}
