import { sendAiMessage } from '~/lib/ai'

/** Ask SHERPA for a short meeting summary from caption text. */
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

  const result = await sendAiMessage({
    product: 'cowork',
    message: prompt,
    contextPage: 'meeting',
  })
  const reply = result.answer.trim()
  if (reply) return reply
  throw new Error('AI summary returned an empty response')
}
