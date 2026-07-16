import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

/** Web: browser handles Bluetooth / headset via the OS audio stack. */
export async function configureLiveKitCallAudio(_mediaMode?: LiveKitMediaMode): Promise<void> {}

export function stopLiveKitCallAudio(): void {}

export function bindIosCallAudioManagement(_preferSpeakerOutput: boolean): () => void {
  return () => {}
}

export async function applyPreferredCallAudioOutput(
  mediaMode: LiveKitMediaMode,
  forceSpeaker?: boolean,
): Promise<CallAudioRoute> {
  return forceSpeaker || mediaMode !== 'audio' ? 'speaker' : 'earpiece'
}

export async function toggleCallSpeaker(_speakerOn: boolean): Promise<void> {}

export const CALL_AUDIO_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
} as const
