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
  receiverName?: string
  receiverAvatar?: string | null
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
        allowScreenShare: false,
        allowHandRaise: false,
      },
      meetingOptions: {
        defaultVideo: input.callType === 'video',
        defaultAudio: true,
        layout: 'speaker',
        enableMeetingChat: false,
        allowJoinBeforeHost: true,
      },
      invitees: [
        {
          id: input.receiverId,
          type: 'user',
          name: input.receiverName?.trim() || 'Contact',
          avatar: input.receiverAvatar ?? null,
          status: 'pending',
        },
      ],
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

export type CallDirection = 'incoming' | 'outgoing'

export type CallHistoryEntry = {
  id: string
  conversationId: string | null
  peerId: string
  peerName: string
  peerAvatar: string | null
  callType: CallType
  status: CallStatus
  direction: CallDirection
  createdAt: string
}

/**
 * Recent 1:1 calls involving the user (as caller or receiver), newest first,
 * hydrated with the other participant's profile. Powers the Calls tab.
 */
export async function fetchCallHistory(
  userId: string,
  limit = 100,
): Promise<CallHistoryEntry[]> {
  const { data, error } = await supabase
    .from('calls')
    .select(CALL_SELECT)
    .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const rows = data as CallRow[]
  const peerIds = Array.from(
    new Set(rows.map((r) => (r.caller_id === userId ? r.receiver_id : r.caller_id))),
  )

  const profiles = new Map<string, { name: string; avatar: string | null }>()
  if (peerIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', peerIds)
    for (const p of profs ?? []) {
      profiles.set(p.id, {
        name: p.full_name ?? p.username ?? 'Unknown',
        avatar: p.avatar_url ?? null,
      })
    }
  }

  return rows.map((row) => {
    const call = mapCall(row)
    const direction: CallDirection = row.caller_id === userId ? 'outgoing' : 'incoming'
    const peerId = direction === 'outgoing' ? row.receiver_id : row.caller_id
    const prof = profiles.get(peerId)
    return {
      id: call.id,
      conversationId: call.conversationId,
      peerId,
      peerName: prof?.name ?? 'Unknown',
      peerAvatar: prof?.avatar ?? null,
      callType: call.callType,
      status: call.status,
      direction,
      createdAt: call.createdAt,
    }
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
