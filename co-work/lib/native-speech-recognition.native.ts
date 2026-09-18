import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice'
import { PermissionsAndroid, Platform } from 'react-native'

import {
  isLikelyCaptionFragment,
  mergeCaptionHypothesis,
} from '~/co-work/lib/caption-utterance'
import { isNativeRuntime } from '~/lib/platform/capabilities'

import type { NativeSpeechHandlers, NativeSpeechSession } from '~/co-work/lib/native-speech-recognition'

export function isNativeSpeechRecognitionAvailable() {
  return isNativeRuntime()
}

async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone for captions',
        message: 'SHEconomy needs the microphone to show live captions in meetings.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    )
    return granted === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

/** Prefer requested locale; fall back when the OS speech pack is missing (common for hi-IN). */
function localeFallbacks(requested: string): string[] {
  const primary = (requested || 'en-US').trim() || 'en-US'
  const base = primary.split(/[-_]/)[0]?.toLowerCase() || 'en'
  const candidates = [primary]
  if (base === 'hi') candidates.push('hi-IN', 'en-IN', 'en-US')
  else if (base !== 'en') candidates.push(`${base}-IN`, `${base}-US`, 'en-IN', 'en-US')
  else candidates.push('en-IN', 'en-US')
  return [...new Set(candidates)]
}

/** Keep the recognizer open longer so multi-word sentences survive LiveKit mic contention. */
const ANDROID_VOICE_OPTIONS = {
  EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
  EXTRA_MAX_RESULTS: 5,
  EXTRA_PARTIAL_RESULTS: true,
  REQUEST_PERMISSIONS_AUTO: true,
  // ~2.5s of silence before Android ends the utterance (default is much shorter).
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 1200,
} as const

async function startVoiceWithFallback(locales: string[]): Promise<string> {
  let lastError: unknown = null
  for (const locale of locales) {
    try {
      if (Platform.OS === 'android') {
        await Voice.start(locale, ANDROID_VOICE_OPTIONS as never)
      } else {
        await Voice.start(locale)
      }
      return locale
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Speech recognition failed to start')
}

export async function createNativeSpeechSession(
  handlers: NativeSpeechHandlers,
): Promise<NativeSpeechSession | null> {
  if (!isNativeRuntime()) return null

  // Do not hard-fail on Voice.isAvailable() — on iOS it often returns false until
  // speech permission is granted / while LiveKit holds the audio session. Try start.
  try {
    await Voice.isAvailable().catch(() => null)
  } catch {
    // continue — start() still prompts for permission
  }

  const micOk = await ensureMicrophonePermission()
  if (!micOk) {
    handlers.onError?.('Microphone access is required for live captions')
    return null
  }

  let shouldRestart = false
  let locale = 'en-US'
  let starting = false
  /** Growing hypothesis for the current spoken utterance. */
  let utterance = ''
  let finalizeTimer: ReturnType<typeof setTimeout> | null = null

  const clearFinalizeTimer = () => {
    if (!finalizeTimer) return
    clearTimeout(finalizeTimer)
    finalizeTimer = null
  }

  const emitPartial = (text: string) => {
    const merged = mergeCaptionHypothesis(utterance, text)
    if (!merged) return
    utterance = merged
    handlers.onPartial?.(merged)
  }

  const commitUtterance = (force = false) => {
    clearFinalizeTimer()
    const text = utterance.trim()
    if (!text) return
    if (!force && isLikelyCaptionFragment(text) && text.split(/\s+/).length <= 1) {
      // Keep a lone word as live interim — wait for more speech or speech-end.
      handlers.onPartial?.(text)
      return
    }
    utterance = ''
    handlers.onFinal?.(text)
  }

  const scheduleFinalize = (delayMs: number) => {
    clearFinalizeTimer()
    finalizeTimer = setTimeout(() => {
      finalizeTimer = null
      commitUtterance(true)
    }, delayMs)
  }

  const onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (!text) return
    clearFinalizeTimer()
    emitPartial(text)
  }

  const onSpeechResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (!text && !utterance) return
    clearFinalizeTimer()
    if (text) emitPartial(text)
    // Android often fires results after every short pause with 1–2 words.
    // Keep accumulating; only finalize after a quiet gap or speech-end.
    if (Platform.OS === 'android' && isLikelyCaptionFragment(utterance)) {
      scheduleFinalize(1400)
      return
    }
    scheduleFinalize(Platform.OS === 'android' ? 900 : 350)
  }

  const onSpeechError = (event: SpeechErrorEvent) => {
    const code = String(event.error?.code ?? '')
    const message = String(event.error?.message ?? 'Speech recognition error')
    // 6 = recognizer busy, 7 = no match — both recoverable via restart.
    if (code.includes('7') || /no.?speech|no.?match/i.test(message)) return
    if (code.includes('6') || /busy|recognizer/i.test(message)) return
    if (/permission|not.?authorized|denied/i.test(message)) {
      shouldRestart = false
      clearFinalizeTimer()
      handlers.onError?.('Microphone access is required for live captions')
      return
    }
    // Soft — keep viewing remote captions; restart will retry.
  }

  const restartSoon = () => {
    if (!shouldRestart || starting) return
    starting = true
    const delay = Platform.OS === 'android' ? 280 : 220
    setTimeout(() => {
      if (!shouldRestart) {
        starting = false
        return
      }
      void startVoiceWithFallback(localeFallbacks(locale))
        .then((used) => {
          locale = used
        })
        .catch(() => {
          setTimeout(() => {
            if (!shouldRestart) return
            void startVoiceWithFallback(localeFallbacks(locale)).catch(() => {
              shouldRestart = false
            })
          }, 900)
        })
        .finally(() => {
          starting = false
        })
    }, delay)
  }

  const onSpeechEnd = () => {
    // Flush whatever we heard before the recognizer restarts.
    if (utterance.trim()) {
      commitUtterance(true)
    }
    handlers.onEnd?.()
    restartSoon()
  }

  Voice.onSpeechPartialResults = onSpeechPartialResults
  Voice.onSpeechResults = onSpeechResults
  Voice.onSpeechError = onSpeechError
  Voice.onSpeechEnd = onSpeechEnd

  return {
    async start(nextLocale: string) {
      locale = nextLocale || 'en-US'
      shouldRestart = true
      utterance = ''
      clearFinalizeTimer()
      try {
        await Voice.cancel()
      } catch {
        try {
          await Voice.stop()
        } catch {
          // ignore — may not be running yet
        }
      }
      // Yield so LiveKit's AVAudioSession can share the mic with Voice.
      await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? 280 : 320))
      const used = await startVoiceWithFallback(localeFallbacks(locale))
      locale = used
    },
    async stop() {
      shouldRestart = false
      clearFinalizeTimer()
      if (utterance.trim()) commitUtterance(true)
      try {
        await Voice.cancel()
      } catch {
        try {
          await Voice.stop()
        } catch {
          // ignore
        }
      }
    },
    async destroy() {
      shouldRestart = false
      clearFinalizeTimer()
      utterance = ''
      try {
        await Voice.cancel()
      } catch {
        try {
          await Voice.stop()
        } catch {
          // ignore
        }
      }
      try {
        await Voice.destroy()
      } catch {
        // ignore
      }
      Voice.removeAllListeners()
    },
  }
}
