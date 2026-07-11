import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { useFormValidation } from '~/hooks/useFormValidation'
import { countryFlag, type Country } from '~/lib/phone/countries'
import { formatPhoneForDisplay, validateNationalPhone } from '~/lib/phone/phone'
import {
  sendOtp,
  verifyOtp,
  getSession,
  type OtpChannel,
  type PhoneAuthInput,
} from '~/lib/supabase/auth'
import { email, otp, required } from '~/lib/validation'
import { useAppUi } from '~/lib/theme/useAppUi'

const RESEND_COOLDOWN_SECONDS = 30

type AuthOtpFormProps = {
  channel: OtpChannel
  onSuccess?: () => void
}

/** Passwordless OTP sign-in — email or SMS, cross-platform. */
export function AuthOtpForm({ channel, onSuccess }: AuthOtpFormProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [phoneE164, setPhoneE164] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  const isEmail = channel === 'email'

  const schema = useMemo(
    () => ({
      identifier: {
        initialValue: '',
        validators: isEmail
          ? [required('Enter your email address.'), email()]
          : [
            required('Enter your mobile number.'),
            (value: string) => {
              if (!value.trim()) return null
              const result = validateNationalPhone(value, country)
              return result.ok ? null : result.error
            },
          ],
      },
      otpCode: {
        initialValue: '',
        validators: [
          required('Enter the verification code we sent you.'),
          otp(4, 8, 'Enter the full verification code.'),
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
  }, [channel])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  function resolveIdentifier() {
    if (isEmail) {
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
    const { error: otpError } = await sendOtp(channel, isEmail ? validated : phoneInput)
    setIsSubmitting(false)

    if (otpError) {
      setApiError(otpError.message)
      return
    }

    setOtpSent(true)
    setResendIn(RESEND_COOLDOWN_SECONDS)
    toast.show('Code sent', {
      tone: 'success',
      message: isEmail
        ? 'Check your inbox for the verification code.'
        : `Code sent to ${formatPhoneForDisplay(validated, country)}`,
    })
  }

  async function handleVerifyOtp() {
    setApiError(null)
    form.fields.otpCode.touch()
    if (form.fields.otpCode.validate()) return

    const validated = resolveIdentifier()
    if (!validated) return

    setIsSubmitting(true)
    const { error: verifyError } = await verifyOtp(
      channel,
      isEmail ? validated : phoneInput,
      form.fields.otpCode.value.trim(),
    )
    setIsSubmitting(false)

    if (verifyError) {
      setApiError(verifyError.message)
      return
    }

    const { data: sessionData } = await getSession()
    const createdAt = sessionData.session?.user?.created_at
    const isNewUser =
      !!createdAt && Date.now() - new Date(createdAt).getTime() < 2 * 60 * 1000

    toast.show(isNewUser ? AUTH_COPY.welcomeNew : AUTH_COPY.welcomeBack, { tone: 'success' })
    onSuccess?.()
  }

  function resetOtpStep() {
    setOtpSent(false)
    form.fields.otpCode.reset()
    setPhoneE164('')
    setResendIn(0)
    setApiError(null)
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

          <Field label="Verification code" error={otpFieldError ?? undefined}>
            <AuthInputShell invalid={!!otpFieldError}>
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                autoCapitalize="none"
                keyboardType="number-pad"
                placeholder="000000"
                value={form.fields.otpCode.value}
                onChangeText={form.fields.otpCode.onChange}
                onBlur={form.fields.otpCode.onBlur}
                invalid={!!otpFieldError}
                maxLength={8}
                autoFocus
                textAlign="center"
                fontSize={22}
                fontWeight="700"
                letterSpacing={6}
              />
            </AuthInputShell>
          </Field>

          <Button
            tone="primary"
            size="$4"
            borderRadius={AUTH_LAYOUT.pillRadius}
            disabled={isSubmitting || !form.fields.otpCode.isValid}
            onPress={handleVerifyOtp}
            icon={isSubmitting ? <Spinner size="small" color="white" /> : undefined}
          >
            {isSubmitting ? 'Verifying…' : 'Continue'}
          </Button>

          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
            <Button tone="ghost" size="$3" disabled={isSubmitting || resendIn > 0} onPress={handleSendOtp}>
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
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  value={form.fields.identifier.value}
                  onChangeText={form.fields.identifier.onChange}
                  onBlur={form.fields.identifier.onBlur}
                  invalid={!!identifierError}
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
                  keyboardType="phone-pad"
                  placeholder={country.placeholder}
                  value={form.fields.identifier.value}
                  onChangeText={form.fields.identifier.onChange}
                  onBlur={form.fields.identifier.onBlur}
                  invalid={!!identifierError}
                  maxLength={country.maxLength + 4}
                />
              </AuthInputShell>
            )}
            {!isEmail && form.fields.identifier.value && !identifierError ? (
              <Text fontSize={12} color={ui.textMuted} marginTop={6}>
                Sending to{' '}
                {formatPhoneForDisplay(form.fields.identifier.value, country)}
              </Text>
            ) : null}
          </Field>

          <Button
            color="$pink10"
            tone="white"
            size="$4"
            borderRadius={AUTH_LAYOUT.pillRadius}
            disabled={isSubmitting || !form.fields.identifier.isValid}
            onPress={handleSendOtp}
            icon={isSubmitting ? <Spinner size="small" color="$pink10" /> : undefined}
            iconAfter={!isSubmitting ? <Icons.ArrowRight size={18} color="$pink10" /> : undefined}
          >
            {isSubmitting ? 'Sending code…' : 'Send verification code'}
          </Button>
        </YStack>
      )}

      {apiError ? <AuthErrorBanner message={apiError} /> : null}
    </YStack>
  )
}

function AuthInputShell({
  children,
  invalid,
  icon: Icon,
  row,
}: {
  children: React.ReactNode
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
      height={56}
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
