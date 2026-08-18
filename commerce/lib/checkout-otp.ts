/**
 * Checkout mobile-verification timing rules, kept free of React so the
 * auto-send decision can be unit tested on its own.
 */

import { canonicalE164Phone, isValidPhone, phonesEquivalent } from '~/lib/phone/phone'

export const CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS = 30
export const CHECKOUT_OTP_EXPIRY_SECONDS = 300

/** Wait for typing to settle before spending an SMS on a half-typed number. */
export const CHECKOUT_OTP_AUTO_SEND_DEBOUNCE_MS = 800

export type CheckoutOtpSession = {
  /** Canonical E.164 the last code was sent to, or null when nothing is pending. */
  phone: string | null
  sentAt: number | null
}

export const EMPTY_CHECKOUT_OTP_SESSION: CheckoutOtpSession = { phone: null, sentAt: null }

export function checkoutOtpSessionFor(phoneE164: string, sentAt: number): CheckoutOtpSession {
  const canonical = canonicalE164Phone(phoneE164.trim())
  return canonical ? { phone: canonical, sentAt } : EMPTY_CHECKOUT_OTP_SESSION
}

function secondsRemaining(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function checkoutOtpResendIn(session: CheckoutOtpSession, now: number): number {
  if (session.sentAt == null) return 0
  return secondsRemaining(session.sentAt + CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS * 1000, now)
}

export function checkoutOtpExpiresIn(session: CheckoutOtpSession, now: number): number {
  if (session.sentAt == null) return 0
  return secondsRemaining(session.sentAt + CHECKOUT_OTP_EXPIRY_SECONDS * 1000, now)
}

export function formatCheckoutOtpCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type CheckoutOtpAutoSendInput = {
  phoneE164: string
  phoneVerified: boolean
  busy: boolean
  session: CheckoutOtpSession
  /** Last number auto-send already fired for — one automatic code per number. */
  lastAutoSentPhone: string | null
  now: number
}

/**
 * Auto-send fires once per number: only for a complete, valid mobile that has
 * no code in flight and is not inside the resend cooldown. Everything else
 * (retries, a changed mind about the number) goes through the visible button.
 */
export function shouldAutoSendCheckoutOtp(input: CheckoutOtpAutoSendInput): boolean {
  if (input.phoneVerified || input.busy) return false

  const canonical = canonicalE164Phone(input.phoneE164.trim())
  if (!canonical || !isValidPhone(canonical)) return false

  if (phonesEquivalent(input.lastAutoSentPhone, canonical)) return false
  if (phonesEquivalent(input.session.phone, canonical)) return false

  return checkoutOtpResendIn(input.session, input.now) === 0
}
