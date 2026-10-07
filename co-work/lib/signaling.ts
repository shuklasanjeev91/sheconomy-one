import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase/client'

import type { SignalPayload } from '~/co-work/lib/types'
import { shouldEmitRealtimeDisconnect } from '~/co-work/lib/meeting-presence-refresh'

export type MeetingChatInsertRow = {
  id: string
  meeting_id: string
  sender_id: string
  message_text: string
  message_type: string
  created_at: string | null
  is_deleted?: boolean | null
  audience?: string | null
  recipient_id?: string | null
  system_event_type?: string | null
  metadata?: unknown
}

export type SignalingHandlers = {
  onSignal: (payload: SignalPayload) => void
  onParticipantChange?: () => void
  onChatMessage?: (row?: MeetingChatInsertRow) => void
  onPresenceSync?: (onlineUserIds: string[]) => void
  onConnectionState?: (connected: boolean) => void
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
  joinLocks.delete(meetingId)
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
      { event: '*', schema: 'public', table: 'meeting_roles', filter: `meeting_id=eq.${meetingId}` },
      () => handlers.onParticipantChange?.(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meeting_chat_messages', filter: `meeting_id=eq.${meetingId}` },
      (payload) => {
        const row = payload.new as MeetingChatInsertRow | null
        handlers.onChatMessage?.(row ?? undefined)
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'meeting_chat_messages', filter: `meeting_id=eq.${meetingId}` },
      () => handlers.onChatMessage?.(undefined),
    )
    .on('presence', { event: 'sync' }, () => {
      handlers.onPresenceSync?.(Object.keys(channel.presenceState()))
    })
}

async function subscribeMeetingChannel(
  channel: RealtimeChannel,
  userId: string,
  onConnectionState?: (connected: boolean) => void,
): Promise<RealtimeChannel> {
  const SUBSCRIBE_TIMEOUT_MS = 12_000

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const timer = setTimeout(() => {
      console.debug('[signaling] subscribeMeetingChannel: subscribe timed out')
      // Do not emit disconnected here — joinMeetingChannel retries. Emitting
      // degraded mid-retry stacked auto-heal on top of the in-flight subscribe.
      finish(() => reject(new Error('Meeting channel subscribe timed out')))
    }, SUBSCRIBE_TIMEOUT_MS)

    channel.subscribe(async (status, err) => {
      console.debug('[signaling] channel.subscribe status=', status, 'err=', err?.message)
      if (status === 'SUBSCRIBED') {
        console.debug('[signaling] subscribeMeetingChannel: SUBSCRIBED')
        onConnectionState?.(true)
        try {
          await channel.track({ userId, online_at: new Date().toISOString() })
        } catch {
          // Presence track is best-effort; channel is still usable for broadcast.
        }
        finish(() => resolve(channel))
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.debug('[signaling] subscribeMeetingChannel: failed status=', status, 'error=', err?.message)
        if (shouldEmitRealtimeDisconnect({ subscribeSettled: settled, status })) {
          onConnectionState?.(false)
        }
        finish(() => reject(new Error(err?.message ?? `Failed to join meeting channel (${status})`)))
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
  return subscribeMeetingChannel(channel, userId, handlers.onConnectionState)
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
  if (existing) {
    try {
      return await existing
    } catch {
      // Previous join failed/timed out — fall through and retry.
    }
  }

  const MAX_ATTEMPTS = 3
  let attempt = 0

  const promise = (async () => {
    while (true) {
      attempt += 1
      try {
        console.debug(`[signaling] joinMeetingChannel: attempt ${attempt} for ${meetingId}`)
        const channel = await joinMeetingChannelOnce(meetingId, userId, handlers)
        console.debug(`[signaling] joinMeetingChannel: joined on attempt ${attempt} for ${meetingId}`)
        return channel
      } catch (err) {
        console.debug(`[signaling] joinMeetingChannel: attempt ${attempt} failed for ${meetingId}:`, err)
        // Cleanup any partial channel state before retrying.
        try {
          await removeMeetingChannel(meetingId)
        } catch {
          // ignore
        }
        if (attempt >= MAX_ATTEMPTS) {
          console.debug(`[signaling] joinMeetingChannel: all ${MAX_ATTEMPTS} attempts failed for ${meetingId}`)
          throw err
        }
        const backoff = 500 * Math.pow(2, attempt - 1)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  })()

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
