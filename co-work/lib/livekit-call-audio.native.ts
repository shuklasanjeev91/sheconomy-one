import { NativeModules, Platform } from 'react-native'

import {
  AndroidAudioTypePresets,
  AudioDeviceModule,
  AudioSession,
  setupIOSAudioManagement,
  type AppleAudioConfiguration,
} from '@livekit/react-native'

import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'
import {
  androidAudioTypeOptionsForCall,
  preferredCallAudioOutputId,
  type LiveKitSpeechShareLevel,
} from '~/co-work/lib/livekit-call-audio-options'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

/**
 * Generation token so overlapping mount/unmount (or mediaMode changes) cannot
 * let a stale configure finish after cleanup and restart another room's session.
 */
let audioSessionGeneration = 0
/** Last successful media mode — used when restoring after local recording. */
let lastCallMediaMode: LiveKitMediaMode = 'meeting'
/** Captions STT needs to share the mic with WebRTC; reconnects must keep this. */
let speechShareLevel: LiveKitSpeechShareLevel = 'off'
/** True only after the user taps the loudspeaker control. Otherwise Bluetooth wins. */
let userForcedBuiltInSpeaker = false

export function getActiveCallMediaMode(): LiveKitMediaMode {
  return lastCallMediaMode
}

export function getLiveKitCallAudioSpeechShare(): LiveKitSpeechShareLevel {
  return speechShareLevel
}

/**
 * WhatsApp-style audio session:
 * - Communication mode (bidirectional voice, AEC/NS)
 * - Prefer Bluetooth / wired headset when present
 * - Voice calls default to earpiece; video / meetings default to speaker
 */
export async function configureLiveKitCallAudio(mediaMode: LiveKitMediaMode = 'meeting'): Promise<void> {
  const generation = ++audioSessionGeneration
  const preferSpeaker = mediaMode !== 'audio'
  lastCallMediaMode = mediaMode

  await AudioSession.configureAudio({
    android: {
      preferredOutputList: preferSpeaker
        ? ['bluetooth', 'headset', 'speaker', 'earpiece']
        : ['bluetooth', 'headset', 'earpiece', 'speaker'],
      audioTypeOptions: {
        ...AndroidAudioTypePresets.communication,
        ...androidAudioTypeOptionsForCall(speechShareLevel),
      },
    },
    ios: {
      defaultOutput: preferSpeaker ? 'speaker' : 'earpiece',
    },
  })

  if (generation !== audioSessionGeneration) return

  if (Platform.OS === 'ios') {
    await AudioSession.setAppleAudioConfiguration(
      appleConfigForCall({ preferSpeaker, recording: true, playout: true }),
    )
  }

  if (generation !== audioSessionGeneration) return

  await AudioSession.startAudioSession()
  // VoiceProcessingIO does echo cancellation and noise suppression.
  // Software AEC on top of it sounds watery and does not cancel the speaker.
  void NativeModules.LiveCaptionSpeech?.prepare?.().catch(() => {})
  if (Platform.OS === 'ios') {
    try {
      await AudioDeviceModule.setVoiceProcessingEnabled(true)
      AudioDeviceModule.setVoiceProcessingBypassed(false)
      // AGC lifts quiet room noise into the mix. Leave echo and noise filters on.
      AudioDeviceModule.setVoiceProcessingAGCEnabled(false)
    } catch {
      // Engine may not be up yet; videoChat mode still requests voice processing.
    }
  }
  if (generation !== audioSessionGeneration) {
    void AudioSession.stopAudioSession()
    return
  }

  await AudioSession.setDefaultRemoteAudioTrackVolume(1)
}

export function stopLiveKitCallAudio(): void {
  audioSessionGeneration += 1
  speechShareLevel = 'off'
  userForcedBuiltInSpeaker = false
  void AudioSession.stopAudioSession()
}

