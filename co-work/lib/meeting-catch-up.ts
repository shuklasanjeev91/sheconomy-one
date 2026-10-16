import { buildCatchUpPrompt } from '~/co-work/lib/meeting-studio'
import { supabase } from '~/lib/supabase/client'

/** Short brief for someone who joined after the meeting started. */
export async function catchUpMeeting(input: {
  meetingTitle?: string
  transcript: string
}): Promise<string> {
  const transcript = input.transcript.trim()
  if (!transcript) return 'Nothing to catch up on yet. Captions will fill this in as people talk.'

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: {
      mode: 'chat',
      messages: [{ role: 'user', content: buildCatchUpPrompt(input) }],
    },
  })
  if (error) throw new Error(error.message || 'Catch up failed')
  const reply =
    (data as { reply?: string; message?: string; text?: string } | null)?.reply ||
    (data as { message?: string } | null)?.message ||
    (data as { text?: string } | null)?.text
  if (typeof reply === 'string' && reply.trim()) return reply.trim()
  throw new Error('Catch up returned an empty response')
}
