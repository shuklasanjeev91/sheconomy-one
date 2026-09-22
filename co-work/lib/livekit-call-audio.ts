import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

let lastCallMediaMode: LiveKitMediaMode = 'meeting'

export function getActiveCallMediaMode(): LiveKitMediaMode {
  return lastCallMediaMode
}

/** Web: browser handles Bluetooth / headset via the OS audio stack. */
export async function configureLiveKitCallAudio(mediaMode: LiveKitMediaMode = 'meeting'): Promise<void> {
  lastCallMediaMode = mediaMode
}

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

export async function toggleCallSpeaker(speakerOn: boolean): Promise<CallAudioRoute> {
  // Web output follows the OS / browser device picker; UI reflects the request.
  return speakerOn ? 'speaker' : 'earpiece'
}

export const CALL_AUDIO_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const

/** Resolve mic capture constraints from persisted meeting media prefs (Original Sound). */
export async function resolveCallAudioCapture(): Promise<{
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}> {
  try {
    const { loadMeetingMediaPrefs, meetingAudioCaptureConstraints } = await import(
      '~/co-work/lib/meeting-media-prefs'
    )
    return meetingAudioCaptureConstraints(await loadMeetingMediaPrefs())
  } catch {
    return { ...CALL_AUDIO_CAPTURE }
  }
}
