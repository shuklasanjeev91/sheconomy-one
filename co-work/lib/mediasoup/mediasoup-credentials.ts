import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'
import { readSupabaseFunctionError } from '~/lib/supabase/function-error'
import {
  MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS,
  meetingMediaCredentialRetryDelayMs,
} from '~/co-work/lib/meeting-media-reconnect'

export type MediasoupCredentials = {
  /** Signalling base URL (`wss://host:port`). */
  url: string
  roomId: string
  peerId: string
  token: string
}

type MediasoupTokenResponse = {
  enabled?: boolean
  url?: string
  roomId?: string
  peerId?: string
  token?: string
  error?: string
}

async function fetchOnce(input: {
  meetingId: string
  roomName: string
  displayName: string
  avatarUrl?: string | null
  session: string
}): Promise<MediasoupCredentials> {
  if (!supabaseConfig.url) {
    throw new Error('Could not connect to the meeting service. Please try again later.')
  }
  const { data, error } = await supabase.functions.invoke('mediasoup-token', {
    body: {
      meetingId: input.meetingId,
      roomName: input.roomName,
      displayName: input.displayName,
      session: input.session,
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    },
  })

  if (error) {
    throw new Error(
      await readSupabaseFunctionError(
        error,
        data,
        'Could not join the video room. Check your connection and try again.',
      ),
    )
  }

  const payload = (data ?? {}) as MediasoupTokenResponse
  if (payload.enabled === false) {
    throw new Error('Video meetings are temporarily unavailable. Please try again later.')
  }
  if (payload.error) throw new Error(payload.error)
  if (!payload.url || !payload.token || !payload.roomId || !payload.peerId) {
    throw new Error('Invalid media server response. Please try again.')
  }
  return {
    url: payload.url,
    token: payload.token,
    roomId: payload.roomId,
    peerId: payload.peerId,
  }
}

/** Join credentials for the mediasoup SFU. */
export async function fetchMediasoupCredentials(input: {
  meetingId: string
  roomName: string
  displayName: string
  avatarUrl?: string | null
  session: string
}): Promise<MediasoupCredentials> {
  if (!input.roomName) {
    throw new Error('Meeting room is not ready yet. Please try again in a moment.')
  }
  let lastError: unknown
  for (let attempt = 0; attempt < MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchOnce(input)
    } catch (cause) {
      lastError = cause
      if (attempt >= MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS - 1) break
      await new Promise((resolve) => setTimeout(resolve, meetingMediaCredentialRetryDelayMs(attempt)))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not join the video room. Check your connection and try again.')
}
