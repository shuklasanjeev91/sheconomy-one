import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase/client'

import type { SignalPayload } from './types'

export type SignalingHandlers = {
  onSignal: (payload: SignalPayload) => void
  onParticipantChange?: () => void
  onChatMessage?: () => void
}

/** Channel name passed to supabase.channel() */
export function meetingChannelName(meetingId: string) {
  return `meeting:${meetingId}`
}

/** Full realtime topic (supabase prefixes with realtime:) */
export function meetingChannelTopic(meetingId: string) {
  return `realtime:${meetingChannelName(meetingId)}`
}

function findMeetingChannels(meetingId: string): RealtimeChannel[] {
  const topic = meetingChannelTopic(meetingId)
  const shortName = meetingChannelName(meetingId)
  return supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === shortName)
}

const joinLocks = new Map<string, Promise<RealtimeChannel>>()

/** Fully tear down any existing meeting channel before rejoining. */
export async function removeMeetingChannel(meetingId: string): Promise<void> {
  const channels = findMeetingChannels(meetingId)
  for (const channel of channels) {
    try {
      await channel.untrack()
    } catch {
      // ignore
    }
    try {
      await channel.unsubscribe()
    } catch {
      // ignore
    }
    await supabase.removeChannel(channel)
  }
}

function attachMeetingChannelListeners(
  channel: RealtimeChannel,
  meetingId: string,
  handlers: SignalingHandlers,
): RealtimeChannel {
  return channel
    .on('broadcast', { event: 'signal' }, ({ payload }) => {
      handlers.onSignal(payload as SignalPayload)
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meeting_participants', filter: `meeting_id=eq.${meetingId}` },
      () => handlers.onParticipantChange?.(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meeting_chat_messages', filter: `meeting_id=eq.${meetingId}` },
      () => handlers.onChatMessage?.(),
    )
}

async function subscribeMeetingChannel(channel: RealtimeChannel, userId: string): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, online_at: new Date().toISOString() })
        resolve(channel)
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error(err?.message ?? 'Failed to join meeting channel'))
      }
    })
  })
}

async function joinMeetingChannelOnce(
  meetingId: string,
  userId: string,
  handlers: SignalingHandlers,
): Promise<RealtimeChannel> {
  await removeMeetingChannel(meetingId)

  const channel = supabase.channel(meetingChannelName(meetingId), {
    config: { broadcast: { self: false }, presence: { key: userId } },
  })

  attachMeetingChannelListeners(channel, meetingId, handlers)
  return subscribeMeetingChannel(channel, userId)
}

/**
 * Create, attach listeners, and subscribe to a meeting channel.
 * Serializes joins per meeting and always removes stale channels first.
 */
export async function joinMeetingChannel(
  meetingId: string,
  userId: string,
  handlers: SignalingHandlers,
): Promise<RealtimeChannel> {
  const existing = joinLocks.get(meetingId)
  if (existing) return existing

  const promise = joinMeetingChannelOnce(meetingId, userId, handlers)
  joinLocks.set(meetingId, promise)

  try {
    return await promise
  } finally {
    if (joinLocks.get(meetingId) === promise) {
      joinLocks.delete(meetingId)
    }
  }
}

export function broadcastSignal(channel: RealtimeChannel, payload: SignalPayload) {
  void channel.send({ type: 'broadcast', event: 'signal', payload })
}

export async function unsubscribeMeetingChannel(channel: RealtimeChannel) {
  try {
    await channel.untrack()
  } catch {
    // ignore
  }
  try {
    await channel.unsubscribe()
  } catch {
    // ignore
  }
  await supabase.removeChannel(channel)
}
