import { describe, expect, it } from 'vitest'

import {
  CHECKOUT_OTP_EXPIRY_SECONDS,
  CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS,
  EMPTY_CHECKOUT_OTP_SESSION,
  checkoutOtpExpiresIn,
  checkoutOtpResendIn,
  checkoutOtpSessionFor,
  formatCheckoutOtpCountdown,
  shouldAutoSendCheckoutOtp,
  type CheckoutOtpAutoSendInput,
} from '~/commerce/lib/checkout-otp'

const NOW = 1_700_000_000_000
const VALID = '+919876543210'

function autoSendInput(overrides: Partial<CheckoutOtpAutoSendInput> = {}): CheckoutOtpAutoSendInput {
  return {
    phoneE164: VALID,
    phoneVerified: false,
    busy: false,
    session: EMPTY_CHECKOUT_OTP_SESSION,
    lastAutoSentPhone: null,
    now: NOW,
    ...overrides,
  }
}

describe('shouldAutoSendCheckoutOtp', () => {
  it('sends once a complete, valid number is entered', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput())).toBe(true)
  })

  it('accepts a number the field formatted with spaces', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ phoneE164: '+91 98765 43210' }))).toBe(true)
  })

  it('waits while the number is still incomplete', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ phoneE164: '+9198765' }))).toBe(false)
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ phoneE164: '' }))).toBe(false)
  })

  it('never spends a code on an already verified mobile', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ phoneVerified: true }))).toBe(false)
  })

  it('holds off while a send or verify is in flight', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ busy: true }))).toBe(false)
  })

  it('fires at most once per number', () => {
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ lastAutoSentPhone: VALID }))).toBe(false)
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ lastAutoSentPhone: '+91 98765 43210' }))).toBe(
      false,
    )
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ lastAutoSentPhone: '+919999999999' }))).toBe(
      true,
    )
  })

  it('skips a number that already has a code in flight', () => {
    const session = checkoutOtpSessionFor(VALID, NOW)
    expect(shouldAutoSendCheckoutOtp(autoSendInput({ session }))).toBe(false)
  })

  it('respects the resend cooldown after switching to a new number', () => {
    const session = checkoutOtpSessionFor('+919999999999', NOW)
    const withinCooldown = autoSendInput({ session, now: NOW + 10_000 })
    const afterCooldown = autoSendInput({
      session,
      now: NOW + (CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS + 1) * 1000,
    })

    expect(shouldAutoSendCheckoutOtp(withinCooldown)).toBe(false)
    expect(shouldAutoSendCheckoutOtp(afterCooldown)).toBe(true)
  })
})

describe('checkout OTP countdowns', () => {
  it('counts the resend cooldown down to zero', () => {
    const session = checkoutOtpSessionFor(VALID, NOW)
    expect(checkoutOtpResendIn(session, NOW)).toBe(CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS)
    expect(checkoutOtpResendIn(session, NOW + 25_000)).toBe(5)
    expect(checkoutOtpResendIn(session, NOW + 60_000)).toBe(0)
  })

  it('counts the code lifetime down to zero', () => {
    const session = checkoutOtpSessionFor(VALID, NOW)
    expect(checkoutOtpExpiresIn(session, NOW)).toBe(CHECKOUT_OTP_EXPIRY_SECONDS)
    expect(checkoutOtpExpiresIn(session, NOW + 400_000)).toBe(0)
  })

  it('reports no countdown when nothing was sent', () => {
    expect(checkoutOtpResendIn(EMPTY_CHECKOUT_OTP_SESSION, NOW)).toBe(0)
    expect(checkoutOtpExpiresIn(EMPTY_CHECKOUT_OTP_SESSION, NOW)).toBe(0)
  })

  it('formats the remaining lifetime as minutes and seconds', () => {
    expect(formatCheckoutOtpCountdown(300)).toBe('5:00')
    expect(formatCheckoutOtpCountdown(65)).toBe('1:05')
    expect(formatCheckoutOtpCountdown(0)).toBe('0:00')
  })
})

describe('checkoutOtpSessionFor', () => {
  it('stores the canonical number so a reformatted input still matches', () => {
    expect(checkoutOtpSessionFor('+91 98765 43210', NOW)).toEqual({ phone: VALID, sentAt: NOW })
  })

  it('returns an empty session for an unusable number', () => {
    expect(checkoutOtpSessionFor('   ', NOW)).toEqual(EMPTY_CHECKOUT_OTP_SESSION)
  })
})
