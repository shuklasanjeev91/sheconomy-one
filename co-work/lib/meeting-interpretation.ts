/**
 * Interpretation / webinar mode preferences (host-controlled UI state).
 * Channel routing is a soft preference — media still uses the main SFU room.
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

export type MeetingWebinarMode = 'meeting' | 'webinar'

export function defaultInterpretationChannelId(): string {
  return 'floor'
}
