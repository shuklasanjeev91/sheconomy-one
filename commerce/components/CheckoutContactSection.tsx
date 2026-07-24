import { useEffect, useMemo, useState } from 'react'

function checkoutPhoneOtpStorageKey(userId: string) {
  return `checkout:phone-otp:${userId}`
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
import { useCommercePalette } from '~/commerce/components/commerce-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

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

  const [phoneE164, setPhoneE164] = useState(contact.phone ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    onCheckoutReadyChange(contact.checkoutReady)
  }, [contact.checkoutReady, onCheckoutReadyChange])

  useEffect(() => {
    setPhoneE164(contact.phone ?? '')
    setEmail(contact.email ?? '')
  }, [contact.phone, contact.email])

  useEffect(() => {
    const pendingPhone = readCheckoutPhoneOtpPending(user.id)
    const currentPhone = (contact.phone ?? phoneE164).trim()
    setPhoneOtpSent(Boolean(pendingPhone && pendingPhone === currentPhone))
  }, [contact.phone, phoneE164, user.id])

  const phoneLocked = contact.phoneVerified
  const emailLocked = contact.emailVerified && Boolean(contact.email)
  const showEmailVerify = !emailLocked && email.trim().length > 0

  async function handleSendPhoneCode() {
    setBusy(true)
    const result = await sendCheckoutPhoneVerification(phoneE164)
    setBusy(false)
    if (!result.success) {
      toast.show('Could not send code', { tone: 'danger', message: result.error })
      return
    }
    writeCheckoutPhoneOtpPending(user.id, phoneE164)
    setPhoneOtpSent(true)
    toast.show('Code sent', {
      tone: 'success',
      message: `We sent a verification code to ${formatAuthContactPhone(phoneE164)}.`,
    })
  }

  async function handleVerifyPhone() {
    const code = normalizeOtpDigits(phoneOtp)
    if (!isCompleteOtp(code)) {
      toast.show('Enter the 6-digit code', { tone: 'warning' })
      return
    }
    setBusy(true)
    const result = await confirmCheckoutPhoneVerification(phoneE164, code)
    setBusy(false)
    if (!result.success) {
      toast.show('Verification failed', { tone: 'danger', message: result.error })
      return
    }
    setPhoneOtp('')
    writeCheckoutPhoneOtpPending(user.id, null)
    setPhoneOtpSent(false)
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

      <Field label="Mobile number" required>
        <PhoneInput
          value={phoneE164}
          onChange={setPhoneE164}
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
          <OtpCodeInput
            value={phoneOtp}
            onChange={setPhoneOtp}
            disabled={busy}
            autoFocus
          />
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            disabled={busy}
            onPress={() => void handleVerifyPhone()}
          >
            Verify mobile
          </Button>
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
