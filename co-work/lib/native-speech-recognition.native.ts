import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice'
import { PermissionsAndroid, Platform } from 'react-native'

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

async function startVoiceWithFallback(locales: string[]): Promise<string> {
  let lastError: unknown = null
  for (const locale of locales) {
    try {
      await Voice.start(locale)
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
  let lastPartial = ''

  const onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (!text) return
    lastPartial = text
    handlers.onPartial?.(text)
  }

  const onSpeechResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim() || lastPartial.trim()
    lastPartial = ''
    if (text) handlers.onFinal?.(text)
  }

  const onSpeechError = (event: SpeechErrorEvent) => {
    const code = String(event.error?.code ?? '')
    const message = String(event.error?.message ?? 'Speech recognition error')
    // 6 = recognizer busy, 7 = no match — both recoverable via restart.
    if (code.includes('7') || /no.?speech|no.?match/i.test(message)) return
    if (code.includes('6') || /busy|recognizer/i.test(message)) return
    if (/permission|not.?authorized|denied/i.test(message)) {
      shouldRestart = false
      handlers.onError?.('Microphone access is required for live captions')
      return
    }
    // Soft — keep viewing remote captions; restart will retry.
    handlers.onError?.('Live captions paused — retrying…')
  }

  const restartSoon = () => {
    if (!shouldRestart || starting) return
    starting = true
    const delay = Platform.OS === 'android' ? 350 : 220
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
              // Viewing remote captions still works — avoid a permanent scary banner.
              handlers.onError?.(
                'Could not listen on this device — you can still view others’ captions',
              )
            })
          }, 900)
        })
        .finally(() => {
          starting = false
        })
    }, delay)
  }

  const onSpeechEnd = () => {
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
      lastPartial = ''
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
