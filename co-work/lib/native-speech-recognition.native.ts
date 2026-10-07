import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice'
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native'

import {
  isLikelyCaptionFragment,
  mergeCaptionHypothesis,
} from '~/co-work/lib/caption-utterance'
import { setCallAudioSpeechShare } from '~/co-work/lib/call-audio'
import { speechRecognitionLocaleFallbacks } from '~/co-work/lib/call-audio-options'
import { isNativeRuntime } from '~/lib/platform/capabilities'
import CallAudio, { type CaptionSpeechEvent } from '~/modules/call-audio'

import type {
  NativeSpeechHandlers,
  NativeSpeechSession,
  NativeSpeechSessionOptions,
} from '~/co-work/lib/native-speech-recognition'

export function isNativeSpeechRecognitionAvailable() {
  return isNativeRuntime()
}

async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone for your captions',
        message:
          'Allow this only when you want SHEconomy to caption your own speech. You can still view others’ captions while muted.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    )
    return granted === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

/** Keep the recognizer open longer so multi-word sentences survive call mic contention. */
type LiveCaptionSpeechModule = {
  start: (locale: string) => Promise<string>
  stop: () => Promise<void>
}

const liveCaptionSpeech = NativeModules.LiveCaptionSpeech as LiveCaptionSpeechModule | undefined

function usesCallAudioCaptions(shareCallMic: boolean) {
  return shareCallMic && Platform.OS === 'ios' && typeof liveCaptionSpeech?.start === 'function'
}

const ANDROID_VOICE_OPTIONS = {
  EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
  EXTRA_MAX_RESULTS: 5,
  EXTRA_PARTIAL_RESULTS: true,
  REQUEST_PERMISSIONS_AUTO: true,
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

// SpeechRecognizer.ERROR_* codes.
const ANDROID_NO_SPEECH_ERRORS = new Set([6, 7])
const ANDROID_PERMISSION_ERROR = 9
const ANDROID_LANGUAGE_ERRORS = new Set([12, 13])

function hasAndroidCaptionSpeech() {
  return Platform.OS === 'android' && typeof CallAudio?.startCaptionSpeech === 'function'
}

/**
 * Android captions through the CallAudio module: the recognizer reads the
 * call's own mic audio, so it never fights WebRTC for the microphone.
 */
function createAndroidCaptionSession(
  handlers: NativeSpeechHandlers,
  shareCallMic: boolean,
): NativeSpeechSession {
  const native = CallAudio!
  let shouldRun = false
  let running = false
  let locale = 'en-US'
  let utterance = ''
  let failures = 0
  let sharingMic = false
  let finalizeTimer: ReturnType<typeof setTimeout> | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (finalizeTimer) clearTimeout(finalizeTimer)
    if (restartTimer) clearTimeout(restartTimer)
    finalizeTimer = null
    restartTimer = null
  }

  const commit = () => {
    if (finalizeTimer) clearTimeout(finalizeTimer)
    finalizeTimer = null
    const text = utterance.trim()
    utterance = ''
    if (text) handlers.onFinal?.(text)
  }

  const scheduleRestart = () => {
    if (!shouldRun || running || restartTimer) return
    const delay = Math.min(3000, 120 + failures * 450)
    restartTimer = setTimeout(() => {
      restartTimer = null
      void begin()
    }, delay)
  }

  const begin = async () => {
    if (!shouldRun || running) return
    running = true
    try {
      const mode = await native.startCaptionSpeech!(locale)
      // Only the direct-mic fallback needs the call to relax its audio focus.
      if (mode === 'mic' && shareCallMic && !sharingMic) {
        sharingMic = true
        await setCallAudioSpeechShare('share')
      }
    } catch (error) {
      running = false
      failures += 1
      const message = error instanceof Error ? error.message : String(error)
      if (/unavailable/i.test(message)) {
        shouldRun = false
        handlers.onError?.(
          'Speech recognition is unavailable on this device. You can still view others’ captions.',
        )
        return
      }
      scheduleRestart()
    }
  }

  const onEvent = (event: CaptionSpeechEvent) => {
    if (!shouldRun) return
    const text = event.text?.trim() ?? ''
    switch (event.type) {
      case 'partial': {
        failures = 0
        if (finalizeTimer) clearTimeout(finalizeTimer)
        finalizeTimer = null
        utterance = mergeCaptionHypothesis(utterance, text)
        if (utterance) handlers.onPartial?.(utterance)
        return
      }
      case 'final': {
        failures = 0
        utterance = mergeCaptionHypothesis(utterance, text)
        if (!utterance) return
        handlers.onPartial?.(utterance)
        // Android ends a pass after every short pause; let the next pass extend a fragment.
        if (finalizeTimer) clearTimeout(finalizeTimer)
        finalizeTimer = setTimeout(commit, isLikelyCaptionFragment(utterance) ? 1400 : 500)
        return
      }
      case 'error': {
        const code = event.code ?? -1
        if (code === ANDROID_PERMISSION_ERROR) {
          shouldRun = false
          handlers.onError?.(
            'Microphone access is only needed to caption your speech. You can still view others’ captions.',
          )
          return
        }
        if (ANDROID_LANGUAGE_ERRORS.has(code)) {
          handlers.onError?.(
            'Speech recognition is unavailable for this language. You can still view others’ captions.',
          )
        }
        if (!ANDROID_NO_SPEECH_ERRORS.has(code)) failures += 1
        return
      }
      case 'idle': {
        running = false
        handlers.onEnd?.()
        scheduleRestart()
        return
      }
      default:
        return
    }
  }

  const subscription = native.addListener('onCaptionSpeech', onEvent)

  const halt = async (cancel: boolean) => {
    shouldRun = false
    running = false
    clearTimers()
    if (utterance.trim()) commit()
    try {
      await (cancel ? native.cancelCaptionSpeech?.() : native.stopCaptionSpeech?.())
    } catch {
      // Recognizer may already be gone.
    }
    if (sharingMic) {
      sharingMic = false
      await setCallAudioSpeechShare('off')
    }
  }

  return {
    async start(nextLocale: string) {
      locale = nextLocale || 'en-US'
      shouldRun = true
      failures = 0
      utterance = ''
      clearTimers()
      await begin()
    },
    stop: () => halt(false),
    async destroy() {
      await halt(true)
      subscription.remove()
    },
  }
}

