import { NativeModules, Platform } from 'react-native'

import CallAudio from '~/modules/call-audio'
import type { MeetingMediaMode } from '~/co-work/lib/meeting-media-controls'
import {
  androidAudioTypeOptionsForCall,
  preferredCallAudioOutputId,
  type CallSpeechShareLevel,
} from '~/co-work/lib/call-audio-options'

export { CALL_AUDIO_CAPTURE, resolveCallAudioCapture } from '~/co-work/lib/call-audio-options'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

/**
 * Generation token so overlapping mount/unmount (or mediaMode changes) cannot
 * let a stale configure finish after cleanup and restart another room's session.
 */
let audioSessionGeneration = 0
/** Last successful media mode — used when restoring after local recording. */
let lastCallMediaMode: MeetingMediaMode = 'meeting'
/** Captions STT needs to share the mic with WebRTC; reconnects must keep this. */
let speechShareLevel: CallSpeechShareLevel = 'off'
/** True only after the user taps the loudspeaker control. Otherwise Bluetooth wins. */
let userForcedBuiltInSpeaker = false

function requireCallAudio() {
  if (!CallAudio) throw new Error('Call audio is not available in this build.')
  return CallAudio
}

export function getActiveCallMediaMode(): MeetingMediaMode {
  return lastCallMediaMode
}

export function getCallAudioSpeechShare(): CallSpeechShareLevel {
  return speechShareLevel
}

function appleCategoryOptions(preferSpeaker: boolean): string[] {
  const options = ['allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay']
  // Accessory selection happens in applyPreferredCallAudioOutput.
  if (preferSpeaker) options.push('defaultToSpeaker')
  return options
}

/**
 * WhatsApp-style audio session:
 * - Communication mode (bidirectional voice, AEC/NS)
 * - Prefer Bluetooth / wired headset when present
 * - Voice calls default to earpiece; video / meetings default to speaker
 */
export async function configureCallAudio(mediaMode: MeetingMediaMode = 'meeting'): Promise<void> {
  const generation = ++audioSessionGeneration
  const preferSpeaker = mediaMode !== 'audio'
  lastCallMediaMode = mediaMode
  const native = requireCallAudio()

  if (Platform.OS === 'android') {
    await native.configureAndroid({
      preferredOutputList: preferSpeaker
        ? ['bluetooth', 'headset', 'speaker', 'earpiece']
        : ['bluetooth', 'headset', 'earpiece', 'speaker'],
      ...androidAudioTypeOptionsForCall(speechShareLevel),
    })
  } else {
    // videoChat/voiceChat enable VoiceProcessingIO: hardware echo cancellation
    // and noise suppression. WebRTC re-applies this whenever it starts audio.
    await native.configureApple({
      category: 'playAndRecord',
      categoryOptions: appleCategoryOptions(preferSpeaker),
      mode: preferSpeaker ? 'videoChat' : 'voiceChat',
    })
  }

  if (generation !== audioSessionGeneration) return
  await native.start()
  void NativeModules.LiveCaptionSpeech?.prepare?.().catch(() => {})
  if (generation !== audioSessionGeneration) void native.stop()
}

export function stopCallAudio(): void {
  audioSessionGeneration += 1
  speechShareLevel = 'off'
  userForcedBuiltInSpeaker = false
  void CallAudio?.stop().catch(() => {})
}

/**
 * Release exclusive Android audio focus (and optionally MODE_IN_COMMUNICATION)
 * so SpeechRecognizer can start during a live meeting. Call with `off` when
 * captions stop so AEC/Bluetooth routing return to the call preset.
 */
export async function setCallAudioSpeechShare(level: CallSpeechShareLevel): Promise<void> {
  if (speechShareLevel === level) return
  speechShareLevel = level
  try {
    await configureCallAudio(lastCallMediaMode)
    await applyPreferredCallAudioOutput(lastCallMediaMode)
  } catch {
    // Room may already be closing.
  }
}

function routeFromOutputId(outputId: string | null, mediaMode: MeetingMediaMode): CallAudioRoute {
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
  mediaMode: MeetingMediaMode,
  forceSpeaker?: boolean,
): Promise<CallAudioRoute> {
  const native = requireCallAudio()
  const outputs = await native.getOutputs()
  const outputId = preferredCallAudioOutputId({
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    outputs,
    mediaMode,
    forceBuiltInSpeaker: forceSpeaker ?? userForcedBuiltInSpeaker,
  })
  if (outputId) await native.selectOutput(outputId)
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
  const native = requireCallAudio()
  await native.selectOutput('default')
  await native.showRoutePicker()
}
