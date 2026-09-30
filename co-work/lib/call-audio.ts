import type { MeetingMediaMode } from '~/co-work/lib/meeting-media-controls'
import type { CallSpeechShareLevel } from '~/co-work/lib/call-audio-options'

export { CALL_AUDIO_CAPTURE, resolveCallAudioCapture } from '~/co-work/lib/call-audio-options'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

let lastCallMediaMode: MeetingMediaMode = 'meeting'

export function getActiveCallMediaMode(): MeetingMediaMode {
  return lastCallMediaMode
}

export function getCallAudioSpeechShare(): CallSpeechShareLevel {
  return 'off'
}

export async function setCallAudioSpeechShare(_level: CallSpeechShareLevel): Promise<void> {}

/** Web: browser handles Bluetooth / headset via the OS audio stack. */
export async function configureCallAudio(mediaMode: MeetingMediaMode = 'meeting'): Promise<void> {
  lastCallMediaMode = mediaMode
}

export function stopCallAudio(): void {}

export async function applyPreferredCallAudioOutput(
  mediaMode: MeetingMediaMode,
  forceSpeaker?: boolean,
): Promise<CallAudioRoute> {
  return forceSpeaker || mediaMode !== 'audio' ? 'speaker' : 'earpiece'
}

export async function toggleCallSpeaker(speakerOn: boolean): Promise<CallAudioRoute> {
  // Web output follows the OS / browser device picker; UI reflects the request.
  return speakerOn ? 'speaker' : 'earpiece'
}

export async function showCallAudioOutputPicker(): Promise<void> {}
