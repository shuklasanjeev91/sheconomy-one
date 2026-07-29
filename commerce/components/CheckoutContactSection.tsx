import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { PhoneInput } from '~/components/forms/PhoneInput'
import { OtpCodeInput } from '~/features/auth/components/OtpCodeInput'
import {
  confirmCheckoutEmailVerification,
  confirmCheckoutPhoneVerification,
  formatAuthContactPhone,
  resolveAuthContact,
  sendCheckoutEmailVerification,
  sendCheckoutPhoneVerification,
} from '~/features/auth/services/account-contact'
import { isCompleteOtp, normalizeOtpDigits } from '~/features/auth/validation'
import { Button, Field, Icons, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { DEFAULT_COUNTRY } from '~/lib/phone/countries'
import { canonicalE164Phone, phonesEquivalent } from '~/lib/phone/phone'
import { useCommercePalette } from '~/commerce/components/commerce-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function checkoutPhoneOtpStorageKey(userId: string) {
  return `checkout:phone-otp:${userId}`
}

function checkoutPhoneOtpSentAtKey(userId: string) {
  return `checkout:phone-otp-sent-at:${userId}`
}

const CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS = 30
const CHECKOUT_OTP_EXPIRY_SECONDS = 300

function formatOtpCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function readCheckoutPhoneOtpSentAt(userId: string): number | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(checkoutPhoneOtpSentAtKey(userId))
    if (!raw) return null
    const sentAt = Number(raw)
    return Number.isFinite(sentAt) ? sentAt : null
  } catch {
    return null
  }
}

function writeCheckoutPhoneOtpSentAt(userId: string, sentAt: number | null) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const key = checkoutPhoneOtpSentAtKey(userId)
    if (sentAt != null) sessionStorage.setItem(key, String(sentAt))
    else sessionStorage.removeItem(key)
  } catch {
    // sessionStorage may be unavailable (private mode / SSR)
  }
}

function readCheckoutPhoneOtpPending(userId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage.getItem(checkoutPhoneOtpStorageKey(userId))
  } catch {
    return null
  }
}

function writeCheckoutPhoneOtpPending(userId: string, phoneE164: string | null) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const key = checkoutPhoneOtpStorageKey(userId)
    if (phoneE164?.trim()) sessionStorage.setItem(key, phoneE164.trim())
    else sessionStorage.removeItem(key)
  } catch {
    // sessionStorage may be unavailable (private mode / SSR)
  }
}

function readPendingCheckoutPhone(userId: string): string | null {
  const raw = readCheckoutPhoneOtpPending(userId)
  if (!raw?.trim()) return null
  const normalized = canonicalE164Phone(raw.trim())
  return normalized || null
}

function writePendingCheckoutPhone(userId: string, phoneE164: string | null) {
  if (!phoneE164?.trim()) {
    writeCheckoutPhoneOtpPending(userId, null)
    writeCheckoutPhoneOtpSentAt(userId, null)
    return
  }
  writeCheckoutPhoneOtpPending(userId, canonicalE164Phone(phoneE164.trim()))
}

