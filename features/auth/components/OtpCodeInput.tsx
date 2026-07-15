import { useRef } from 'react'
import { Platform } from 'react-native'

import { Input, Text, XStack, YStack } from '~/components/ui'
import { normalizeOtpDigits } from '~/features/auth/validation'
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
 * Segmented 6-digit OTP field:
 * - Visual digit boxes with a single invisible caret input (autofill-friendly)
 * - Paste fills the full code
 * - Web: autocomplete="one-time-code"
 * - iOS: textContentType="oneTimeCode"
 * - Android: autoComplete="sms-otp" (no READ_SMS)
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
  const inputRef = useRef<{ focus?: () => void } | null>(null)
  const digits = normalizeOtpDigits(value, length)
  const activeIndex = Math.min(digits.length, length - 1)

  function focusInput() {
    if (disabled) return
    inputRef.current?.focus?.()
  }

  return (
    <YStack width="100%" position="relative" onPress={focusInput} cursor={disabled ? 'default' : 'text'}>
      <XStack gap="$2" width="100%" justifyContent="space-between">
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

      <Input
        ref={inputRef as never}
        value={digits}
        onChangeText={(text) => onChange(normalizeOtpDigits(text, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        // @ts-expect-error RN iOS prop
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        invalid={invalid}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Enter the six digit code from your SMS or email"
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity={0.02}
        color="transparent"
        backgroundColor="transparent"
        borderWidth={0}
        {...(Platform.OS === 'web'
          ? ({
              inputMode: 'numeric',
              autoComplete: 'one-time-code',
              maxLength: length,
              style: {
                position: 'absolute',
                inset: 0,
                opacity: 0.02,
                color: 'transparent',
                caretColor: 'transparent',
              },
            } as object)
          : {})}
      />
    </YStack>
  )
}
