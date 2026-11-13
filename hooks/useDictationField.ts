import { useCallback, useId, useRef } from 'react'

import { useDictationOptional } from '~/providers/dictation-context'

type FocusEventLike = { nativeEvent?: unknown } | unknown

type UseDictationFieldOptions = {
  value?: unknown
  onChangeText?: (text: string) => void
  onFocus?: (event: FocusEventLike) => void
  onBlur?: (event: FocusEventLike) => void
  /** Skip password / OTP / disabled fields. */
  secureTextEntry?: boolean
  editable?: boolean
  disabled?: boolean
  /** Opt out per field (default: register). */
  dictation?: boolean
}

/**
 * Registers a controlled text field as the live dictation target on focus.
 */
export function useDictationField(options: UseDictationFieldOptions) {
  const {
    value,
    onChangeText,
    onFocus,
    onBlur,
    secureTextEntry,
    editable,
    disabled,
    dictation = true,
  } = options

  const dictationCtx = useDictationOptional()
  const reactId = useId()
  const idRef = useRef(`dictation-${reactId}`)
  const valueRef = useRef(value != null ? String(value) : '')
  const onChangeRef = useRef(onChangeText)
  valueRef.current = value != null ? String(value) : ''
  onChangeRef.current = onChangeText

  const canRegister =
    Boolean(dictationCtx) &&
    dictation !== false &&
    !secureTextEntry &&
    editable !== false &&
    !disabled &&
    typeof onChangeText === 'function'

  const handleFocus = useCallback(
    (event: FocusEventLike) => {
      if (canRegister && dictationCtx) {
        dictationCtx.focusTarget({
          id: idRef.current,
          getValue: () => valueRef.current,
          setValue: (text) => {
            valueRef.current = text
            onChangeRef.current?.(text)
          },
        })
      }
      onFocus?.(event)
    },
    [canRegister, dictationCtx, onFocus],
  )

  const handleBlur = useCallback(
    (event: FocusEventLike) => {
      if (canRegister && dictationCtx) {
        dictationCtx.blurTarget(idRef.current)
      }
      onBlur?.(event)
    },
    [canRegister, dictationCtx, onBlur],
  )

  return {
    onFocus: handleFocus,
    onBlur: handleBlur,
  }
}