async function cancelVoiceQuietly() {
  try {
    await Voice.cancel()
  } catch {
    try {
      await Voice.stop()
    } catch {
      // ignore — may not be running yet
    }
  }
}

export async function createNativeSpeechSession(
  handlers: NativeSpeechHandlers,
  options?: NativeSpeechSessionOptions,
): Promise<NativeSpeechSession | null> {
  if (!isNativeRuntime()) return null

  const shareCallMic = options?.shareCallMic === true

  const micOk = await ensureMicrophonePermission()
  if (!micOk) {
    handlers.onError?.(
      'Microphone access is only needed to caption your speech. You can still view others’ captions.',
    )
    return null
  }

  if (hasAndroidCaptionSpeech()) {
    return createAndroidCaptionSession(handlers, shareCallMic)
  }

  // Do not hard-fail on Voice.isAvailable() — on iOS it often returns false until
  // speech permission is granted / while WebRTC holds the audio session. Try start.
  try {
    await Voice.isAvailable().catch(() => null)
  } catch {
    // continue — start() still prompts for permission
  }

  let shouldRestart = false
  let locale = 'en-US'
  let starting = false
  let listening = false
  let compatShare = false
  /** Growing hypothesis for the current spoken utterance. */
  let utterance = ''
  let finalizeTimer: ReturnType<typeof setTimeout> | null = null
  let watchdog: ReturnType<typeof setInterval> | null = null
  let retryAttempt = 0
  const callAudio = usesCallAudioCaptions(shareCallMic)
  let callAudioSubs: Array<{ remove: () => void }> = []

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

  const applySpeechShare = async (forceCompat: boolean) => {
    if (!shareCallMic) return
    compatShare = compatShare || forceCompat
    await setCallAudioSpeechShare(compatShare ? 'compat' : 'share')
  }

  const stopCallAudio = async () => {
    if (!callAudio || !liveCaptionSpeech) return
    try {
      await liveCaptionSpeech.stop()
    } catch {
      // ignore — may not be running yet
    }
  }

  const beginListening = async () => {
    if (callAudio && liveCaptionSpeech) {
      // Do not switch the call into speech-share mode. That drops videoChat
      // echo cancellation. iOS captions tap the WebRTC mic instead.
      if (callAudioSubs.length === 0) {
        const emitter = new NativeEventEmitter(NativeModules.LiveCaptionSpeech)
        callAudioSubs = [
          emitter.addListener('LiveCaptionPartial', (event: { text?: string }) => {
            onSpeechPartialResults({ value: event?.text ? [event.text] : [] })
          }),
          emitter.addListener('LiveCaptionFinal', (event: { text?: string }) => {
            onSpeechResults({ value: event?.text ? [event.text] : [] })
          }),
          emitter.addListener('LiveCaptionError', (event: { message?: string }) => {
            onSpeechError({ error: { code: 'call-audio', message: event?.message ?? 'Speech recognition error' } })
          }),
        ]
      }
      try {
        const used = await liveCaptionSpeech.start(locale || 'en-US')
        if (used) locale = used
        listening = true
        retryAttempt = 0
        return true
      } catch {
        listening = false
        return false
      }
    }

    await cancelVoiceQuietly()
    await applySpeechShare(compatShare)
    await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? 280 : 360))
    try {
      const used = await startVoiceWithFallback(speechRecognitionLocaleFallbacks(locale))
      locale = used
      listening = true
      retryAttempt = 0
      return true
    } catch {
      listening = false
      if (shareCallMic && Platform.OS === 'android' && !compatShare) {
        compatShare = true
        await applySpeechShare(true)
        await new Promise((resolve) => setTimeout(resolve, 420))
        try {
          const used = await startVoiceWithFallback(speechRecognitionLocaleFallbacks(locale))
          locale = used
          listening = true
          retryAttempt = 0
          return true
        } catch {
          listening = false
        }
      }
      return false
    }
  }

  const onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (!text) return
    listening = true
    retryAttempt = 0
    clearFinalizeTimer()
    emitPartial(text)
  }

  const onSpeechResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (!text && !utterance) return
    listening = true
    retryAttempt = 0
    clearFinalizeTimer()
    if (text) emitPartial(text)
    // Android often fires results after every short pause with 1–2 words.
    // iOS call-audio recognition also finalizes the first word ("hello")
    // while the rest of the sentence is still being spoken — keep accumulating.
    if (callAudio || (Platform.OS === 'android' && isLikelyCaptionFragment(utterance))) {
      scheduleFinalize(callAudio ? 1600 : 1400)
      return
    }
    scheduleFinalize(Platform.OS === 'android' ? 900 : 350)
  }

  const restartSoon = (delayMs?: number) => {
    if (!shouldRestart || starting || listening) return
    starting = true
    const delay =
      delayMs ??
      Math.min(2800, (Platform.OS === 'android' ? 320 : 220) + retryAttempt * 400)
    setTimeout(() => {
      if (!shouldRestart) {
        starting = false
        return
      }
      void beginListening()
        .then((ok) => {
          if (!ok) retryAttempt += 1
        })
        .finally(() => {
          starting = false
        })
    }, delay)
  }

  const onSpeechError = (event: SpeechErrorEvent) => {
    const code = String(event.error?.code ?? '')
    const message = String(event.error?.message ?? 'Speech recognition error')
    // Call-audio captions reopen the recognizer natively. Don't tear the session down.
    if (code === 'call-audio') {
      listening = true
      return
    }
    listening = false
    // Android reports 6 for speech timeout and 7 for no match; both need a restart.
    if (code === '6' || code === '7' || /no.?speech|no.?match/i.test(message)) {
      restartSoon()
      return
    }
    if (/permission|not.?authorized|denied/i.test(message) && !/insufficient/i.test(message)) {
      shouldRestart = false
      clearFinalizeTimer()
      handlers.onError?.(
        'Microphone access is only needed to caption your speech. You can still view others’ captions.',
      )
      return
    }
    // 5 client / 8 busy / 9 insufficient (mic held by WebRTC) — free focus and retry.
    if (
      shareCallMic &&
      Platform.OS === 'android' &&
      (code.includes('5') ||
        code.includes('8') ||
        code.includes('9') ||
        /busy|client|insufficient|audio/i.test(message))
    ) {
      compatShare = true
    }
    restartSoon()
  }

  const onSpeechEnd = () => {
    listening = false
    // Flush whatever we heard before the recognizer restarts.
    if (utterance.trim()) {
      commitUtterance(true)
    }
    handlers.onEnd?.()
    restartSoon()
  }

  Voice.onSpeechStart = () => {
    listening = true
    retryAttempt = 0
  }
  Voice.onSpeechPartialResults = onSpeechPartialResults
  Voice.onSpeechResults = onSpeechResults
  Voice.onSpeechError = onSpeechError
  Voice.onSpeechEnd = onSpeechEnd

  const clearWatchdog = () => {
    if (!watchdog) return
    clearInterval(watchdog)
    watchdog = null
  }

  return {
    async start(nextLocale: string) {
      locale = nextLocale || 'en-US'
      shouldRestart = true
      utterance = ''
      retryAttempt = 0
      clearFinalizeTimer()
      if (shareCallMic) {
        await applySpeechShare(false)
      }
      const started = await beginListening()
      clearWatchdog()
      watchdog = setInterval(() => {
        if (!shouldRestart || starting || listening) return
        restartSoon(160)
      }, 3500)
      if (started) return
      restartSoon(480)
    },
    async stop() {
      shouldRestart = false
      listening = false
      clearWatchdog()
      clearFinalizeTimer()
      if (utterance.trim()) commitUtterance(true)
      if (callAudio) {
        await stopCallAudio()
      } else {
        await cancelVoiceQuietly()
      }
      if (shareCallMic) {
        await setCallAudioSpeechShare('off')
      }
    },
    async destroy() {
      shouldRestart = false
      listening = false
      clearWatchdog()
      clearFinalizeTimer()
      utterance = ''
      for (const sub of callAudioSubs) sub.remove()
      callAudioSubs = []
      if (callAudio) {
        await stopCallAudio()
      } else {
        await cancelVoiceQuietly()
        try {
          await Voice.destroy()
        } catch {
          // ignore
        }
        Voice.removeAllListeners()
      }
      if (shareCallMic) {
        await setCallAudioSpeechShare('off')
      }
    },
  }
}
