import { validateNationalPhone } from '~/lib/phone/phone'
import type { Country } from '~/lib/phone/countries'

export function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase())
}

export function validateFullName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter your full name.'
  if (trimmed.length < 2) return 'Name must be at least 2 characters.'
  if (trimmed.length > 80) return 'Name is too long.'
  return null
}

export function validateEmailAddress(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter your email address.'
  return isValidEmailFormat(trimmed) ? null : 'Enter a valid email address.'
}

export function validateMobileNumber(national: string, country: Country): string | null {
  if (!national.trim()) return 'Enter your mobile number.'
  const result = validateNationalPhone(national, country)
  return result.ok ? null : result.error
}

export function normalizeOtpDigits(value: string, length = 6): string {
  return value.replace(/\D/g, '').slice(0, length)
}

export function isCompleteOtp(value: string, length = 6): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value.trim())
}

export type AuthErrorCode =
  | 'invalid'
  | 'expired'
  | 'rate_limited'
  | 'network'
  | 'phone_exists'
  | 'email_exists'
  | 'unknown'

/** Map user-facing auth errors without exposing internals or OTP values. */
export function mapAuthErrorMessage(
  message: string | null | undefined,
  options?: { code?: string | null },
): {
  text: string
  code: AuthErrorCode
} {
  const raw = (message ?? '').toLowerCase()
  const errorCode = (options?.code ?? '').toLowerCase()

  if (errorCode === 'phone_exists' || raw.includes('phone number has already been registered')) {
    return {
      text: 'A user with this phone number has already been registered.',
      code: 'phone_exists',
    }
  }
  if (errorCode === 'email_exists' || raw.includes('email address has already been registered')) {
    return {
      text: 'A user with this email address has already been registered.',
      code: 'email_exists',
    }
  }
  if (!raw) return { text: 'Something went wrong. Please try again.', code: 'unknown' }
  if (raw.includes('expired') || raw.includes('otp_expired')) {
    return { text: 'This code has expired. Request a new one.', code: 'expired' }
  }
  if (raw.includes('rate') || raw.includes('too many') || raw.includes('limit')) {
    return { text: 'Too many attempts. Please wait and try again.', code: 'rate_limited' }
  }
  if (
    raw.includes('invalid otp') ||
    raw.includes('otp expired') ||
    raw.includes('invalid token') ||
    raw.includes('token has expired') ||
    raw.includes('token is invalid') ||
    (raw.includes('invalid') && raw.includes('code'))
  ) {
    return {
      text: 'That code is incorrect or no longer valid. Request a new one and try again.',
      code: 'invalid',
    }
  }
  if (
    raw.includes('network') ||
    raw.includes('fetch') ||
    raw.includes('offline') ||
    raw.includes('abort') ||
    raw.includes('timeout') ||
    raw.includes('taking too long')
  ) {
    return { text: 'You appear to be offline. Check your connection and retry.', code: 'network' }
  }
  if (message?.trim()) {
    return { text: message.trim(), code: 'unknown' }
  }
  return { text: 'Unable to continue right now. Please try again.', code: 'unknown' }
}
