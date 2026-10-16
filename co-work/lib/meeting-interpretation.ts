/**
 * Language interpretation on the main SFU room.
 * Interpreters publish `interpretation:<channel>` audio. Listeners pick a channel locally.
 */

export type MeetingInterpretationChannel = {
  id: string
  label: string
  languageCode: string
}

export const MEETING_INTERPRETATION_CHANNELS: MeetingInterpretationChannel[] = [
  { id: 'floor', label: 'Floor (original)', languageCode: 'und' },
  { id: 'en', label: 'English', languageCode: 'en' },
  { id: 'hi', label: 'Hindi', languageCode: 'hi' },
  { id: 'es', label: 'Spanish', languageCode: 'es' },
]

export const MEETING_INTERPRETER_CHANNELS = MEETING_INTERPRETATION_CHANNELS.filter(
  (channel) => channel.id !== 'floor',
)

export type MeetingWebinarMode = 'meeting' | 'webinar'

export type InterpretationAssignment = Record<string, string>

export type InterpretationAudioSlot = {
  consumerId: string
  kind: 'floor' | 'interpretation'
  channelId: string | null
}

export function defaultInterpretationChannelId(): string {
  return 'floor'
}

export function interpretationChannelLabel(channelId: string | null | undefined): string {
  return MEETING_INTERPRETATION_CHANNELS.find((channel) => channel.id === channelId)?.label ?? 'Floor (original)'
}

/** `interpretation:hi` → `hi`. Anything else is not an interpretation producer. */
export function interpretationChannelFromSource(source: string | undefined): string | null {
  if (!source?.startsWith('interpretation:')) return null
  const channel = source.slice('interpretation:'.length)
  return MEETING_INTERPRETER_CHANNELS.some((row) => row.id === channel) ? channel : null
}

export function normalizeInterpretationAssignments(value: unknown): InterpretationAssignment {
  if (!value || typeof value !== 'object') return {}
  const next: InterpretationAssignment = {}
  for (const [userId, channelId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof userId !== 'string' || !userId) continue
    if (typeof channelId !== 'string') continue
    if (!MEETING_INTERPRETER_CHANNELS.some((row) => row.id === channelId)) continue
    next[userId] = channelId
  }
  return next
}

/**
 * Consumers that should be paused for this listener.
 * Interpreters always hear the floor (`hearFloor`), so their translation is not mixed back to them.
 */
export function interpretationConsumersToPause(input: {
  listenChannel: string
  hearFloor: boolean
  slots: InterpretationAudioSlot[]
}): string[] {
  const listen = input.listenChannel
  const paused: string[] = []
  for (const slot of input.slots) {
    if (slot.kind === 'floor') {
      if (!input.hearFloor) paused.push(slot.consumerId)
      continue
    }
    const play = !input.hearFloor && slot.channelId === listen
    if (!play) paused.push(slot.consumerId)
  }
  return paused
}