/**
 * Release exclusive Android audio focus (and optionally MODE_IN_COMMUNICATION)
 * so SpeechRecognizer can start during a live meeting. Call with `off` when
 * captions stop so AEC/Bluetooth routing return to the call preset.
 */
export async function setLiveKitCallAudioSpeechShare(
  level: LiveKitSpeechShareLevel,
): Promise<void> {
  if (speechShareLevel === level) return
  speechShareLevel = level
  try {
    await configureLiveKitCallAudio(lastCallMediaMode)
    await applyPreferredCallAudioOutput(lastCallMediaMode)
  } catch {
    // Room may already be closing.
  }
}

/** Keep iOS AVAudioSession in playAndRecord + Bluetooth while the room is live. */
export function bindIosCallAudioManagement(preferSpeakerOutput: boolean): () => void {
  if (Platform.OS !== 'ios') return () => {}

  return setupIOSAudioManagement(preferSpeakerOutput, (state) =>
    appleConfigForCall({
      preferSpeaker: state.preferSpeakerOutput || preferSpeakerOutput,
      recording: state.isRecordingEnabled,
      playout: state.isPlayoutEnabled,
    }),
  )
}

function appleConfigForCall(input: {
  preferSpeaker: boolean
  recording: boolean
  playout: boolean
}): AppleAudioConfiguration {
  const options: NonNullable<AppleAudioConfiguration['audioCategoryOptions']> = [
    'allowBluetooth',
    'allowBluetoothA2DP',
    'allowAirPlay',
  ]
  // Only default to speaker when no accessory path is preferred by the OS
  // and the call is video/meeting. Accessory selection happens in applyPreferredCallAudioOutput.
  if (input.preferSpeaker) options.push('defaultToSpeaker')

  return {
    audioCategory: 'playAndRecord',
    audioCategoryOptions: options,
    // videoChat/voiceChat enable VoiceProcessingIO: hardware echo cancellation
    // and noise suppression. Captions read the WebRTC mic buffers, so they do
    // not need this mode turned off.
    audioMode: input.preferSpeaker ? 'videoChat' : 'voiceChat',
  }
}

function routeFromOutputId(outputId: string | null, mediaMode: LiveKitMediaMode): CallAudioRoute {
  if (outputId === 'force_speaker' || outputId === 'speaker') return 'speaker'
  if (outputId === 'bluetooth' || outputId === 'headset' || outputId === 'earpiece') return outputId
  if (outputId === 'default') return 'default'
  return mediaMode === 'audio' ? 'earpiece' : 'speaker'
}

/**
 * Prefer a connected Bluetooth speaker or headset. The built-in loudspeaker
 * is used only when the user turns it on, or when nothing else is connected.
 */
export async function applyPreferredCallAudioOutput(
  mediaMode: LiveKitMediaMode,
  forceSpeaker?: boolean,
): Promise<CallAudioRoute> {
  const outputs = await AudioSession.getAudioOutputs()
  const outputId = preferredCallAudioOutputId({
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    outputs,
    mediaMode,
    forceBuiltInSpeaker: forceSpeaker ?? userForcedBuiltInSpeaker,
  })
  if (outputId) {
    await AudioSession.selectAudioOutput(outputId)
  }
  return routeFromOutputId(outputId, mediaMode)
}

export async function toggleCallSpeaker(speakerOn: boolean): Promise<CallAudioRoute> {
  userForcedBuiltInSpeaker = speakerOn
  return applyPreferredCallAudioOutput(lastCallMediaMode, speakerOn)
}

/** iOS system picker for Bluetooth speakers, headsets, and AirPlay. */
export async function showCallAudioOutputPicker(): Promise<void> {
  if (Platform.OS !== 'ios') return
  userForcedBuiltInSpeaker = false
  await AudioSession.selectAudioOutput('default')
  await AudioSession.showAudioRoutePicker()
}

/** Shared capture constraints — echo cancel + noise suppress for WhatsApp-like clarity. */
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
