import { useCallback, useEffect, useRef } from 'react'
import { Platform, Pressable, StyleSheet, TextInput } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { Text, XStack, YStack } from '~/components/ui'
import { isCompleteOtp, normalizeOtpDigits } from '~/features/auth/validation'
import { useAppUi } from '~/lib/theme/useAppUi'

type OtpCodeInputProps = {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  accessibilityLabel?: string
}

/**
 * Segmented OTP field with a single real TextInput overlay:
 * - Paste fills the full code (maxLength is NOT applied on the input —
 *   length is enforced after digit normalization so "Code: 123456" pastes work)
 * - iOS: textContentType="oneTimeCode" for SMS keyboard suggestions
 * - Android: autoComplete="sms-otp"
 * - Clipboard: on focus, if clipboard holds a complete OTP, auto-fill it
 */
export function OtpCodeInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  accessibilityLabel = 'One-time verification code',
}: OtpCodeInputProps) {
  const ui = useAppUi()
  const inputRef = useRef<TextInput | null>(null)
  const digits = normalizeOtpDigits(value, length)
  const activeIndex = Math.min(digits.length, length - 1)
  const lastClipboardCodeRef = useRef<string | null>(null)

  const applyCode = useCallback(
    (raw: string) => {
      const next = normalizeOtpDigits(raw, length)
      if (next !== digits) onChange(next)
    },
    [digits, length, onChange],
  )

  const tryClipboardAutofill = useCallback(async () => {
    // Only auto-fill when the field is empty so typing is never overwritten.
    if (disabled || digits.length > 0) return
    try {
      const hasString =
        typeof Clipboard.hasStringAsync === 'function'
          ? await Clipboard.hasStringAsync()
          : true
      if (!hasString) return

      const clip = await Clipboard.getStringAsync()
      const code = normalizeOtpDigits(clip ?? '', length)
      if (!isCompleteOtp(code, length)) return
      if (lastClipboardCodeRef.current === code) return
      lastClipboardCodeRef.current = code
      onChange(code)
    } catch {
      // Clipboard access can fail (permissions / web); paste still works manually.
    }
  }, [digits, disabled, length, onChange])

  useEffect(() => {
    if (disabled || !autoFocus) return
    const timer = setTimeout(() => {
      void tryClipboardAutofill()
    }, 350)
    return () => clearTimeout(timer)
  }, [autoFocus, disabled, tryClipboardAutofill])

  function focusInput() {
    if (disabled) return
    inputRef.current?.focus()
    void tryClipboardAutofill()
  }

  return (
    <Pressable
      onPress={focusInput}
      disabled={disabled}
      accessibilityRole="none"
      style={styles.wrap}
    >
      <XStack gap="$2" width="100%" justifyContent="space-between" pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const char = digits[index] ?? ''
          const isActive = !disabled && index === activeIndex
          return (
            <YStack
              key={index}
              flex={1}
              maxWidth={52}
              height={56}
              borderRadius={12}
              borderWidth={1.5}
              borderColor={invalid ? ui.error : isActive ? ui.brand : ui.borderSubtle}
              backgroundColor={ui.surface}
              alignItems="center"
              justifyContent="center"
              animation="quick"
            >
              <Text
                fontSize={22}
                fontWeight="700"
                color={char ? ui.text : 'transparent'}
                letterSpacing={0}
              >
                {char || '0'}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={applyCode}
        onFocus={() => {
          void tryClipboardAutofill()
        }}
        keyboardType="number-pad"
        // Intentionally no maxLength — paste of "Your code is 123456" must reach onChangeText.
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        editable={!disabled}
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden={false}
        selectTextOnFocus={false}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Enter or paste the six digit code from your SMS or email"
        style={[
          styles.hiddenInput,
          Platform.OS === 'web' ? (styles.hiddenInputWeb as object) : null,
        ]}
        {...(Platform.OS === 'web'
          ? ({
              inputMode: 'numeric',
              autoComplete: 'one-time-code',
            } as object)
          : {})}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    position: 'relative',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
    fontSize: 22,
    letterSpacing: 24,
    zIndex: 2,
  },
  hiddenInputWeb: {
    caretColor: 'transparent',
    outlineStyle: 'none',
  },
})
