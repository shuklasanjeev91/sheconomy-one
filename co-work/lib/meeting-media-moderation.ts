import { supabase } from '~/lib/supabase/client'
import { readSupabaseFunctionError } from '~/lib/supabase/function-error'

async function invokeMediaModeration(body: Record<string, string>, fallback: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('mediasoup-token', { body })
  if (error) throw new Error(await readSupabaseFunctionError(error, data, fallback))
  const payload = data as { error?: string } | null
  if (payload?.error) throw new Error(payload.error)
}

/** Kick a removed / waiting-room participant off the SFU (the DB move is authoritative). */
export async function disconnectMediaParticipant(
  meetingId: string,
  roomName: string,
  participantUserId: string,
): Promise<void> {
  await invokeMediaModeration(
    { action: 'remove-participant', meetingId, roomName, participantUserId },
    'Could not remove participant from the media room.',
  )
}

/** Close the SFU room after the host ends the meeting. */
export async function endMediaRoom(meetingId: string, roomName: string): Promise<void> {
  await invokeMediaModeration({ action: 'end-room', meetingId, roomName }, 'Could not end the media room.')
}
