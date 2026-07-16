import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { AuthStepProgress } from '~/components/auth/AuthMethodTabs'
import { CountryCodePicker, DEFAULT_COUNTRY } from '~/components/auth/CountryCodePicker'
import {
  Button,
  Field,
  Icons,
  Input,
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
  validateMobileNumber,
} from '~/features/auth/validation'
import { useFormValidation } from '~/hooks/useFormValidation'
import { isPhoneHintSupported, requestPhoneNumberHint } from '~/lib/platform/phone-hint'
import { countryFlag, type Country } from '~/lib/phone/countries'
import { formatPhoneForDisplay, parseE164Phone, validateNationalPhone } from '~/lib/phone/phone'
import { getSession, type OtpChannel, type PhoneAuthInput } from '~/lib/supabase/auth'
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
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [phoneE164, setPhoneE164] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const verifyingRef = useRef(false)

  const isEmail = channel === 'email'

  const schema = useMemo(
    () => ({
      identifier: {
        initialValue: '',
        validators: isEmail
          ? [required('Enter your email address.'), email()]
          : [
              required('Enter your mobile number.'),
              (value: string) => validateMobileNumber(value, country),
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
    [country, isEmail],
  )

  const form = useFormValidation(schema)

  const phoneInput = useMemo<PhoneAuthInput>(
    () => ({ country, nationalNumber: form.fields.identifier.value }),
    [country, form.fields.identifier.value],
  )

  useEffect(() => {
    form.resetAll()
    setOtpSent(false)
    setPhoneE164('')
    setApiError(null)
    setResendIn(0)
    setCountry(DEFAULT_COUNTRY)
    verifyingRef.current = false
  }, [channel])

  useEffect(() => {
    if (isEmail || otpSent || !isPhoneHintSupported()) return
    let cancelled = false
    void requestPhoneNumberHint().then((result) => {
      if (cancelled || !result.phoneNumber) return
      const parsed = parseE164Phone(result.phoneNumber)
      if (!parsed) return
      setCountry(parsed.country)
      form.fields.identifier.onChange(parsed.nationalNumber)
    })
    return () => {
      cancelled = true
    }
  }, [isEmail, otpSent])

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
    const result = validateNationalPhone(form.fields.identifier.value, country)
    if (!result.ok) {
      form.fields.identifier.touch()
      form.fields.identifier.validate()
      return null
    }
    setPhoneE164(result.e164)
    return result.e164
  }

  async function handleSendOtp() {
    setApiError(null)

    form.fields.identifier.touch()
    if (form.fields.identifier.validate()) return

    const validated = resolveIdentifier()
    if (!validated) return

    setIsSubmitting(true)
    const result = await sendAuthOtp({
      channel,
      identifier: isEmail ? validated : phoneInput,
      purpose: 'login',
    })
    setIsSubmitting(false)

    if (!result.success) {
      setApiError(result.error ?? 'Unable to send code.')
      return
    }

    setOtpSent(true)
    setResendIn(result.resendAfter || RESEND_COOLDOWN_SECONDS)
    toast.show('Code sent', {
      tone: 'success',
      message: isEmail
        ? 'Check your inbox for the verification code.'
        : `Code sent to ${formatPhoneForDisplay(validated, country)}`,
    })
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

      const result = await verifyAuthOtp({
        channel,
        identifier: isEmail ? validated : phoneInput,
        otp: code,
      })

      setIsSubmitting(false)

      if (!result.success) {
        verifyingRef.current = false
        setApiError(result.error ?? 'Verification failed.')
        return
      }

      const { data: sessionData } = await getSession()
      const createdAt = sessionData.session?.user?.created_at
      const isNewUser =
        !!createdAt && Date.now() - new Date(createdAt).getTime() < 2 * 60 * 1000

      toast.show(isNewUser ? AUTH_COPY.welcomeNew : AUTH_COPY.welcomeBack, { tone: 'success' })
      onSuccess?.({ isNewUser })
    },
    [
      channel,
      form.fields.otpCode,
      isEmail,
      onSuccess,
      phoneInput,
      toast,
    ],
  )

  const onAutofillCode = useCallback(
    (code: string) => {
      form.fields.otpCode.onChange(code)
      void handleVerifyOtp(code)
    },
    [form.fields.otpCode, handleVerifyOtp],
  )

  useOtpAutofill({ enabled: otpSent && !isSubmitting, onCode: onAutofillCode })

  const lastAutoSubmitRef = useRef<string | null>(null)
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
    setPhoneE164('')
    setResendIn(0)
    setApiError(null)
    verifyingRef.current = false
  }

  const displayIdentifier = isEmail
    ? form.fields.identifier.value.trim().toLowerCase()
    : formatPhoneForDisplay(phoneE164 || form.fields.identifier.value, country)

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
                : `Enter your ${country.name} number — we will text a secure code.`}
            </Text>
          </YStack>

          <Field label={isEmail ? 'Email' : 'Mobile number'} error={identifierError ?? undefined}>
            {isEmail ? (
              <AuthInputShell invalid={!!identifierError} icon={Icons.Mail}>
                <Input
                  flex={1}
                  borderWidth={0}
                  backgroundColor="transparent"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  value={form.fields.identifier.value}
                  onChangeText={form.fields.identifier.onChange}
                  onBlur={form.fields.identifier.onBlur}
                  invalid={!!identifierError}
                  {...(Platform.OS === 'web' ? ({ autoComplete: 'email' } as object) : {})}
                />
              </AuthInputShell>
            ) : (
              <AuthInputShell invalid={!!identifierError} row>
                <CountryCodePicker value={country} onChange={setCountry} compact />
                <YStack width={1} height={28} backgroundColor={ui.borderSubtle} />
                <Input
                  flex={1}
                  borderWidth={0}
                  backgroundColor="transparent"
                  autoCapitalize="none"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  keyboardType="phone-pad"
                  placeholder={country.placeholder}
                  value={form.fields.identifier.value}
                  onChangeText={form.fields.identifier.onChange}
                  onBlur={form.fields.identifier.onBlur}
                  invalid={!!identifierError}
                  maxLength={country.maxLength + 4}
                  {...(Platform.OS === 'web' ? ({ autoComplete: 'tel' } as object) : {})}
                />
              </AuthInputShell>
            )}
            {!isEmail && form.fields.identifier.value && !identifierError ? (
              <Text fontSize={12} color={ui.textMuted} marginTop={6}>
                Sending to {formatPhoneForDisplay(form.fields.identifier.value, country)}
                {countryFlag(country) ? ` ${countryFlag(country)}` : ''}
              </Text>
            ) : null}
          </Field>

          <Button
            color="$pink10"
            tone="white"
            size="$4"
            borderRadius={AUTH_LAYOUT.pillRadius}
            disabled={isSubmitting || !form.fields.identifier.isValid}
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
  row,
}: {
  children: ReactNode
  invalid?: boolean
  icon?: typeof Icons.Mail
  row?: boolean
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      gap={row ? '$2' : '$3'}
      paddingHorizontal="$3"
      minHeight={56}
      borderRadius={AUTH_LAYOUT.inputRadius}
      borderWidth={1}
      borderColor={invalid ? ui.error : ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      paddingLeft={row ? '$2' : '$3'}
      style={
        Platform.OS === 'web'
          ? ({ boxShadow: 'inset 0 1px 2px rgba(26, 10, 18, 0.04)' } as const)
          : undefined
      }
    >
      {Icon ? <Icon size={18} color={ui.textMuted} /> : null}
      {children}
    </XStack>
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
      animation="quick"
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
