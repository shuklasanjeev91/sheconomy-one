import { Platform } from 'react-native'

import { Input } from '~/components/ui'
import { normalizeOtpDigits } from '~/features/auth/validation'

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
 * Six-digit OTP field:
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
  return (
    <Input
      value={normalizeOtpDigits(value, length)}
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
      textAlign="center"
      fontSize={22}
      fontWeight="700"
      letterSpacing={8}
      placeholder={'0'.repeat(length)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Enter the six digit code from your SMS or email"
      {...(Platform.OS === 'web'
        ? ({
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            maxLength: length,
          } as object)
        : {})}
    />
  )
}
