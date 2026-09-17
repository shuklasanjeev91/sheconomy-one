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

export async function createNativeSpeechSession(
  handlers: NativeSpeechHandlers,
): Promise<NativeSpeechSession | null> {
  if (!isNativeRuntime()) return null

  try {
    const available = await Voice.isAvailable()
    if (!available) return null
  } catch {
    return null
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
    handlers.onError?.('Live captions paused — retrying…')
  }

  const restartSoon = () => {
    if (!shouldRestart || starting) return
    starting = true
    const delay = Platform.OS === 'android' ? 280 : 120
    setTimeout(() => {
      if (!shouldRestart) {
        starting = false
        return
      }
      void Voice.start(locale)
        .catch(() => {
          shouldRestart = false
          handlers.onError?.('Could not restart live captions')
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
        await Voice.stop()
      } catch {
        // ignore — may not be running yet
      }
      await Voice.start(locale)
    },
    async stop() {
      shouldRestart = false
      try {
        await Voice.stop()
      } catch {
        // ignore
      }
    },
    async destroy() {
      shouldRestart = false
      try {
        await Voice.stop()
      } catch {
        // ignore
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
