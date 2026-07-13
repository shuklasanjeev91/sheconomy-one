import { sendMessage } from '~/chat/lib/chats'
import { createMeeting } from '~/co-work/lib/meetings'
import { supabase } from '~/lib/supabase/client'
import type { Database } from '~/lib/supabase/database.types'

type CallUpdate = Database['public']['Tables']['calls']['Update']

export type CallType = 'audio' | 'video'
export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'missed'
  | 'ended'
  | 'canceled'

export type ChatCall = {
  id: string
  conversationId: string | null
  callerId: string
  receiverId: string
  callType: CallType
  status: CallStatus
  meetingCode: string | null
  createdAt: string
}

/** How long an unanswered call keeps ringing before it is marked missed. */
export const CALL_RING_TIMEOUT_MS = 45_000

type CallRow = {
  id: string
  conversation_id: string | null
  caller_id: string
  receiver_id: string
  call_type: string | null
  status: string | null
  meeting_code: string | null
  created_at: string | null
}

export function mapCall(row: CallRow): ChatCall {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    callerId: row.caller_id,
    receiverId: row.receiver_id,
    callType: row.call_type === 'video' ? 'video' : 'audio',
    status: (row.status as CallStatus) ?? 'ringing',
    meetingCode: row.meeting_code,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

const CALL_SELECT =
  'id, conversation_id, caller_id, receiver_id, call_type, status, meeting_code, created_at'

/**
 * Start a 1:1 call: spin up an instant LiveKit room and create a ringing
 * call row the receiver picks up via realtime.
 */
export async function startCall(input: {
  conversationId: string
  callerId: string
  receiverId: string
  callType: CallType
}): Promise<{ call: ChatCall | null; error: string | null }> {
  try {
    const meeting = await createMeeting(input.callerId, {
      title: input.callType === 'video' ? 'Video call' : 'Voice call',
      startNow: true,
      maxParticipants: 2,
      securitySettings: {
        waitingRoom: false,
        allowChat: false,
        allowRecording: false,
        allowScreenShare: input.callType === 'video',
      },
      meetingOptions: {
        defaultVideo: input.callType === 'video',
        defaultAudio: true,
        layout: 'speaker',
        enableMeetingChat: false,
      },
    })

    const { data, error } = await supabase
      .from('calls')
      .insert({
        conversation_id: input.conversationId,
        caller_id: input.callerId,
        receiver_id: input.receiverId,
        call_type: input.callType,
        status: 'ringing',
        meeting_code: meeting.meeting_code,
      })
      .select(CALL_SELECT)
      .single()

    if (error) return { call: null, error: error.message }
    return { call: mapCall(data as CallRow), error: null }
  } catch (error) {
    return {
      call: null,
      error: error instanceof Error ? error.message : 'Could not start the call.',
    }
  }
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<void> {
  const patch: CallUpdate = { status, updated_at: new Date().toISOString() }
  if (status === 'accepted') patch.started_at = new Date().toISOString()
  if (status === 'declined' || status === 'missed' || status === 'ended' || status === 'canceled') {
    patch.ended_at = new Date().toISOString()
  }
  await supabase.from('calls').update(patch).eq('id', callId)
}

export type CallOutcome = 'answered' | 'missed' | 'declined'

/**
 * Record a call in the conversation thread as a `call` message.
 * The sender is always the caller, so viewers derive incoming/outgoing
 * direction from `senderId`. Content is encoded as `"<type>|<outcome>"`.
 */
export async function logCall(input: {
  conversationId: string
  callerId: string
  callType: CallType
  outcome: CallOutcome
}): Promise<void> {
  await sendMessage({
    conversationId: input.conversationId,
    senderId: input.callerId,
    content: `${input.callType}|${input.outcome}`,
    type: 'call',
  })
}

export type CallerProfile = {
  id: string
  name: string
  avatarUrl: string | null
}

export async function fetchCallerProfile(userId: string): Promise<CallerProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  return {
    id: userId,
    name: data?.full_name ?? data?.username ?? 'Caller',
    avatarUrl: data?.avatar_url ?? null,
  }
}
