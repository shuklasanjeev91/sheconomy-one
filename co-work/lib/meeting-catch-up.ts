import { buildCatchUpPrompt } from '~/co-work/lib/meeting-studio'
import { sendAiMessage } from '~/lib/ai'

/** Short brief for someone who joined after the meeting started. */
export async function catchUpMeeting(input: {
  meetingTitle?: string
  transcript: string
}): Promise<string> {
  const transcript = input.transcript.trim()
  if (!transcript) return 'Nothing to catch up on yet. Captions will fill this in as people talk.'

  const result = await sendAiMessage({
    product: 'cowork',
    message: buildCatchUpPrompt(input),
    contextPage: 'meeting',
  })
  const reply = result.answer.trim()
  if (reply) return reply
  throw new Error('Catch up returned an empty response')
}
