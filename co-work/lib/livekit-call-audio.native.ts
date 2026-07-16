import { Platform } from 'react-native'

import {
  AndroidAudioTypePresets,
  AudioSession,
  setupIOSAudioManagement,
  type AppleAudioConfiguration,
} from '@livekit/react-native'

import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'

export type CallAudioRoute = 'bluetooth' | 'headset' | 'speaker' | 'earpiece' | 'default'

/**
 * WhatsApp-style audio session:
 * - Communication mode (bidirectional voice, AEC/NS)
 * - Prefer Bluetooth / wired headset when present
 * - Voice calls default to earpiece; video / meetings default to speaker
 */
export async function configureLiveKitCallAudio(mediaMode: LiveKitMediaMode = 'meeting'): Promise<void> {
  const preferSpeaker = mediaMode !== 'audio'

  await AudioSession.configureAudio({
    android: {
      preferredOutputList: preferSpeaker
        ? ['bluetooth', 'headset', 'speaker', 'earpiece']
        : ['bluetooth', 'headset', 'earpiece', 'speaker'],
      audioTypeOptions: {
        ...AndroidAudioTypePresets.communication,
        // Required on many Android devices for Bluetooth mic + bidirectional audio.
        forceHandleAudioRouting: true,
        manageAudioFocus: true,
        audioMode: 'inCommunication',
        audioAttributesUsageType: 'voiceCommunication',
        audioAttributesContentType: 'speech',
        audioStreamType: 'voiceCall',
      },
    },
    ios: {
      defaultOutput: preferSpeaker ? 'speaker' : 'earpiece',
    },
  })

  if (Platform.OS === 'ios') {
    await AudioSession.setAppleAudioConfiguration(
      appleConfigForCall({ preferSpeaker, recording: true, playout: true }),
    )
  }

  await AudioSession.startAudioSession()
  await AudioSession.setDefaultRemoteAudioTrackVolume(1)
}

export function stopLiveKitCallAudio(): void {
  void AudioSession.stopAudioSession()
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
  if (input.preferSpeaker) options.push('defaultToSpeaker')

  return {
    audioCategory: 'playAndRecord',
    audioCategoryOptions: options,
    // voiceChat enables hardware AEC/NS; videoChat keeps speaker-friendly routing.
    audioMode: input.preferSpeaker ? 'videoChat' : 'voiceChat',
  }
}

/** Prefer Bluetooth when available, otherwise speaker (video) or earpiece (voice). */
export async function applyPreferredCallAudioOutput(
  mediaMode: LiveKitMediaMode,
  forceSpeaker?: boolean,
): Promise<CallAudioRoute> {
  const outputs = await AudioSession.getAudioOutputs()
  const preferSpeaker = forceSpeaker ?? mediaMode !== 'audio'

  if (Platform.OS === 'android') {
    const order: CallAudioRoute[] = preferSpeaker
      ? ['bluetooth', 'headset', 'speaker', 'earpiece']
      : ['bluetooth', 'headset', 'earpiece', 'speaker']
    for (const route of order) {
      if (outputs.includes(route)) {
        await AudioSession.selectAudioOutput(route)
        return route
      }
    }
    return 'earpiece'
  }

  // iOS: "default" follows Bluetooth/headset; "force_speaker" overrides to speaker.
  if (preferSpeaker && outputs.includes('force_speaker')) {
    await AudioSession.selectAudioOutput('force_speaker')
    return 'speaker'
  }
  if (outputs.includes('default')) {
    await AudioSession.selectAudioOutput('default')
    return 'default'
  }
  return preferSpeaker ? 'speaker' : 'earpiece'
}

export async function toggleCallSpeaker(speakerOn: boolean): Promise<void> {
  const outputs = await AudioSession.getAudioOutputs()
  if (Platform.OS === 'android') {
    if (speakerOn && outputs.includes('speaker')) {
      await AudioSession.selectAudioOutput('speaker')
      return
    }
    // Leaving speaker: prefer Bluetooth → headset → earpiece.
    for (const route of ['bluetooth', 'headset', 'earpiece'] as const) {
      if (outputs.includes(route)) {
        await AudioSession.selectAudioOutput(route)
        return
      }
    }
    return
  }

  if (speakerOn && outputs.includes('force_speaker')) {
    await AudioSession.selectAudioOutput('force_speaker')
    return
  }
  if (outputs.includes('default')) {
    await AudioSession.selectAudioOutput('default')
  }
}

/** Shared capture constraints — echo cancel + noise suppress for WhatsApp-like clarity. */
export const CALL_AUDIO_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const
