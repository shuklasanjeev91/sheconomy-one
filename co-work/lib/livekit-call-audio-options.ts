/**
 * Android WebRTC audio-focus presets for meetings.
 *
 * `inCommunication` + exclusive AUDIOFOCUS_GAIN blocks Android SpeechRecognizer
 * (live captions never start). When captions are on we release exclusive focus
 * so Voice STT can share the mic without dropping the LiveKit call.
 */
export type LiveKitSpeechShareLevel = 'off' | 'share' | 'compat'

export function androidAudioTypeOptionsForCall(speechShare: LiveKitSpeechShareLevel = 'off') {
  const sharing = speechShare !== 'off'
  return {
    forceHandleAudioRouting: true as const,
    manageAudioFocus: !sharing,
    audioMode: (speechShare === 'compat' ? 'normal' : 'inCommunication') as
      | 'normal'
      | 'inCommunication',
    audioFocusMode: (sharing ? 'gainTransientMayDuck' : 'gain') as
      | 'gain'
      | 'gainTransientMayDuck',
    audioAttributesUsageType: 'voiceCommunication' as const,
    audioAttributesContentType: 'speech' as const,
    audioStreamType: 'voiceCall' as const,
  }
}

/**
 * Zoom-style output pick.
 * A connected Bluetooth speaker or headset wins unless the user explicitly
 * chose the built-in loudspeaker. Forcing the speaker overrides Bluetooth and
 * puts playback next to the mic, which is the echo you hear in the room.
 */
export function preferredCallAudioOutputId(input: {
  platform: 'ios' | 'android' | 'web'
  outputs: readonly string[]
  mediaMode: string
  forceBuiltInSpeaker: boolean
}): string | null {
  if (input.platform === 'ios') {
    if (input.forceBuiltInSpeaker && input.outputs.includes('force_speaker')) return 'force_speaker'
    return input.outputs.includes('default') ? 'default' : null
  }
  if (input.platform === 'android') {
    if (input.forceBuiltInSpeaker && input.outputs.includes('speaker')) return 'speaker'
    const order =
      input.mediaMode === 'audio'
        ? ['bluetooth', 'headset', 'earpiece', 'speaker']
        : ['bluetooth', 'headset', 'speaker', 'earpiece']
    return order.find((route) => input.outputs.includes(route)) ?? null
  }
  return null
}

/** Locales to try when the OS speech pack for the requested language is missing. */
export function speechRecognitionLocaleFallbacks(requested: string): string[] {
  const primary = (requested || 'en-US').trim() || 'en-US'
  const base = primary.split(/[-_]/)[0]?.toLowerCase() || 'en'
  const candidates = [primary]
  if (base === 'hi') candidates.push('hi-IN', 'en-IN', 'en-US')
  else if (base !== 'en') candidates.push(`${base}-IN`, `${base}-US`, 'en-IN', 'en-US')
  else candidates.push('en-IN', 'en-US')
  return [...new Set(candidates)]
}
