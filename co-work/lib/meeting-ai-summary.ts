import { supabase } from '~/lib/supabase/client'

/**
 * Ask ai-assist for a short meeting summary from caption/transcript text.
 */
export async function summarizeMeetingTranscript(input: {
  meetingTitle?: string
  transcript: string
}): Promise<string> {
  const transcript = input.transcript.trim()
  if (!transcript) return 'No transcript lines yet — turn on captions to build a summary.'

  const prompt = [
    'Summarize this meeting for the host in 5-8 concise bullets.',
    'Include decisions, action items (with owners if named), and open questions.',
    input.meetingTitle ? `Meeting title: ${input.meetingTitle}` : null,
    'Transcript:',
    transcript.slice(0, 12_000),
  ]
    .filter(Boolean)
    .join('\n\n')

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: {
      mode: 'chat',
      messages: [{ role: 'user', content: prompt }],
    },
  })
  if (error) throw new Error(error.message || 'AI summary failed')
  const reply =
    (data as { reply?: string; message?: string; text?: string } | null)?.reply ||
    (data as { message?: string } | null)?.message ||
    (data as { text?: string } | null)?.text
  if (typeof reply === 'string' && reply.trim()) return reply.trim()
  throw new Error('AI summary returned an empty response')
}
