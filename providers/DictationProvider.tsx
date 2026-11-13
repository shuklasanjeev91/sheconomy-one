import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DictationFab } from '~/components/ai/DictationFab'
import { Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { AI_NAME } from '~/config/brand'
import { useContinuousDictation } from '~/hooks/useContinuousDictation'
import {
  appendTranscript,
  withInterimTranscript,
} from '~/lib/dictation/append-transcript'
import { useOptionalRegionPreferences } from '~/lib/locale'
import { speechRecognitionLocale } from '~/co-work/lib/caption-translate'
import { useAppUi } from '~/lib/theme/useAppUi'

import {
  DictationContext,
  type DictationContextValue,
  type DictationTarget,
} from '~/providers/dictation-context'

/**
 * App-wide SHERPA dictation: speak once mic is on, and text is typed into the
 * focused Input / TextArea in real time (interim + final).
 */
export function DictationProvider({ children }: { children: ReactNode }) {
  const toast = useAppToast()
  const ui = useAppUi()
  const insets = useSafeAreaInsets()
  const region = useOptionalRegionPreferences()
  const locale = speechRecognitionLocale(
    (region?.languageCode || 'en').toLowerCase(),
    region?.countryCode || 'IN',
  )

  const targetRef = useRef<DictationTarget | null>(null)
  const committedBaseRef = useRef('')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [interim, setInterim] = useState('')

  const applyPartial = useCallback((text: string) => {
    const target = targetRef.current
    if (!target || target.secure) return
    setInterim(text)
    target.setValue(withInterimTranscript(committedBaseRef.current, text))
  }, [])

  const applyFinal = useCallback((text: string) => {
    const target = targetRef.current
    if (!target || target.secure) return
    const next = appendTranscript(committedBaseRef.current, text)
    committedBaseRef.current = next
    setInterim('')
    target.setValue(next)
  }, [])

  const speech = useContinuousDictation({
    locale,
    onPartial: applyPartial,
    onFinal: applyFinal,
  })

  const focusTarget = useCallback((target: DictationTarget) => {
    if (target.secure) return
    targetRef.current = target
    committedBaseRef.current = target.getValue()
    setFocusedId(target.id)
    setInterim('')
  }, [])

  const blurTarget = useCallback((id: string) => {
    if (targetRef.current?.id !== id) return
    // Keep last target so speech can continue if the user briefly blurs;
    // clear interim display only.
    setInterim('')
  }, [])

  const start = useCallback(async () => {
    if (!targetRef.current) {
      toast.show(`${AI_NAME} dictation`, {
        message: 'Tap a text field, then speak — words appear as you talk.',
      })
    } else {
      committedBaseRef.current = targetRef.current.getValue()
    }
    await speech.start()
  }, [speech, toast])

  const stop = useCallback(async () => {
    setInterim('')
    await speech.stop()
  }, [speech])

  const toggle = useCallback(async () => {
    if (speech.listening) await stop()
    else await start()
  }, [speech.listening, start, stop])

  useEffect(() => {
    if (!speech.error) return
    toast.show(`${AI_NAME} dictation`, { tone: 'danger', message: speech.error })
    speech.clearError()
  }, [speech.error, speech.clearError, toast])

  const value = useMemo<DictationContextValue>(
    () => ({
      supported: speech.supported,
      listening: speech.listening,
      error: speech.error,
      interim,
      focusedId,
      start,
      stop,
      toggle,
      clearError: speech.clearError,
      focusTarget,
      blurTarget,
    }),
    [
      speech.supported,
      speech.listening,
      speech.error,
      speech.clearError,
      interim,
      focusedId,
      start,
      stop,
      toggle,
      focusTarget,
      blurTarget,
    ],
  )

  return (
    <DictationContext.Provider value={value}>
      <YStack flex={1} width="100%" position="relative">
        {children}
        <DictationFab />
        {speech.supported && speech.listening ? (
          <XStack
            position="absolute"
            left={16}
            right={16}
            bottom={Math.max(insets.bottom, 12) + 56}
            zIndex={1200}
            alignItems="center"
            justifyContent="center"
            pointerEvents="box-none"
          >
            <XStack
              alignItems="center"
              gap="$2"
              paddingHorizontal={14}
              paddingVertical={10}
              borderRadius={999}
              backgroundColor={ui.brand}
              shadowColor="#000"
              shadowOpacity={0.2}
              shadowRadius={10}
              shadowOffset={{ width: 0, height: 4 }}
              {...(Platform.OS === 'android' ? { elevation: 6 } : null)}
              onPress={() => void stop()}
              cursor="pointer"
              pressStyle={{ opacity: 0.9 }}
              aria-label="Stop dictation"
              {...(Platform.OS === 'web'
                ? { role: 'button' as const }
                : { accessibilityRole: 'button' as const })}
            >
              <Icons.Mic size={16} color="#fff" />
              <Text fontSize={13} fontWeight="600" color="#fff" numberOfLines={1}>
                {interim.trim()
                  ? interim.trim()
                  : focusedId
                    ? `${AI_NAME} is typing…`
                    : `Speak — tap a field for ${AI_NAME}`}
              </Text>
              <Icons.MicOff size={14} color="#fff" opacity={0.85} />
            </XStack>
          </XStack>
        ) : null}
      </YStack>
    </DictationContext.Provider>
  )
}
