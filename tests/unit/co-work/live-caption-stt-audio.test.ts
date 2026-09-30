import { describe, expect, it } from 'vitest'

import {
  androidAudioTypeOptionsForCall,
  preferredCallAudioOutputId,
  speechRecognitionLocaleFallbacks,
} from '~/co-work/lib/call-audio-options'

describe('androidAudioTypeOptionsForCall', () => {
  it('keeps exclusive communication focus when captions are off', () => {
    expect(androidAudioTypeOptionsForCall('off')).toMatchObject({
      manageAudioFocus: true,
      audioMode: 'inCommunication',
      audioFocusMode: 'gain',
      forceHandleAudioRouting: true,
    })
  })

  it('releases exclusive focus so SpeechRecognizer can start during a call', () => {
    expect(androidAudioTypeOptionsForCall('share')).toMatchObject({
      manageAudioFocus: false,
      audioMode: 'inCommunication',
      audioFocusMode: 'gainTransientMayDuck',
    })
  })

  it('falls back to MODE_NORMAL when WebRTC still blocks the recognizer', () => {
    expect(androidAudioTypeOptionsForCall('compat')).toMatchObject({
      manageAudioFocus: false,
      audioMode: 'normal',
      audioFocusMode: 'gainTransientMayDuck',
    })
  })
})

describe('preferredCallAudioOutputId', () => {
  it('keeps iOS on the system route so a Bluetooth speaker stays connected', () => {
    expect(
      preferredCallAudioOutputId({
        platform: 'ios',
        outputs: ['default', 'force_speaker'],
        mediaMode: 'meeting',
        forceBuiltInSpeaker: false,
      }),
    ).toBe('default')
  })

  it('uses the iPad speaker only when the user asks for it', () => {
    expect(
      preferredCallAudioOutputId({
        platform: 'ios',
        outputs: ['default', 'force_speaker'],
        mediaMode: 'meeting',
        forceBuiltInSpeaker: true,
      }),
    ).toBe('force_speaker')
  })

  it('prefers a connected Android Bluetooth speaker over the loudspeaker', () => {
    expect(
      preferredCallAudioOutputId({
        platform: 'android',
        outputs: ['speaker', 'earpiece', 'bluetooth'],
        mediaMode: 'meeting',
        forceBuiltInSpeaker: false,
      }),
    ).toBe('bluetooth')
  })
})

describe('speechRecognitionLocaleFallbacks', () => {
  it('falls back from Hindi to Indian/US English when the speech pack is missing', () => {
    expect(speechRecognitionLocaleFallbacks('hi-IN')).toEqual(['hi-IN', 'en-IN', 'en-US'])
  })

  it('always ends with a widely installed English locale', () => {
    const locales = speechRecognitionLocaleFallbacks('ta-IN')
    expect(locales[0]).toBe('ta-IN')
    expect(locales).toContain('en-IN')
    expect(locales).toContain('en-US')
  })

  it('dedupes English requests', () => {
    expect(speechRecognitionLocaleFallbacks('en-IN')).toEqual(['en-IN', 'en-US'])
  })
})
