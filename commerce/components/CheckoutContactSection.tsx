import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { PhoneInput, type PhoneInputHandle } from '~/components/forms/PhoneInput'
import { OtpCodeInput } from '~/features/auth/components/OtpCodeInput'
import { useOtpAutofill } from '~/features/auth/hooks/useOtpAutofill'
import {
  confirmCheckoutEmailVerification,
  confirmCheckoutPhoneVerification,
  formatAuthContactPhone,
  resolveCheckoutContact,
  sendCheckoutEmailVerification,
  sendCheckoutPhoneVerification,
} from '~/features/auth/services/account-contact'
import { useProfile } from '~/hooks/useProfile'
import { isCompleteOtp, normalizeOtpDigits } from '~/features/auth/validation'
import { Button, Field, Icons, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  CHECKOUT_OTP_AUTO_SEND_DEBOUNCE_MS,
  EMPTY_CHECKOUT_OTP_SESSION,
  checkoutOtpExpiresIn,
  checkoutOtpResendIn,
  checkoutOtpSessionFor,
  formatCheckoutOtpCountdown,
  shouldAutoSendCheckoutOtp,
  type CheckoutOtpSession,
} from '~/commerce/lib/checkout-otp'
import { DEFAULT_COUNTRY } from '~/lib/phone/countries'
import { canonicalE164Phone, isValidPhone, phonesEquivalent } from '~/lib/phone/phone'
import { useCommercePalette } from '~/commerce/components/commerce-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function checkoutPhoneOtpStorageKey(userId: string) {
  return `checkout:phone-otp:${userId}`
}

/**
 * Web-only mirror of the in-flight code so a page reload does not strand the
 * shopper. React state is the source of truth — native has no `sessionStorage`,
 * and reading the flag from it used to leave the code panel permanently hidden
 * on iOS and Android.
 */
function readMirroredOtpSession(userId: string): CheckoutOtpSession {
  if (typeof sessionStorage === 'undefined') return EMPTY_CHECKOUT_OTP_SESSION
  try {
    const raw = sessionStorage.getItem(checkoutPhoneOtpStorageKey(userId))
    if (!raw) return EMPTY_CHECKOUT_OTP_SESSION
    const parsed = JSON.parse(raw) as { phone?: unknown; sentAt?: unknown }
    const phone = typeof parsed.phone === 'string' ? canonicalE164Phone(parsed.phone) : ''
    const sentAt =
      typeof parsed.sentAt === 'number' && Number.isFinite(parsed.sentAt) ? parsed.sentAt : null
    return phone && sentAt != null ? { phone, sentAt } : EMPTY_CHECKOUT_OTP_SESSION
  } catch {
    return EMPTY_CHECKOUT_OTP_SESSION
  }
}

function writeMirroredOtpSession(userId: string, session: CheckoutOtpSession) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const key = checkoutPhoneOtpStorageKey(userId)
    if (session.phone && session.sentAt != null) {
      sessionStorage.setItem(key, JSON.stringify(session))
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    // sessionStorage may be unavailable (private mode / SSR)
  }
}

type CheckoutContactSectionProps = {
  user: User
  onCheckoutReadyChange: (ready: boolean) => void
}

