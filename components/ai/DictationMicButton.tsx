import { useId, useRef } from 'react'
import { Platform } from 'react-native'

import { Icons, XStack, useAppToast } from '~/components/ui'
import { AI_NAME } from '~/config/brand'
import { isContinuousDictationAvailable } from '~/hooks/useContinuousDictation'
import { useDictationOptional } from '~/providers/dictation-context'
import { useAppUi } from '~/lib/theme/useAppUi'

type DictationMicButtonProps = {
  size?: number
  /** Disable while the host control is busy (e.g. SHERPA sending). */
  disabled?: boolean
  /**
   * Prefer this field when starting dictation (SHERPA composer).
   * Live updates still follow whichever Input is focused.
   */
  bindValue?: string
  bindOnChangeText?: (text: string) => void
}

/** Toggle continuous SHERPA dictation for the focused text field. */
export function DictationMicButton({
  size = 40,
  disabled,
  bindValue,
  bindOnChangeText,
}: DictationMicButtonProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const dictation = useDictationOptional()
  const bindId = useId()
  const valueRef = useRef(bindValue ?? '')
  const onChangeRef = useRef(bindOnChangeText)
  valueRef.current = bindValue ?? ''
  onChangeRef.current = bindOnChangeText

  const platformSupports = isContinuousDictationAvailable()
  const listening = Boolean(dictation?.listening)
  const blocked = Boolean(disabled)

  // Always show the control when the platform can do STT — even if the
  // provider is missing we toast instead of rendering nothing (SHERPA sheet).
  if (!platformSupports && !dictation?.supported) return null

  const onPress = () => {
    if (blocked) return
    if (!dictation) {
      toast.show(`${AI_NAME} dictation`, {
        tone: 'danger',
        message: 'Voice typing is not available right now. Refresh and try again.',
      })
      return
    }
    if (!dictation.supported) {
      toast.show(`${AI_NAME} dictation`, {
        tone: 'danger',
        message: 'Voice typing needs microphone permission (Chrome, Edge, or Safari).',
      })
      return
    }
    if (!listening && onChangeRef.current) {
      dictation.focusTarget({
        id: `dictation-bind-${bindId}`,
        getValue: () => valueRef.current,
        setValue: (text) => {
          valueRef.current = text
          onChangeRef.current?.(text)
        },
      })
    }
    void dictation.toggle()
  }

  return (
    <XStack
      width={size}
      height={size}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      backgroundColor={listening ? ui.brand : 'transparent'}
      opacity={blocked ? 0.45 : 1}
      cursor={blocked ? 'default' : 'pointer'}
      hoverStyle={blocked ? undefined : { backgroundColor: ui.surfaceMuted }}
      pressStyle={blocked ? undefined : { scale: 0.94 }}
      onPress={onPress}
      aria-label={listening ? `Stop ${AI_NAME} dictation` : `Speak with ${AI_NAME}`}
      {...(Platform.OS === 'web'
        ? { role: 'button' as const }
        : {
            accessibilityRole: 'button' as const,
            accessibilityState: { disabled: blocked, selected: listening },
          })}
    >
      {listening ? (
        <Icons.MicOff size={Math.round(size * 0.45)} color="#fff" />
      ) : (
        <Icons.Mic size={Math.round(size * 0.45)} color={ui.brand} />
      )}
    </XStack>
  )
}
