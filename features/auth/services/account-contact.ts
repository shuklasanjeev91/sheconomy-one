import type { User } from '@supabase/supabase-js'

import { mapAuthErrorMessage } from '~/features/auth/validation'
import { canonicalE164Phone } from '~/lib/phone/phone'
import {
  formatPhoneForDisplay,
  isValidEmail,
  isValidPhone,
  sendAuthenticatedEmailChangeOtp,
  sendAuthenticatedPhoneChangeOtp,
  verifyAuthenticatedEmailChange,
  verifyAuthenticatedPhoneChange,
} from '~/lib/supabase/auth'
import { supabase } from '~/lib/supabase/client'
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

export function formatAuthContactPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Not added'
  return formatPhoneForDisplay(phone.trim())
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

export async function sendCheckoutPhoneVerification(phoneE164: string): Promise<{
  success: boolean
  error?: string
}> {
  const canonicalPhone = canonicalE164Phone(phoneE164)
  if (!isValidPhone(canonicalPhone)) {
    return { success: false, error: 'Enter a valid mobile number.' }
  }

  const { error } = await sendAuthenticatedPhoneChangeOtp(canonicalPhone)
  if (error) {
    return {
      success: false,
      error: mapAuthErrorMessage(error.message, { code: error.code }).text,
    }
  }
  return { success: true }
}

export async function confirmCheckoutPhoneVerification(
  phoneE164: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  const canonicalPhone = canonicalE164Phone(phoneE164)
  if (!isValidPhone(canonicalPhone)) {
    return { success: false, error: 'Enter a valid mobile number.' }
  }

  const { data, error } = await verifyAuthenticatedPhoneChange(canonicalPhone, otp)
  if (error) {
    return {
      success: false,
      error: mapAuthErrorMessage(error.message, { code: error.code }).text,
    }
  }

  const userId = data.user?.id
  if (userId) {
    const profileError = await syncProfileContact(userId, { phone: canonicalPhone })
    if (profileError) {
      return { success: false, error: profileError }
    }
  }

  await supabase.auth.refreshSession()
  refreshProfiles()
  return { success: true }
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
