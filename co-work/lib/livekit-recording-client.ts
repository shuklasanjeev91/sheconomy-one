import { supabase } from '~/lib/supabase'

export type LiveKitRecordingControlResult = {
  ok: boolean
  recordingId?: string
  recordingSid?: string
  warning?: string
  error?: string
  /** True when cloud egress was not configured and client should fall back locally. */
  useLocalFallback?: boolean
}

export async function startLiveKitCloudRecording(input: {
  meetingId: string
  roomName: string
}): Promise<LiveKitRecordingControlResult> {
  const { data, error } = await supabase.functions.invoke('livekit-recording', {
    body: {
      action: 'start',
      meetingId: input.meetingId,
      roomName: input.roomName,
    },
  })

  if (error) {
    return { ok: false, error: error.message, useLocalFallback: true }
  }

  const payload = (data ?? {}) as LiveKitRecordingControlResult
  if (!payload.ok) {
    return {
      ok: false,
      error: payload.error || 'Could not start cloud recording',
      useLocalFallback: true,
    }
  }

  // Edge function may create a DB row without S3 egress — treat as local fallback.
  if (payload.warning && !payload.recordingSid) {
    return {
      ...payload,
      useLocalFallback: true,
    }
  }

  return payload
}

export async function stopLiveKitCloudRecording(input: {
  meetingId: string
  roomName: string
  recordingId: string
}): Promise<LiveKitRecordingControlResult> {
  const { data, error } = await supabase.functions.invoke('livekit-recording', {
    body: {
      action: 'stop',
      meetingId: input.meetingId,
      roomName: input.roomName,
      recordingId: input.recordingId,
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return (data ?? { ok: false, error: 'Could not stop cloud recording' }) as LiveKitRecordingControlResult
}
