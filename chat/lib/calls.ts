import { sendMessage } from '~/chat/lib/chats'
import { createMeeting } from '~/co-work/lib/meetings'
import { supabase } from '~/lib/supabase/client'
import type { Database } from '~/lib/supabase/database.types'

type CallUpdate = Database['public']['Tables']['calls']['Update']

export type CallType = 'audio' | 'video'
/** Must match `calls_status_check` in Postgres. */
export type CallStatus =
  | 'ringing'
  | 'active'
  | 'declined'
  | 'missed'
  | 'ended'

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
  return startMultiPartyCall({
    conversationId: input.conversationId,
    callerId: input.callerId,
    receivers: [
      {
        id: input.receiverId,
        name: input.receiverName,
        avatar: input.receiverAvatar,
      },
    ],
    callType: input.callType,
    title: input.callType === 'video' ? 'Video call' : 'Voice call',
    maxParticipants: 2,
  })
}

/**
 * WhatsApp-style group / multi-party call: one LiveKit room, one ringing row
 * per callee so each device can accept independently (1:many / many:many).
 */
export async function startMultiPartyCall(input: {
  conversationId: string
  callerId: string
  receivers: { id: string; name?: string; avatar?: string | null }[]
  callType: CallType
  title?: string
  maxParticipants?: number
}): Promise<{ call: ChatCall | null; error: string | null }> {
  const receivers = input.receivers.filter((r) => r.id && r.id !== input.callerId)
  if (!receivers.length) {
    return { call: null, error: 'No one to call.' }
  }

  try {
    const meeting = await createMeeting(input.callerId, {
      title:
        input.title ??
        (input.callType === 'video'
          ? receivers.length > 1
            ? 'Group video call'
            : 'Video call'
          : receivers.length > 1
            ? 'Group voice call'
            : 'Voice call'),
      startNow: true,
      maxParticipants: input.maxParticipants ?? Math.max(receivers.length + 1, 8),
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
      invitees: receivers.map((receiver) => ({
        id: receiver.id,
        type: 'user' as const,
        name: receiver.name?.trim() || 'Contact',
        avatar: receiver.avatar ?? null,
        status: 'pending' as const,
      })),
    })

    const rows = receivers.map((receiver) => ({
      conversation_id: input.conversationId,
      caller_id: input.callerId,
      receiver_id: receiver.id,
      call_type: input.callType,
      status: 'ringing' as const,
      meeting_code: meeting.meeting_code,
    }))

    const { data, error } = await supabase.from('calls').insert(rows).select(CALL_SELECT)

    if (error) return { call: null, error: error.message }
    const first = (data as CallRow[] | null)?.[0]
    if (!first) return { call: null, error: 'Could not create the call.' }
    return { call: mapCall(first), error: null }
  } catch (error) {
    return {
      call: null,
      error: error instanceof Error ? error.message : 'Could not start the call.',
    }
  }
}

/** End every ringing/active call that shares this meeting room (group hangup). */
export async function endCallsForMeetingCode(meetingCode: string): Promise<void> {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'ended', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('meeting_code', meetingCode)
    .in('status', ['ringing', 'active'])
  if (error) throw new Error(error.message)
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<void> {
  const patch: CallUpdate = { status, updated_at: new Date().toISOString() }
  if (status === 'active') patch.started_at = new Date().toISOString()
  if (status === 'declined' || status === 'missed' || status === 'ended') {
    patch.ended_at = new Date().toISOString()
  }
  const { error } = await supabase.from('calls').update(patch).eq('id', callId)
  if (error) {
    throw new Error(error.message)
  }
}

/** Fetch a single call row — used as a realtime fallback while the caller is ringing. */
export async function fetchCallById(callId: string): Promise<ChatCall | null> {
  const { data, error } = await supabase
    .from('calls')
    .select(CALL_SELECT)
    .eq('id', callId)
    .maybeSingle()
  if (error || !data) return null
  return mapCall(data as CallRow)
}

/**
 * Latest unanswered inbound call still within the ring window.
 * Used when the app wakes from a push (realtime INSERT was missed while killed).
 */
export async function fetchPendingIncomingCall(userId: string): Promise<ChatCall | null> {
  const since = new Date(Date.now() - CALL_RING_TIMEOUT_MS).toISOString()
  const { data, error } = await supabase
    .from('calls')
    .select(CALL_SELECT)
    .eq('receiver_id', userId)
    .eq('status', 'ringing')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const call = mapCall(data as CallRow)
  if (!call.meetingCode) return null
  return call
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
