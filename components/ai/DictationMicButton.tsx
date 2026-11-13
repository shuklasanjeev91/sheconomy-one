import { useId, useRef } from 'react'
import { Platform } from 'react-native'

import { Icons, XStack } from '~/components/ui'
import { AI_NAME } from '~/config/brand'
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
  const dictation = useDictationOptional()
  const bindId = useId()
  const valueRef = useRef(bindValue ?? '')
  const onChangeRef = useRef(bindOnChangeText)
  valueRef.current = bindValue ?? ''
  onChangeRef.current = bindOnChangeText
  if (!dictation?.supported) return null

  const listening = dictation.listening
  const blocked = Boolean(disabled)

  const onPress = () => {
    if (blocked) return
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
      backgroundColor={listening ? ui.brand : ui.surfaceMuted}
      opacity={blocked ? 0.45 : 1}
      cursor={blocked ? 'default' : 'pointer'}
      hoverStyle={blocked ? undefined : { opacity: 0.9 }}
      pressStyle={blocked ? undefined : { scale: 0.94 }}
      onPress={onPress}
      aria-label={listening ? `Stop ${AI_NAME} dictation` : `Start ${AI_NAME} dictation`}
      {...(Platform.OS === 'web'
        ? { role: 'button' as const }
        : {
            accessibilityRole: 'button' as const,
            accessibilityState: { disabled: blocked, selected: listening },
          })}
    >
      {listening ? (
        <Icons.MicOff size={Math.round(size * 0.4)} color="#fff" />
      ) : (
        <Icons.Mic size={Math.round(size * 0.4)} color={ui.text} />
      )}
    </XStack>
  )
}