function ReadOnlyContactRow({
  label,
  value,
  verified,
}: {
  label: string
  value: string
  verified?: boolean
}) {
  const c = useCommercePalette()
  const ui = useAppUi()

  return (
    <YStack gap={4}>
      <Text fontSize={12} fontWeight="600" color={c.secondary}>
        {label}
      </Text>
      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontSize={14} fontWeight="600" color={c.text}>
          {value}
        </Text>
        {verified ? (
          <XStack alignItems="center" gap={4}>
            <Icons.BadgeCheck size={14} color={ui.success} />
            <Text fontSize={11} color={ui.success} fontWeight="700">
              Verified
            </Text>
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  )
}

export function CheckoutContactSection({ user, onCheckoutReadyChange }: CheckoutContactSectionProps) {
  const c = useCommercePalette()
  const ui = useAppUi()
  const toast = useAppToast()
  const { profile } = useProfile()
  const contact = useMemo(
    () => resolveCheckoutContact({ user, profile }),
    [user, profile],
  )

  const phoneInputRef = useRef<PhoneInputHandle | null>(null)
  const verifyingRef = useRef(false)
  const lastAutoSentPhoneRef = useRef<string | null>(null)
  const lastAutoSubmitRef = useRef<string | null>(null)

  const [otpSession, setOtpSessionState] = useState<CheckoutOtpSession>(() =>
    readMirroredOtpSession(user.id),
  )
  const [phoneE164, setPhoneE164] = useState(() => otpSession.phone ?? contact.phone ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneSendError, setPhoneSendError] = useState<string | null>(null)
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const setOtpSession = useCallback(
    (next: CheckoutOtpSession) => {
      setOtpSessionState(next)
      writeMirroredOtpSession(user.id, next)
    },
    [user.id],
  )

  const phoneOtpSent = Boolean(otpSession.phone && phonesEquivalent(otpSession.phone, phoneE164))
  const phoneResendIn = checkoutOtpResendIn(otpSession, now)
  const phoneOtpExpiresIn = checkoutOtpExpiresIn(otpSession, now)
  const phoneOtpExpired = phoneOtpSent && otpSession.sentAt != null && phoneOtpExpiresIn <= 0

  const phoneLocked = contact.phoneVerified
  const emailLocked = contact.emailVerified && Boolean(contact.email)
  const showEmailVerify = !emailLocked && email.trim().length > 0

  useEffect(() => {
    onCheckoutReadyChange(contact.checkoutReady)
  }, [contact.checkoutReady, onCheckoutReadyChange])

  useEffect(() => {
    setEmail(contact.email ?? '')
  }, [contact.email])

  useEffect(() => {
    if (contact.phoneVerified && contact.phone) setPhoneE164(contact.phone)
  }, [contact.phone, contact.phoneVerified])

  useEffect(() => {
    setPhoneSendError(null)
  }, [phoneE164])

  useEffect(() => {
    if (!phoneOtpSent) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [phoneOtpSent])

  const handleSendPhoneCode = useCallback(
    async (options?: { isResend?: boolean; auto?: boolean }) => {
      // Read straight from the field: on native the typed digits do not always
      // reach the parent before the tap lands, which used to disable the button
      // and swallow the press with no feedback at all.
      const typed = phoneInputRef.current?.flush() || phoneE164
      const canonicalPhone = canonicalE164Phone(typed.trim())

      setPhoneSendError(null)
      if (!canonicalPhone || !isValidPhone(canonicalPhone)) {
        const message = 'Enter a valid mobile number.'
        setPhoneSendError(message)
        if (!options?.auto) toast.show('Check your mobile number', { tone: 'warning', message })
        return
      }

      if (options?.isResend) {
        setPhoneVerifyError(null)
        setPhoneOtp('')
      }

      setBusy(true)
      const result = await sendCheckoutPhoneVerification(canonicalPhone)
      setBusy(false)

      if (!result.success) {
        const message = result.error ?? 'Could not send verification code.'
        setPhoneSendError(message)
        toast.show('Could not send code', { tone: 'danger', message })
        return
      }

      lastAutoSubmitRef.current = null
      setPhoneE164(canonicalPhone)
      setOtpSession(checkoutOtpSessionFor(canonicalPhone, Date.now()))
      setNow(Date.now())
      toast.show(options?.isResend ? 'New code sent' : 'Code sent', {
        tone: 'success',
        message: `We sent a verification code to ${formatAuthContactPhone(canonicalPhone)}.`,
      })
    },
    [phoneE164, setOtpSession, toast],
  )

  const handleVerifyPhone = useCallback(
    async (codeOverride?: string) => {
      if (verifyingRef.current) return

      const code = normalizeOtpDigits(codeOverride ?? phoneOtp)
      if (!isCompleteOtp(code)) {
        toast.show('Enter the 6-digit code', { tone: 'warning' })
        return
      }
      if (phoneOtpExpired) {
        setPhoneVerifyError('This code has expired. Send a new code to continue.')
        return
      }

      verifyingRef.current = true
      setPhoneVerifyError(null)
      setBusy(true)
      const result = await confirmCheckoutPhoneVerification(phoneE164, code)
      setBusy(false)
      verifyingRef.current = false

      if (!result.success) {
        const message = result.error ?? 'Verification failed.'
        const expired = message.toLowerCase().includes('expired')
        setPhoneVerifyError(message)
        toast.show('Verification failed', { tone: 'danger', message })
        if (expired) setPhoneOtp('')
        return
      }

      setPhoneOtp('')
      setPhoneVerifyError(null)
      setOtpSession(EMPTY_CHECKOUT_OTP_SESSION)
      toast.show('Mobile verified', {
        tone: 'success',
        message: 'You can place your order now.',
      })
    },
    [phoneE164, phoneOtp, phoneOtpExpired, setOtpSession, toast],
  )

  // Send the code as soon as a complete number has been sitting still, so the
  // shopper never has to find a button to start verification.
  useEffect(() => {
    if (phoneLocked) return
    const timer = setTimeout(() => {
      const eligible = shouldAutoSendCheckoutOtp({
        phoneE164,
        phoneVerified: contact.phoneVerified,
        busy,
        session: otpSession,
        lastAutoSentPhone: lastAutoSentPhoneRef.current,
        now: Date.now(),
      })
      if (!eligible) return
      lastAutoSentPhoneRef.current = canonicalE164Phone(phoneE164.trim())
      void handleSendPhoneCode({ auto: true })
    }, CHECKOUT_OTP_AUTO_SEND_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [busy, contact.phoneVerified, handleSendPhoneCode, otpSession, phoneE164, phoneLocked])

  const handleAutofillCode = useCallback((code: string) => {
    setPhoneVerifyError(null)
    setPhoneOtp(code)
  }, [])

  useOtpAutofill({
    enabled: phoneOtpSent && !phoneOtpExpired && !busy,
    onCode: handleAutofillCode,
  })

  // Verify the moment six digits land, whether they were autofilled or typed.
  useEffect(() => {
    if (!phoneOtpSent || phoneOtpExpired || busy || verifyingRef.current) return
    const code = normalizeOtpDigits(phoneOtp)
    if (!isCompleteOtp(code) || lastAutoSubmitRef.current === code) return
    lastAutoSubmitRef.current = code
    void handleVerifyPhone(code)
  }, [busy, handleVerifyPhone, phoneOtp, phoneOtpExpired, phoneOtpSent])

  function handlePhoneChange(next: string) {
    setPhoneE164(next)
    setPhoneVerifyError(null)
    if (otpSession.phone && !phonesEquivalent(otpSession.phone, next)) {
      setOtpSession(EMPTY_CHECKOUT_OTP_SESSION)
      setPhoneOtp('')
      lastAutoSubmitRef.current = null
    }
  }

  async function handleSendEmailCode() {
    setBusy(true)
    const result = await sendCheckoutEmailVerification(email)
    setBusy(false)
    if (!result.success) {
      toast.show('Could not send code', { tone: 'danger', message: result.error })
      return
    }
    setEmailOtpSent(true)
    toast.show('Code sent', { tone: 'success', message: `Check ${email.trim().toLowerCase()}.` })
  }

  async function handleVerifyEmail() {
    const code = normalizeOtpDigits(emailOtp)
    if (!isCompleteOtp(code)) {
      toast.show('Enter the 6-digit code', { tone: 'warning' })
      return
    }
    setBusy(true)
    const result = await confirmCheckoutEmailVerification(email, code)
    setBusy(false)
    if (!result.success) {
      toast.show('Verification failed', { tone: 'danger', message: result.error })
      return
    }
    setEmailOtp('')
    setEmailOtpSent(false)
    toast.show('Email verified', { tone: 'success' })
  }

  if (phoneLocked) {
    return (
      <YStack gap="$3">
        <Text fontSize={13} color={c.secondary} lineHeight={19}>
          Order updates and delivery coordination use your verified contact details.
        </Text>
        <ReadOnlyContactRow
          label="Mobile"
          value={formatAuthContactPhone(contact.phone)}
          verified
        />
        <ReadOnlyContactRow
          label="Email"
          value={contact.email ?? 'Not added'}
          verified={contact.emailVerified}
        />
        {!contact.email ? (
          <YStack gap="$2" paddingTop="$1">
            <Field label="Add email (optional)">
              <Input
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
              />
            </Field>
            {showEmailVerify ? (
              <>
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={999}
                    disabled={busy || emailOtpSent}
                    onPress={() => void handleSendEmailCode()}
                  >
                    {emailOtpSent ? 'Code sent' : 'Send email code'}
                  </Button>
                </XStack>
                {emailOtpSent ? (
                  <YStack gap="$2">
                    <OtpCodeInput value={emailOtp} onChange={setEmailOtp} disabled={busy} />
                    <Button
                      tone="primary"
                      size="$3"
                      borderRadius={999}
                      disabled={busy}
                      onPress={() => void handleVerifyEmail()}
                    >
                      Verify email
                    </Button>
                  </YStack>
                ) : null}
              </>
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <Text fontSize={13} color={c.secondary} lineHeight={19}>
        Add your mobile number to place this order. We&apos;ll send a one-time code as soon as the
        number is complete and verify it automatically — your sign-in session stays active.
      </Text>

      <Field label="Mobile number" required error={phoneSendError ?? undefined}>
        <PhoneInput
          ref={phoneInputRef}
          value={phoneE164}
          onChange={handlePhoneChange}
          defaultCountry={DEFAULT_COUNTRY}
        />
      </Field>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          disabled={busy || phoneOtpSent}
          onPress={() => void handleSendPhoneCode()}
        >
          {phoneOtpSent ? 'Code sent' : busy ? 'Sending…' : 'Send verification code'}
        </Button>
      </XStack>

      {phoneOtpSent ? (
        <YStack gap="$2" paddingTop="$1">
          <Text fontSize={12} fontWeight="600" color={c.secondary}>
            Verification code
          </Text>
          <Text fontSize={12} color={c.secondary}>
            We sent a 6-digit code to {formatAuthContactPhone(phoneE164)}. It verifies itself once it
            arrives.
          </Text>
          {phoneOtpExpired ? (
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Icons.Info size={14} color={ui.error} />
              <Text fontSize={12} color={ui.error} fontWeight="600">
                This code has expired. Send a new code to continue.
              </Text>
            </XStack>
          ) : otpSession.sentAt ? (
            <Text fontSize={12} color={c.secondary}>
              Code expires in {formatCheckoutOtpCountdown(phoneOtpExpiresIn)}
            </Text>
          ) : null}
          <OtpCodeInput
            value={phoneOtp}
            onChange={(next) => {
              setPhoneVerifyError(null)
              setPhoneOtp(next)
            }}
            disabled={busy || phoneOtpExpired}
            autoFocus
          />
          {phoneVerifyError ? (
            <Text fontSize={12} color={ui.error} fontWeight="600">
              {phoneVerifyError}
            </Text>
          ) : null}
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            disabled={busy || phoneOtpExpired || !isCompleteOtp(normalizeOtpDigits(phoneOtp))}
            onPress={() => void handleVerifyPhone()}
          >
            {busy ? 'Verifying…' : 'Verify mobile'}
          </Button>
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              disabled={busy || phoneResendIn > 0}
              onPress={() => void handleSendPhoneCode({ isResend: true })}
            >
              {phoneResendIn > 0
                ? `Send again in ${phoneResendIn}s`
                : phoneOtpExpired
                  ? 'Send new code'
                  : 'Resend code'}
            </Button>
            {phoneResendIn > 0 ? (
              <Text fontSize={12} color={c.secondary}>
                You can request another code in {phoneResendIn}s
              </Text>
            ) : null}
          </XStack>
        </YStack>
      ) : null}

      {!contact.email ? (
        <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor={c.divider}>
          <Field label="Email">
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              disabled={busy || emailLocked}
            />
          </Field>
          {showEmailVerify ? (
            <>
              <Button
                tone="outline"
                size="$3"
                borderRadius={999}
                disabled={busy || emailOtpSent}
                onPress={() => void handleSendEmailCode()}
              >
                {emailOtpSent ? 'Code sent' : 'Send email code'}
              </Button>
              {emailOtpSent ? (
                <YStack gap="$2">
                  <OtpCodeInput value={emailOtp} onChange={setEmailOtp} disabled={busy} />
                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={999}
                    disabled={busy}
                    onPress={() => void handleVerifyEmail()}
                  >
                    Verify email
                  </Button>
                </YStack>
              ) : null}
            </>
          ) : null}
        </YStack>
      ) : (
        <ReadOnlyContactRow label="Email" value={contact.email ?? 'Not added'} verified={contact.emailVerified} />
      )}

      {!contact.checkoutReady ? (
        <XStack alignItems="center" gap="$2" paddingTop="$1">
          <Icons.Info size={14} color={ui.badgeAccentText} />
          <Text fontSize={12} color={ui.badgeAccentText} fontWeight="600">
            Verify your mobile to continue checkout.
          </Text>
        </XStack>
      ) : null}
    </YStack>
  )
}
