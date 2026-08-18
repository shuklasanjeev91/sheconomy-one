import type { User } from '@supabase/supabase-js'

import { mapAuthErrorMessage } from '~/features/auth/validation'
import { canonicalE164Phone } from '~/lib/phone/phone'
import {
  formatPhoneForDisplay,
  isValidEmail,
  isValidPhone,
  sendAuthenticatedEmailChangeOtp,
  verifyAuthenticatedEmailChange,
} from '~/lib/supabase/auth'
import { supabase } from '~/lib/supabase/client'
import type { SessionProfile } from '~/lib/profile/session-profile'
import { refreshProfiles } from '~/lib/profile/refresh'

export type AuthContactSnapshot = {
  email: string | null
  phone: string | null
  phoneVerified: boolean
  emailVerified: boolean
  /** True when a verified mobile is on the auth user (required for checkout). */
  checkoutReady: boolean
  /** Show add/verify UI when phone or email is missing. */
  needsContactForm: boolean
}

export function resolveAuthContact(user: User | null | undefined): AuthContactSnapshot {
  const email = user?.email?.trim() || null
  const phoneRaw = user?.phone?.trim() || null
  const phone = phoneRaw ? canonicalE164Phone(phoneRaw) : null
  const phoneVerified = Boolean(phone && user?.phone_confirmed_at)
  const emailVerified = Boolean(email && user?.email_confirmed_at)

  return {
    email,
    phone,
    phoneVerified,
    emailVerified,
    checkoutReady: phoneVerified,
    needsContactForm: !phoneVerified || !email,
  }
}

/**
 * Checkout contact readiness that trusts either signal:
 * - a phone confirmed on the auth user (legacy path, ~1.5k users), or
 * - a phone we verified over our own OTP and stored on the profile.
 *
 * Needed because Supabase blocks binding a number that already exists on
 * another account, so those shoppers can only ever be profile-verified.
 */
export function resolveCheckoutContact(input: {
  user: User | null | undefined
  profile?: Pick<SessionProfile, 'phone' | 'phone_verified'> | null
}): AuthContactSnapshot {
  const auth = resolveAuthContact(input.user)

  const profilePhoneRaw = input.profile?.phone?.trim() || null
  const profilePhone = profilePhoneRaw ? canonicalE164Phone(profilePhoneRaw) : null
  const profileVerified = Boolean(input.profile?.phone_verified && profilePhone)

  const phoneVerified = auth.phoneVerified || profileVerified
  const phone = auth.phone ?? (profileVerified ? profilePhone : null)

  return {
    email: auth.email,
    phone,
    phoneVerified,
    emailVerified: auth.emailVerified,
    checkoutReady: phoneVerified,
    needsContactForm: !phoneVerified || !auth.email,
  }
}

/** Prefer verified auth phone; fall back to `profiles.phone` for receipts and vendor views. */
export function resolveCustomerPhone(input: {
  authUser?: User | null
  profilePhone?: string | null
}): string | null {
  const authPhone = resolveAuthContact(input.authUser).phone
  if (authPhone) return authPhone

  const profileRaw = input.profilePhone?.trim()
  if (!profileRaw) return null

  return canonicalE164Phone(profileRaw)
}

export function formatAuthContactPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Not added'
  return formatPhoneForDisplay(phone.trim())
}

export function formatCustomerContactPhone(input: {
  authUser?: User | null
  profilePhone?: string | null
}): string {
  const phone = resolveCustomerPhone(input)
  return phone ? formatAuthContactPhone(phone) : 'Not added'
}

async function syncProfileContact(userId: string, patch: { phone?: string; email?: string }) {
  const updates: Record<string, string | boolean> = {}
  if (patch.phone) {
    updates.phone = patch.phone
    updates.phone_verified = true
  }
  if (patch.email) {
    updates.email = patch.email
  }
  if (!Object.keys(updates).length) return null
  const { error } = await supabase.from('profiles').update(updates as never).eq('id', userId)
  return error?.message ?? null
}

type CheckoutOtpPayload =
  | { action: 'send'; phone: string }
  | { action: 'confirm'; phone: string; code: string }

/**
 * Call the checkout-phone-otp edge function. Verification is decoupled from
 * Supabase Auth: the function sends its own SMS and marks profiles.phone_verified,
 * so a number already registered on another account no longer dead-ends checkout.
 */
async function invokeCheckoutOtp(
  payload: CheckoutOtpPayload,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('checkout-phone-otp', { body: payload })

  if (error) {
    let message = 'Something went wrong. Please try again.'
    try {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        const parsed = (await context.json()) as { error?: string }
        if (parsed?.error) message = String(parsed.error)
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    return { success: false, error: message }
  }

  const result = data as { success?: boolean; error?: string } | null
  if (result?.success) return { success: true }
  return { success: false, error: result?.error ?? 'Something went wrong. Please try again.' }
}

export async function sendCheckoutPhoneVerification(phoneE164: string): Promise<{
  success: boolean
  error?: string
}> {
  const canonicalPhone = canonicalE164Phone(phoneE164)
  if (!isValidPhone(canonicalPhone)) {
    return { success: false, error: 'Enter a valid mobile number.' }
  }
  return invokeCheckoutOtp({ action: 'send', phone: canonicalPhone })
}

export async function confirmCheckoutPhoneVerification(
  phoneE164: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  const canonicalPhone = canonicalE164Phone(phoneE164)
  if (!isValidPhone(canonicalPhone)) {
    return { success: false, error: 'Enter a valid mobile number.' }
  }

  const result = await invokeCheckoutOtp({
    action: 'confirm',
    phone: canonicalPhone,
    code: otp.trim(),
  })
  if (result.success) {
    // The profile row now carries the verified number; re-read so checkout gates
    // flip without an auth session change.
    refreshProfiles()
  }
  return result
}

export async function sendCheckoutEmailVerification(email: string): Promise<{
  success: boolean
  error?: string
}> {
  if (!isValidEmail(email)) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  const { error } = await sendAuthenticatedEmailChangeOtp(email)
  if (error) {
    return {
      success: false,
      error: mapAuthErrorMessage(error.message, { code: error.code }).text,
    }
  }
  return { success: true }
}

export async function confirmCheckoutEmailVerification(
  email: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  const { data, error } = await verifyAuthenticatedEmailChange(email, otp)
  if (error) {
    return {
      success: false,
      error: mapAuthErrorMessage(error.message, { code: error.code }).text,
    }
  }

  const userId = data.user?.id
  if (userId) {
    const profileError = await syncProfileContact(userId, {
      email: email.trim().toLowerCase(),
    })
    if (profileError) {
      return { success: false, error: profileError }
    }
  }

  await supabase.auth.refreshSession()
  refreshProfiles()
  return { success: true }
}
