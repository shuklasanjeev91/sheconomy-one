import { supabase } from './client'

/**
 * Passwordless auth only — no separate sign-up flow.
 * `signInWithOtp` uses `shouldCreateUser: true` so Supabase auto-registers
 * new users on first successful OTP verification.
 */

import { DEFAULT_COUNTRY, type Country } from '~/lib/phone/countries'
import {
  formatPhoneForDisplay as formatPhoneDisplay,
  isValidPhone as isValidNationalPhone,
  normalizePhoneNumber as normalizeE164,
  toE164Phone,
  validateNationalPhone,
} from '~/lib/phone/phone'

export type OtpChannel = 'email' | 'phone'

export type PhoneAuthInput = {
  country: Country
  nationalNumber: string
}

export type SignOutScope = 'local' | 'global' | 'others'

export async function signOut(options?: { scope?: SignOutScope }) {
  return supabase.auth.signOut({ scope: options?.scope ?? 'local' })
}

export async function getSession() {
  return supabase.auth.getSession()
}

export { validateNationalPhone, toE164Phone, formatPhoneDisplay as formatPhoneForDisplay }

export function normalizePhoneNumber(value: string, country: Country = DEFAULT_COUNTRY) {
  return normalizeE164(value, country)
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isValidPhone(nationalNumber: string, country: Country = DEFAULT_COUNTRY) {
  return isValidNationalPhone(nationalNumber, country)
}

export function buildPhoneIdentifier(input: PhoneAuthInput) {
  return validateNationalPhone(input.nationalNumber, input.country)
}

/** Sends email OTP. Creates a new Supabase user on first successful verification. */
export async function sendEmailOtp(email: string, metadata?: { fullName?: string }) {
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      data: metadata?.fullName ? { full_name: metadata.fullName.trim() } : undefined,
    },
  })
}

export async function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
}

/** Sends SMS OTP. Pass E.164 phone or country + national number. */
export async function sendPhoneOtp(
  phone: string | PhoneAuthInput,
  metadata?: { fullName?: string },
) {
  const normalized =
    typeof phone === 'string'
      ? normalizeE164(phone)
      : (() => {
          const result = validateNationalPhone(phone.nationalNumber, phone.country)
          return result.ok ? result.e164 : ''
        })()

  if (!normalized) {
    return {
      data: { user: null, session: null },
      error: { message: 'Invalid phone number.', name: 'AuthApiError', status: 400 } as never,
    }
  }

  return supabase.auth.signInWithOtp({
    phone: normalized,
    options: {
      shouldCreateUser: true,
      data: metadata?.fullName ? { full_name: metadata.fullName.trim() } : undefined,
    },
  })
}

export async function verifyPhoneOtp(phone: string | PhoneAuthInput, token: string) {
  const normalized =
    typeof phone === 'string'
      ? normalizeE164(phone)
      : (() => {
          const result = validateNationalPhone(phone.nationalNumber, phone.country)
          return result.ok ? result.e164 : ''
        })()

  return supabase.auth.verifyOtp({
    phone: normalized,
    token: token.trim(),
    type: 'sms',
  })
}

export async function sendOtp(
  channel: OtpChannel,
  identifier: string | PhoneAuthInput,
  metadata?: { fullName?: string },
) {
  if (channel === 'email') {
    return sendEmailOtp(identifier as string, metadata)
  }
  return sendPhoneOtp(identifier as string | PhoneAuthInput, metadata)
}

export async function verifyOtp(
  channel: OtpChannel,
  identifier: string | PhoneAuthInput,
  token: string,
) {
  if (channel === 'email') {
    return verifyEmailOtp(identifier as string, token)
  }
  return verifyPhoneOtp(identifier as string | PhoneAuthInput, token)
}
