import { fetchLiveKitConfig } from '~/lib/livekit/config'
import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type LiveKitCredentials = {
  token: string
  serverUrl: string
  roomName: string
}

type LiveKitTokenResponse = {
  token?: string
  url?: string
  serverUrl?: string
  roomName?: string
  error?: string
}

/** Fetch LiveKit token + server URL from sheconomy_db edge functions. */
export async function fetchLiveKitCredentials(
  meetingId: string,
  roomName: string,
  displayName: string,
  avatarUrl?: string | null,
): Promise<LiveKitCredentials> {
  if (!roomName) {
    throw new Error('Meeting room is not ready yet. Please try again in a moment.')
  }

  if (!supabaseConfig.url) {
    throw new Error('Could not connect to the meeting service. Please try again later.')
  }

  const config = await fetchLiveKitConfig()
  if (!config.enabled && !config.serverUrl) {
    throw new Error('Video meetings are temporarily unavailable. Please try again later.')
  }

  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      meetingId,
      displayName,
      roomName,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get LiveKit meeting token')
  }

  const payload = data as LiveKitTokenResponse
  if (payload.error || !payload.token) {
    throw new Error(payload.error || 'Invalid LiveKit token response')
  }

  const serverUrl = payload.url || payload.serverUrl || config.serverUrl
  if (!serverUrl) {
    throw new Error('LiveKit server URL missing from token response')
  }

  return {
    token: payload.token,
    serverUrl,
    roomName: payload.roomName || roomName,
  }
}

export async function disconnectLiveKitParticipant(
  meetingId: string,
  roomName: string,
  participantUserId: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      action: 'remove-participant',
      meetingId,
      roomName,
      participantUserId,
    },
  })
  if (error) throw new Error(error.message || 'Could not remove participant from the media room.')
  const payload = data as { error?: string }
  if (payload?.error) throw new Error(payload.error)
}

export async function endLiveKitRoom(meetingId: string, roomName: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { action: 'end-room', meetingId, roomName },
  })
  if (error) throw new Error(error.message || 'Could not end the media room.')
  const payload = data as { error?: string }
  if (payload?.error) throw new Error(payload.error)
}

export async function getLiveKitMaxParticipants(): Promise<number> {
  const config = await fetchLiveKitConfig()
  return config.maxParticipants
}

/** @deprecated Use getLiveKitMaxParticipants() for Supabase-backed config. */
export const LIVEKIT_MAX_PARTICIPANTS = 500
