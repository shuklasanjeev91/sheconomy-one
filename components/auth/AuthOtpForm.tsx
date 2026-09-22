import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Keyboard, Platform, View } from 'react-native'

import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { AuthStepProgress } from '~/components/auth/AuthMethodTabs'
import { AppTextField } from '~/components/forms/AppTextField'
import { PhoneInput } from '~/components/forms/PhoneInput'
import {
  Button,
  Field,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { OtpCodeInput } from '~/features/auth/components/OtpCodeInput'
import { useOtpAutofill } from '~/features/auth/hooks/useOtpAutofill'
import { sendAuthOtp, verifyAuthOtp } from '~/features/auth/services/auth-otp'
import {
  isCompleteOtp,
  normalizeOtpDigits,
  validateEmailAddress,
} from '~/features/auth/validation'
import { useFormValidation } from '~/hooks/useFormValidation'
import {
  isDeviceEmailHintSupported,
  requestDeviceEmailHint,
} from '~/lib/platform/email-hint'
import { isPhoneHintSupported, requestPhoneNumberHint } from '~/lib/platform/phone-hint'
import { DEFAULT_COUNTRY } from '~/lib/phone/countries'
import {
  formatPhoneForDisplay,
  isValidPhone,
  normalizePhoneNumber,
  parseE164Phone,
} from '~/lib/phone/phone'
import { getSession, type OtpChannel } from '~/lib/supabase/auth'
import { email, otp, required } from '~/lib/validation'
import { useAppUi } from '~/lib/theme/useAppUi'

const RESEND_COOLDOWN_SECONDS = 30
const OTP_LENGTH = 6

type AuthOtpFormProps = {
  channel: OtpChannel
  onSuccess?: (meta: { isNewUser: boolean }) => void
}

/** Passwordless OTP sign-in — email or SMS, cross-platform with autofill. */
export function AuthOtpForm({ channel, onSuccess }: AuthOtpFormProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [otpSent, setOtpSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const verifyingRef = useRef(false)
  const lastAutoSubmitRef = useRef<string | null>(null)

  const isEmail = channel === 'email'

  const schema = useMemo(
    () => ({
      identifier: {
        initialValue: '',
        validators: isEmail
          ? [required('Enter your email address.'), email()]
          : [
              required('Enter your mobile number.'),
              (value: string) =>
                isValidPhone(value.trim()) ? null : 'Enter a valid mobile number.',
            ],
      },
      otpCode: {
        initialValue: '',
        validators: [
          required('Enter the verification code we sent you.'),
          otp(OTP_LENGTH, OTP_LENGTH, 'Enter the 6-digit verification code.'),
        ],
      },
    }),
    [isEmail],
  )

  const form = useFormValidation(schema)

  useEffect(() => {
    form.resetAll()
    setOtpSent(false)
    setApiError(null)
    setResendIn(0)
    verifyingRef.current = false
  }, [channel])

  // Prefill email from device Google account (silent) when available.
  useEffect(() => {
    if (!isEmail || otpSent || !isDeviceEmailHintSupported()) return
    let cancelled = false
    void requestDeviceEmailHint({ interactive: false }).then((result) => {
      if (cancelled || !result.email) return
      if (form.fields.identifier.value.trim()) return
      form.fields.identifier.onChange(result.email)
    })
    return () => {
      cancelled = true
    }
  }, [isEmail, otpSent])

  function applyPhoneHint(raw: string) {
    const normalized = normalizePhoneNumber(raw, DEFAULT_COUNTRY)
    const parsed = parseE164Phone(normalized)
    const next = parsed
      ? `${parsed.country.dialCode}${parsed.nationalNumber}`
      : normalized && isValidPhone(normalized)
        ? normalized
        : null
    if (!next) return false
    form.fields.identifier.onChange(next)
    setApiError(null)
    return true
  }

  async function fillPhoneFromDevice() {
    setApiError(null)
    Keyboard.dismiss()
    const result = await requestPhoneNumberHint()
    if (result.phoneNumber && applyPhoneHint(result.phoneNumber)) {
      toast.show('Number added', { tone: 'success', message: 'Ready to send your code.' })
      return
    }
    if (result.error) {
      toast.show(result.error, { tone: 'danger' })
      return
    }
    toast.show('No number selected', {
      tone: 'warning',
      message: 'Pick a number from the list, or type it below.',
    })
  }

  async function fillEmailFromDevice() {
    setApiError(null)
    const result = await requestDeviceEmailHint({ interactive: true })
    if (result.email) {
      form.fields.identifier.onChange(result.email)
      return
    }
    if (result.error) {
      toast.show(result.error, { tone: 'danger' })
    }
  }

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  function resolveIdentifier() {
    if (isEmail) {
      const err = validateEmailAddress(form.fields.identifier.value)
      if (err) {
        form.fields.identifier.touch()
        form.fields.identifier.validate()
        return null
      }
      return form.fields.identifier.value.trim().toLowerCase()
    }
    const e164 = form.fields.identifier.value.trim()
    if (!isValidPhone(e164)) {
      form.fields.identifier.touch()
      form.fields.identifier.validate()
      return null
    }
    return e164
  }

  async function handleSendOtp() {
    // Flush pending IME / native TextInput edits into React state before validate.
    if (isSubmitting || verifyingRef.current) return
    Keyboard.dismiss()
    await new Promise<void>((resolve) => setTimeout(resolve, 80))
    setApiError(null)

    form.fields.identifier.touch()
    if (form.fields.identifier.validate()) return

    const validated = resolveIdentifier()
    if (!validated) return

    setIsSubmitting(true)
    try {
      const result = await sendAuthOtp({
        channel,
        identifier: validated,
        purpose: 'login',
      })

      if (!result.success) {
        const message = result.error ?? 'Unable to send code.'
        setApiError(message)
        // Rate limits: keep the user on the code step if one was already sent,
        // and extend the cooldown so they do not burn more OTPs.
        if (/too many|wait|rate/i.test(message)) {
          setResendIn(Math.max(resendIn, 60))
        }
        return
      }

      setOtpSent(true)
      form.fields.otpCode.reset()
      lastAutoSubmitRef.current = null
      verifyingRef.current = false
      setResendIn(result.resendAfter || RESEND_COOLDOWN_SECONDS)
      toast.show('Code sent', {
        tone: 'success',
        message: isEmail
          ? 'Enter the newest code from your inbox — older codes will not work.'
          : `Enter the newest code sent to ${formatPhoneForDisplay(validated)}.`,
      })
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'Unable to send code. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOtp = useCallback(
    async (codeOverride?: string) => {
      if (verifyingRef.current) return
      setApiError(null)

      const code = (codeOverride ?? form.fields.otpCode.value).trim()
      if (!isCompleteOtp(code, OTP_LENGTH)) {
        form.fields.otpCode.touch()
        form.fields.otpCode.validate()
        return
      }

      const validated = resolveIdentifier()
      if (!validated) return

      verifyingRef.current = true
      setIsSubmitting(true)
      let verified = false

      try {
        const result = await verifyAuthOtp({
          channel,
          identifier: validated,
          otp: code,
        })

        if (!result.success) {
          setApiError(result.error ?? 'Verification failed.')
          return
        }

        const sessionResult = await Promise.race([
          getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ])
        const createdAt = sessionResult?.data.session?.user?.created_at
        const isNewUser =
          !!createdAt && Date.now() - new Date(createdAt).getTime() < 2 * 60 * 1000

        verified = true
        toast.show(isNewUser ? AUTH_COPY.welcomeNew : AUTH_COPY.welcomeBack, { tone: 'success' })
        onSuccess?.({ isNewUser })
      } catch (error) {
        setApiError(
          error instanceof Error ? error.message : 'Unable to verify code. Please try again.',
        )
      } finally {
        setIsSubmitting(false)
        if (!verified) verifyingRef.current = false
      }
    },
    [channel, form.fields.otpCode, isEmail, onSuccess, toast],
  )

  const onAutofillCode = useCallback(
    (code: string) => {
      form.fields.otpCode.onChange(code)
      void handleVerifyOtp(code)
    },
    [form.fields.otpCode, handleVerifyOtp],
  )

  useOtpAutofill({ enabled: otpSent && !isSubmitting, onCode: onAutofillCode })

  useEffect(() => {
    if (!otpSent) return
    const code = form.fields.otpCode.value.trim()
    if (
      isCompleteOtp(code, OTP_LENGTH) &&
      !isSubmitting &&
      !verifyingRef.current &&
      lastAutoSubmitRef.current !== code
    ) {
      lastAutoSubmitRef.current = code
      void handleVerifyOtp(code)
    }
  }, [form.fields.otpCode.value, handleVerifyOtp, isSubmitting, otpSent])

  function resetOtpStep() {
    setOtpSent(false)
    form.fields.otpCode.reset()
    setResendIn(0)
    setApiError(null)
    verifyingRef.current = false
  }

  const displayIdentifier = isEmail
    ? form.fields.identifier.value.trim().toLowerCase()
    : formatPhoneForDisplay(form.fields.identifier.value)

  const identifierError = form.fields.identifier.showError ? form.fields.identifier.error : null
  const otpFieldError = form.fields.otpCode.showError ? form.fields.otpCode.error : null

  return (
    <YStack gap="$5">
      <AuthStepProgress step={otpSent ? 2 : 1} />

      {otpSent ? (
        <YStack gap="$4">
          <AuthBackRow disabled={isSubmitting} onPress={resetOtpStep} />
          <YStack gap="$1">
            <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.25}>
              Enter verification code
            </Text>
            <Text fontSize={14} color={ui.textMuted} lineHeight={21}>
              Sent to{' '}
              <Text fontWeight="700" color={ui.text}>
                {displayIdentifier}
              </Text>
              . Use the latest code only.
            </Text>
          </YStack>

          <Field error={otpFieldError ?? apiError ?? undefined}>
            <OtpCodeInput
              value={form.fields.otpCode.value}
              onChange={(next) => {
                setApiError(null)
                form.fields.otpCode.onChange(next)
              }}
              length={OTP_LENGTH}
              disabled={isSubmitting}
              invalid={!!otpFieldError || !!apiError}
              autoFocus
            />
          </Field>

          <Button
            tone="primary"
            size="$4"
            borderRadius={AUTH_LAYOUT.pillRadius}
            disabled={isSubmitting || !isCompleteOtp(form.fields.otpCode.value, OTP_LENGTH)}
            onPress={() => void handleVerifyOtp()}
            icon={isSubmitting ? <Spinner size="small" color="white" /> : undefined}
          >
            {isSubmitting ? 'Verifying…' : 'Continue'}
          </Button>

          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
            <Button
              tone="ghost"
              size="$3"
              disabled={isSubmitting || resendIn > 0}
              onPress={() => void handleSendOtp()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </Button>
            <Button tone="ghost" size="$3" disabled={isSubmitting} onPress={resetOtpStep}>
              Change {isEmail ? 'email' : 'number'}
            </Button>
          </XStack>
        </YStack>
      ) : (
        <YStack gap="$4">
          <YStack gap="$1">
            <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.25}>
              {isEmail ? 'Your email address' : 'Your mobile number'}
            </Text>
            <Text fontSize={14} color={ui.textMuted} lineHeight={21}>
              {isEmail
                ? 'We will email a one-time code. New accounts are created automatically.'
                : `Enter your ${DEFAULT_COUNTRY.name} number — we will text a secure code.`}
            </Text>
          </YStack>

          <Field label={isEmail ? 'Email' : 'Mobile number'} error={identifierError ?? undefined}>
            {isEmail ? (
              <AuthInputShell invalid={!!identifierError} icon={Icons.Mail}>
                <AppTextField
                  embedded
                  value={form.fields.identifier.value}
                  onChangeText={(next) => {
                    setApiError(null)
                    form.fields.identifier.onChange(next)
                  }}
                  onBlur={form.fields.identifier.onBlur}
                  disabled={isSubmitting}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  inputMode="email"
                  placeholder="you@example.com"
                  accessibilityLabel="Email address"
                  importantForAutofill="yes"
                />
              </AuthInputShell>
            ) : (
              <PhoneInput
                value={form.fields.identifier.value}
                onChange={(next) => {
                  setApiError(null)
                  form.fields.identifier.onChange(next)
                }}
                onBlur={form.fields.identifier.onBlur}
                invalid={!!identifierError}
                compact
                disabled={isSubmitting}
                defaultCountry={DEFAULT_COUNTRY}
                autoFocus
              />
            )}
            {isEmail && isDeviceEmailHintSupported() ? (
              <Button
                tone="ghost"
                size="$3"
                alignSelf="flex-start"
                marginTop={4}
                disabled={isSubmitting}
                icon={<Icons.Mail size={16} color={ui.textMuted} />}
                onPress={() => void fillEmailFromDevice()}
              >
                Use email from this device
              </Button>
            ) : null}
            {!isEmail && isPhoneHintSupported() ? (
              <Button
                tone="ghost"
                size="$3"
                alignSelf="flex-start"
                marginTop={4}
                disabled={isSubmitting}
                icon={<Icons.Smartphone size={16} color={ui.textMuted} />}
                onPress={() => void fillPhoneFromDevice()}
                accessibilityLabel="Use number from this device"
              >
                Use number from this device
              </Button>
            ) : null}
            {!isEmail && form.fields.identifier.value && !identifierError ? (
              <Text fontSize={12} color={ui.textMuted} marginTop={6}>
                Sending to {formatPhoneForDisplay(form.fields.identifier.value)}
              </Text>
            ) : null}
          </Field>

          <Button
            color="$pink10"
            tone="white"
            size="$4"
            borderRadius={AUTH_LAYOUT.pillRadius}
            // Keep pressable when empty so validation errors surface (disabled
            // buttons swallow taps on Android and feel broken).
            disabled={isSubmitting}
            onPress={() => void handleSendOtp()}
            icon={isSubmitting ? <Spinner size="small" color="$pink10" /> : undefined}
            iconAfter={!isSubmitting ? <Icons.ArrowRight size={18} color="$pink10" /> : undefined}
          >
            {isSubmitting ? 'Sending code…' : 'Continue'}
          </Button>
        </YStack>
      )}

      {apiError && !otpSent ? <AuthErrorBanner message={apiError} /> : null}
    </YStack>
  )
}

function AuthInputShell({
  children,
  invalid,
  icon: Icon,
}: {
  children: ReactNode
  invalid?: boolean
  icon?: typeof Icons.Mail
}) {
  const ui = useAppUi()

  // Pure RN View — Tamagui XStack pointerEvents / flex often block TextInput on Android.
  return (
    <View
      collapsable={false}
      pointerEvents="auto"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        // Fixed height so embedded TextInput cannot inflate the shell.
        height: 56,
        borderRadius: AUTH_LAYOUT.inputRadius,
        borderWidth: 1,
        borderColor: invalid ? ui.error : ui.borderSubtle,
        backgroundColor: ui.surfaceMuted,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: 'inset 0 1px 2px rgba(26, 10, 18, 0.04)' } as object)
          : null),
      }}
    >
      {Icon ? (
        <View pointerEvents="none" style={{ width: 18, height: 18 }}>
          <Icon size={18} color={ui.textMuted} />
        </View>
      ) : null}
      {children}
    </View>
  )
}

function AuthBackRow({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$2"
      alignSelf="flex-start"
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      <Icons.ArrowLeft size={18} color={ui.textMuted} />
      <Text fontSize={14} fontWeight="600" color={ui.textMuted}>
        Back
      </Text>
    </XStack>
  )
}

function AuthErrorBanner({ message }: { message: string }) {
  const ui = useAppUi()
  return (
    <XStack
      gap="$2.5"
      alignItems="flex-start"
      padding="$3.5"
      borderRadius={AUTH_LAYOUT.inputRadius}
      backgroundColor="rgba(185, 28, 28, 0.06)"
      borderWidth={1}
      borderColor="rgba(185, 28, 28, 0.14)"
    >
      <Icons.AlertCircle size={18} color={ui.error} />
      <Text color={ui.error} fontSize={14} flex={1} lineHeight={20} fontWeight="500">
        {message}
      </Text>
    </XStack>
  )
}