function writeCheckoutPhoneOtpSession(
  userId: string,
  phoneE164: string | null,
  sentAt: number | null,
) {
  writePendingCheckoutPhone(userId, phoneE164)
  writeCheckoutPhoneOtpSentAt(userId, sentAt)
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
  const contact = useMemo(() => resolveAuthContact(user), [user])

  const [otpFlowTick, setOtpFlowTick] = useState(0)
  const pendingVerificationPhone = useMemo(() => {
    void otpFlowTick
    return readPendingCheckoutPhone(user.id)
  }, [otpFlowTick, user.id])

  const [phoneE164, setPhoneE164] = useState(() => {
    const pending = readPendingCheckoutPhone(user.id)
    if (pending) return pending
    return contact.phone ?? ''
  })
  const [email, setEmail] = useState(contact.email ?? '')
  const phoneOtpSent = Boolean(
    pendingVerificationPhone && phonesEquivalent(pendingVerificationPhone, phoneE164),
  )
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneSendError, setPhoneSendError] = useState<string | null>(null)
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [otpClockTick, setOtpClockTick] = useState(0)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    onCheckoutReadyChange(contact.checkoutReady)
  }, [contact.checkoutReady, onCheckoutReadyChange])

  useEffect(() => {
    setEmail(contact.email ?? '')
  }, [contact.email])

  useEffect(() => {
    if (contact.phoneVerified && contact.phone) {
      setPhoneE164(contact.phone)
      return
    }
    const pending = readPendingCheckoutPhone(user.id)
    if (pending) {
      setPhoneE164(pending)
    }
  }, [contact.phone, contact.phoneVerified, user.id])

  useEffect(() => {
    setPhoneSendError(null)
  }, [phoneE164])

  useEffect(() => {
    if (!phoneOtpSent) return
    const timer = setInterval(() => setOtpClockTick((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phoneOtpSent])

  const phoneOtpSentAt = useMemo(() => {
    void otpFlowTick
    void otpClockTick
    return readCheckoutPhoneOtpSentAt(user.id)
  }, [otpClockTick, otpFlowTick, user.id])

  const phoneResendIn = useMemo(() => {
    if (!phoneOtpSentAt) return 0
    const remainingMs = phoneOtpSentAt + CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()
    return Math.max(0, Math.ceil(remainingMs / 1000))
  }, [phoneOtpSentAt, otpClockTick])

  const phoneOtpExpiresIn = useMemo(() => {
    if (!phoneOtpSentAt) return 0
    const remainingMs = phoneOtpSentAt + CHECKOUT_OTP_EXPIRY_SECONDS * 1000 - Date.now()
    return Math.max(0, Math.ceil(remainingMs / 1000))
  }, [phoneOtpSentAt, otpClockTick])

  const phoneOtpExpired = phoneOtpSent && phoneOtpSentAt != null && phoneOtpExpiresIn <= 0

  const phoneLocked = contact.phoneVerified
  const emailLocked = contact.emailVerified && Boolean(contact.email)
  const showEmailVerify = !emailLocked && email.trim().length > 0

  function handlePhoneChange(next: string) {
    setPhoneE164(next)
    setPhoneVerifyError(null)
    if (pendingVerificationPhone && !phonesEquivalent(pendingVerificationPhone, next)) {
      writeCheckoutPhoneOtpSession(user.id, null, null)
      setOtpFlowTick((value) => value + 1)
    }
  }

  async function handleSendPhoneCode(options?: { isResend?: boolean }) {
    setPhoneSendError(null)
    if (options?.isResend) {
      setPhoneVerifyError(null)
      setPhoneOtp('')
    }
    setBusy(true)
    const result = await sendCheckoutPhoneVerification(phoneE164)
    setBusy(false)
    if (!result.success) {
      const message = result.error ?? 'Could not send verification code.'
      setPhoneSendError(message)
      toast.show('Could not send code', { tone: 'danger', message })
      return
    }
    const normalizedPhone = canonicalE164Phone(phoneE164.trim())
    if (normalizedPhone && normalizedPhone !== phoneE164) {
      setPhoneE164(normalizedPhone)
    }
    writeCheckoutPhoneOtpSession(user.id, normalizedPhone || phoneE164, Date.now())
    setOtpFlowTick((value) => value + 1)
    toast.show(options?.isResend ? 'New code sent' : 'Code sent', {
      tone: 'success',
      message: `We sent a verification code to ${formatAuthContactPhone(normalizedPhone || phoneE164)}.`,
    })
  }

  async function handleVerifyPhone() {
    const code = normalizeOtpDigits(phoneOtp)
    if (!isCompleteOtp(code)) {
      toast.show('Enter the 6-digit code', { tone: 'warning' })
      return
    }
    if (phoneOtpExpired) {
      setPhoneVerifyError('This code has expired. Send a new code to continue.')
      return
    }
    setPhoneVerifyError(null)
    setBusy(true)
    const result = await confirmCheckoutPhoneVerification(phoneE164, code)
    setBusy(false)
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
    writeCheckoutPhoneOtpSession(user.id, null, null)
    setOtpFlowTick((value) => value + 1)
    toast.show('Mobile verified', {
      tone: 'success',
      message: 'You can place your order now.',
    })
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
        Add and verify your mobile number to place this order. We&apos;ll send a one-time code — your
        sign-in session stays active.
      </Text>

      <Field label="Mobile number" required error={phoneSendError ?? undefined}>
        <PhoneInput
          value={phoneE164}
          onChange={handlePhoneChange}
          defaultCountry={DEFAULT_COUNTRY}
          disabled={busy}
        />
      </Field>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          disabled={busy || !phoneE164.trim() || phoneOtpSent}
          onPress={() => void handleSendPhoneCode()}
        >
          {phoneOtpSent ? 'Code sent' : 'Send verification code'}
        </Button>
      </XStack>

      {phoneOtpSent ? (
        <YStack gap="$2" paddingTop="$1">
          <Text fontSize={12} fontWeight="600" color={c.secondary}>
            Verification code
          </Text>
          <Text fontSize={12} color={c.secondary}>
            Enter the 6-digit code sent to {formatAuthContactPhone(phoneE164)}.
          </Text>
          {phoneOtpExpired ? (
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Icons.Info size={14} color={ui.error} />
              <Text fontSize={12} color={ui.error} fontWeight="600">
                This code has expired. Send a new code to continue.
              </Text>
            </XStack>
          ) : phoneOtpSentAt ? (
            <Text fontSize={12} color={c.secondary}>
              Code expires in {formatOtpCountdown(phoneOtpExpiresIn)}
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
            disabled={busy || phoneOtpExpired}
            onPress={() => void handleVerifyPhone()}
          >
            Verify mobile
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
